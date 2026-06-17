import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { LinkerConfig, LinkMapping } from '../types/index.js';
import { ensureDir, isSymlink, createSymlink } from '../utils/fs.js';

interface LinkerOptions {
  autoConfirm?: boolean;
}

export interface LinkerResult {
  created: number;
  reused: number;
  skipped: number;
}

/**
 * 核心链接器类：负责同步逻辑
 */
export class Linker {
  private config: LinkerConfig;
  private root: string;
  private options: LinkerOptions;

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
    for (const mapping of this.config.links) {
      const outcome = await this.syncMapping(mapping);
      result[outcome] += 1;
    }
    return result;
  }

  /**
   * 同步单个映射
   */
  private async syncMapping(
    mapping: LinkMapping,
  ): Promise<'created' | 'reused' | 'skipped'> {
    const fromPath = path.resolve(this.root, mapping.from);
    const toPath = path.resolve(this.root, mapping.to);

    if (!existsSync(fromPath)) {
      p.log.warn(`源路径不存在，跳过: ${pc.dim(mapping.from)}`);
      return 'skipped';
    }

    return this.syncLink(fromPath, toPath);
  }

  /**
   * 创建或修复符号链接（文件和目录通用）
   */
  private async syncLink(
    fromPath: string,
    toPath: string,
  ): Promise<'created' | 'reused' | 'skipped'> {
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

        // 目标已存在且不是符号链接时，交互模式可选择覆盖；--yes 模式直接失败终止
        if (this.options.autoConfirm) {
          throw new Error(
            `目标${toType}已存在且不是符号链接，--yes 模式下不会自动删除：${path.relative(this.root, toPath)}`,
          );
        }

        const action = await p.select({
          message: `目标${toType}已存在且不是符号链接，是否删除并覆盖？${pc.dim(path.relative(this.root, toPath))}`,
          options: [
            { value: 'overwrite', label: '删除并覆盖' },
            { value: 'skip', label: '跳过该映射' },
          ],
          initialValue: 'skip',
        });

        if (p.isCancel(action) || action === 'skip') {
          return 'skipped';
        }

        await fs.rm(toPath, { recursive: true, force: true });
      }
    }

    await createSymlink(fromPath, toPath);
    return 'created';
  }
}
