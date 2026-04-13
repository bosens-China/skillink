import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { select } from '@inquirer/prompts';
import type { LinkerConfig, LinkMapping } from '../types/index.js';
import { ensureDir, isSymlink, createSymlink } from '../utils/fs.js';
import type { Locale } from '../types/index.js';
import { t } from '../utils/locale.js';

interface LinkerOptions {
  autoConfirm?: boolean;
  locale?: 'en' | 'zh-CN';
  configLocale?: Locale;
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
   * 同步所有映射
   */
  async sync(): Promise<number> {
    let syncedCount = 0;
    for (const mapping of this.config.links) {
      const synced = await this.syncMapping(mapping);
      if (synced) {
        syncedCount += 1;
      }
    }
    return syncedCount;
  }

  /**
   * 同步单个映射
   */
  private async syncMapping(mapping: LinkMapping): Promise<boolean> {
    const fromPath = path.resolve(this.root, mapping.from);
    const toPath = path.resolve(this.root, mapping.to);

    if (!existsSync(fromPath)) {
      console.warn(
        t(
          `源路径不存在，跳过: ${mapping.from}`,
          `Source path not found, skipping: ${mapping.from}`,
          this.options.locale ?? 'en',
          this.options.configLocale,
        ),
      );
      return false;
    }

    return this.syncLink(fromPath, toPath);
  }

  /**
   * 创建或修复符号链接（文件和目录通用）
   */
  private async syncLink(fromPath: string, toPath: string): Promise<boolean> {
    // 源和目标相同路径时视为已同步，避免误删源文件
    if (path.resolve(fromPath) === path.resolve(toPath)) {
      return true;
    }

    const fromStats = await fs.lstat(fromPath);

    await ensureDir(path.dirname(toPath));

    if (existsSync(toPath)) {
      if (isSymlink(toPath)) {
        const currentTarget = await fs.readlink(toPath);
        const absCurrent = path.resolve(path.dirname(toPath), currentTarget);
        if (absCurrent === path.resolve(fromPath)) {
          return true; // 已正确链接
        }
      } else {
        const toStats = await fs.lstat(toPath);
        const isToDir = toStats.isDirectory();

        // 双语类型标签
        const toTypeZh = isToDir ? '目录' : '文件';
        const toTypeEn = isToDir ? 'directory' : 'file';

        // 文件类型相同时检查是否为同一物理文件（Hardlink 等情况）
        if (
          !fromStats.isDirectory() &&
          !isToDir &&
          fromStats.dev === toStats.dev &&
          fromStats.ino === toStats.ino
        ) {
          return true;
        }

        // 目标已存在且不是符号链接时，交互模式可选择覆盖；--yes 模式直接失败终止
        if (this.options.autoConfirm) {
          throw new Error(
            t(
              `目标${toTypeZh}已存在且不是符号链接，--yes 模式下不会自动删除：${toPath}`,
              `Target ${toTypeEn} exists and is not a symlink; in --yes mode it will not be deleted automatically: ${toPath}`,
              this.options.locale ?? 'en',
              this.options.configLocale,
            ),
          );
        }

        const action = await select({
          message: t(
            `目标${toTypeZh}已存在且不是符号链接，是否删除并覆盖？${path.relative(this.root, toPath)}`,
            `Target ${toTypeEn} exists and is not a symlink. Delete and overwrite? ${path.relative(this.root, toPath)}`,
            this.options.locale ?? 'en',
            this.options.configLocale,
          ),
          choices: [
            {
              name: t(
                '删除并覆盖',
                'Delete and overwrite',
                this.options.locale ?? 'en',
                this.options.configLocale,
              ),
              value: 'overwrite',
            },
            {
              name: t(
                '跳过该映射',
                'Skip this mapping',
                this.options.locale ?? 'en',
                this.options.configLocale,
              ),
              value: 'skip',
            },
          ],
        });

        if (action === 'skip') {
          return false;
        }

        await fs.rm(toPath, { recursive: true, force: true });
      }
    }

    await createSymlink(fromPath, toPath);
    console.log(
      t(
        `已创建链接: ${path.relative(this.root, fromPath)} -> ${path.relative(this.root, toPath)}`,
        `Linked: ${path.relative(this.root, fromPath)} -> ${path.relative(this.root, toPath)}`,
        this.options.locale ?? 'en',
        this.options.configLocale,
      ),
    );
    return true;
  }
}
