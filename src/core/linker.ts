import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { LinkerConfig, LinkMapping, LinkMode } from '../types/index.js';
import {
  ensureDir,
  isSymlink,
  createSymlink,
  copyPath,
  pathsContentEqual,
} from '../utils/fs.js';
import {
  readCopyManifest,
  writeCopyManifest,
} from '../utils/copy-manifest.js';

interface LinkerOptions {
  /** --yes：跳过交互确认，遇真实文件冲突直接报错终止 */
  autoConfirm?: boolean;
  /** --silent：非交互，遇冲突跳过而非报错（供 postinstall 使用） */
  silent?: boolean;
}

export interface LinkerResult {
  created: number;
  reused: number;
  skipped: number;
}

type Outcome = 'created' | 'reused' | 'skipped';

/**
 * 核心链接器类：负责同步逻辑（symlink / copy 两种模式）
 */
export class Linker {
  private config: LinkerConfig;
  private root: string;
  private options: LinkerOptions;
  /** 上一轮由 copy 模式生成、归 skillink 托管的目标（相对 POSIX 路径） */
  private prevCopies = new Set<string>();
  /** 本轮实际产出的 copy 目标 */
  private nextCopies = new Set<string>();
  /** 本轮成功写入（created/reused）的所有目标，含 symlink；用于保护不被孤儿清理误删 */
  private handled = new Set<string>();

  constructor(root: string, config: LinkerConfig, options: LinkerOptions = {}) {
    this.root = root;
    this.config = config;
    this.options = options;
  }

  /**
   * 同步所有映射，返回每类结果计数
   */
  async sync(): Promise<LinkerResult> {
    const result: LinkerResult = { created: 0, reused: 0, skipped: 0 };

    // 读取上一轮 copy 清单，用于安全覆盖与孤儿清理
    this.prevCopies = new Set(await readCopyManifest(this.root));
    this.nextCopies = new Set();
    this.handled = new Set();

    for (const mapping of this.config.links) {
      const outcome = await this.syncMapping(mapping);
      if (outcome !== 'skipped') {
        this.handled.add(mapping.to);
      }
      result[outcome] += 1;
    }

    await this.cleanupOrphanCopies();
    await writeCopyManifest(this.root, [...this.nextCopies]);

    return result;
  }

  /**
   * 同步单个映射：校验源存在后按 mode 分派
   */
  private async syncMapping(mapping: LinkMapping): Promise<Outcome> {
    const fromPath = path.resolve(this.root, mapping.from);
    const toPath = path.resolve(this.root, mapping.to);

    if (!existsSync(fromPath)) {
      p.log.warn(`源路径不存在，跳过: ${pc.dim(mapping.from)}`);
      return 'skipped';
    }

    if (mapping.mode === 'copy') {
      return this.syncCopy(fromPath, toPath, mapping.to);
    }
    return this.syncSymlink(fromPath, toPath, mapping.to);
  }

  /**
   * 删除上一轮 copy 产出、但本轮不再出现的孤儿副本（源被删除/重命名/改为 symlink 等）。
   * 仅当目标已不属于任何当前映射时才清理，避免误删本轮刚生成的目标。
   */
  private async cleanupOrphanCopies(): Promise<void> {
    for (const rel of this.prevCopies) {
      // 本轮已成功写入该目标（copy 或 symlink）则保留，仅清理真正失去来源的旧副本
      if (this.handled.has(rel)) {
        continue;
      }
      const abs = path.resolve(this.root, rel);
      if (existsSync(abs) || isSymlink(abs)) {
        await fs.rm(abs, { recursive: true, force: true });
      }
    }
  }

  /**
   * 询问是否覆盖已存在的真实目标；返回 true 表示可覆盖。
   * silent 与 autoConfirm 下不交互（分别为跳过 / 报错）。
   */
  private async confirmOverwrite(
    toType: string,
    toPath: string,
  ): Promise<boolean> {
    const rel = path.relative(this.root, toPath);

    if (this.options.silent) {
      return false;
    }

    if (this.options.autoConfirm) {
      throw new Error(
        `目标${toType}已存在且不是 skillink 生成的内容，--yes 模式下不会自动删除：${rel}`,
      );
    }

    const action = await p.select({
      message: `目标${toType}已存在且不是 skillink 生成的内容，是否删除并覆盖？${pc.dim(rel)}`,
      options: [
        { value: 'overwrite', label: '删除并覆盖' },
        { value: 'skip', label: '跳过该映射' },
      ],
      initialValue: 'skip',
    });

    return !p.isCancel(action) && action === 'overwrite';
  }

  /**
   * 模式切换确认：目标已是「我们自己生成的」另一种形式（symlink ↔ copy）时调用。
   * 用户改配置即已表达意图，故 --yes / --silent 直接执行；仅交互模式做一次确认。
   */
  private async confirmModeSwitch(
    fromMode: LinkMode,
    toMode: LinkMode,
    toPath: string,
  ): Promise<boolean> {
    const rel = path.relative(this.root, toPath);
    const toLabel = toMode === 'copy' ? 'copy（复制真实内容）' : 'symlink（软链接）';
    // 当前目标的实际形态：copy→ 真实文件/目录；symlink→ 软链接
    const current = fromMode === 'copy' ? '现有真实文件/目录' : '现有软链接';

    // 切换必然先删除旧形态再重建，这里把「会删除」讲清楚
    const message = `「${rel}」要从 ${fromMode} 切换到 ${toMode}：将删除${current}并重建为 ${toLabel}，是否继续？`;

    // silent 静默执行；--yes 自动执行但打印一行，避免「悄悄删了」
    if (this.options.silent) {
      return true;
    }
    if (this.options.autoConfirm) {
      p.log.info(`模式切换：删除${current}并重建为 ${toLabel} ${pc.dim(rel)}`);
      return true;
    }

    const ans = await p.confirm({ message, initialValue: true });
    return !p.isCancel(ans) && ans === true;
  }

  /**
   * 创建或修复符号链接（文件和目录通用）
   */
  private async syncSymlink(
    fromPath: string,
    toPath: string,
    toRel: string,
  ): Promise<Outcome> {
    // 源和目标相同路径时视为已同步，避免误删源文件
    if (fromPath === toPath) {
      return 'reused';
    }

    const fromStats = await fs.lstat(fromPath);

    await ensureDir(path.dirname(toPath));

    if (existsSync(toPath)) {
      if (isSymlink(toPath)) {
        const currentTarget = await fs.readlink(toPath);
        const absCurrent = path.resolve(path.dirname(toPath), currentTarget);
        if (absCurrent === fromPath) {
          return 'reused'; // 已正确链接
        }
        // 链接指向了别的源：当作失效链接重建（属于「修复」语义）
        // 该场景下，resolveLinkMappings 已经做了「多个 from 指向同一 to」的冲突拦截，
        // 所以这里出现的差异通常是上一轮运行的产物，安全替换即可。
      } else {
        const toStats = await fs.lstat(toPath);
        const isToDir = toStats.isDirectory();
        const toType = isToDir ? '目录' : '文件';

        // 文件类型相同时检查是否为同一物理文件（Hardlink 等情况）
        if (
          !fromStats.isDirectory() &&
          !isToDir &&
          fromStats.dev === toStats.dev &&
          fromStats.ino === toStats.ino
        ) {
          return 'reused';
        }

        // 目标若是上一轮 copy 生成的真实文件 → 这是 copy→symlink 的模式切换；
        // 否则视为用户已有文件冲突。
        const proceed = this.prevCopies.has(toRel)
          ? await this.confirmModeSwitch('copy', 'symlink', toPath)
          : await this.confirmOverwrite(toType, toPath);
        if (!proceed) {
          return 'skipped';
        }

        await fs.rm(toPath, { recursive: true, force: true });
      }
    }

    await createSymlink(fromPath, toPath);
    return 'created';
  }

  /**
   * 复制真实内容到目标（copy 模式）：可被 git 提交、跨平台可用。
   */
  private async syncCopy(
    fromPath: string,
    toPath: string,
    toRel: string,
  ): Promise<Outcome> {
    // 源与目标同路径时不做任何事，避免自我覆盖
    if (fromPath === toPath) {
      return 'reused';
    }

    await ensureDir(path.dirname(toPath));

    if (existsSync(toPath)) {
      // 目标是软链接：这是 symlink→copy 的模式切换，交互模式确认后替换为真实副本
      if (isSymlink(toPath)) {
        if (!(await this.confirmModeSwitch('symlink', 'copy', toPath))) {
          return 'skipped';
        }
        await copyPath(fromPath, toPath);
        this.nextCopies.add(toRel);
        return 'created';
      }

      // 内容已完全一致 → 复用，不重写（保持工作区/git 干净）
      if (await pathsContentEqual(fromPath, toPath)) {
        this.nextCopies.add(toRel);
        return 'reused';
      }

      // 内容不同：仅当目标是我们上一轮生成的副本时才安全覆盖，否则视为用户文件冲突
      if (!this.prevCopies.has(toRel)) {
        const toStats = await fs.lstat(toPath);
        const toType = toStats.isDirectory() ? '目录' : '文件';
        if (!(await this.confirmOverwrite(toType, toPath))) {
          return 'skipped';
        }
      }
    }

    await copyPath(fromPath, toPath);
    this.nextCopies.add(toRel);
    return 'created';
  }
}
