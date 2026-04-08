import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { select } from '@inquirer/prompts';
import type { SkillinkConfig, LinkMapping } from '../types/index.js';
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
  private config: SkillinkConfig;
  private root: string;
  private options: LinkerOptions;

  constructor(root: string, config: SkillinkConfig, options: LinkerOptions = {}) {
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
    const fromType = fromStats.isDirectory() ? '目录' : '文件';

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
        const toType = toStats.isDirectory() ? '目录' : '文件';

        if (fromStats.isDirectory() !== toStats.isDirectory()) {
          throw new Error(
            t(
              `目标路径已存在且类型不匹配：源是${fromType}，目标是${toType}。请先手动清理目标路径：${toPath}`,
              `Target path exists with mismatched type: source is ${fromStats.isDirectory() ? 'directory' : 'file'}, target is ${toStats.isDirectory() ? 'directory' : 'file'}. Please clean target first: ${toPath}`,
              this.options.locale ?? 'en',
              this.options.configLocale,
            ),
          );
        }

        // 目录已存在且不是符号链接时，交互模式可选择覆盖；--yes 模式直接失败终止
        if (fromStats.isDirectory() && toStats.isDirectory()) {
          if (this.options.autoConfirm) {
            throw new Error(
              t(
                `目标目录已存在且不是符号链接，--yes 模式下不会自动删除：${toPath}`,
                `Target directory exists and is not a symlink; in --yes mode it will not be deleted automatically: ${toPath}`,
                this.options.locale ?? 'en',
                this.options.configLocale,
              ),
            );
          }

          const action = await select({
            message: t(
              `目标目录已存在且不是符号链接，是否删除并覆盖？${path.relative(this.root, toPath)}`,
              `Target directory exists and is not a symlink. Delete and overwrite? ${path.relative(this.root, toPath)}`,
              this.options.locale ?? 'en',
              this.options.configLocale,
            ),
            choices: [
              {
                name: t('删除并覆盖', 'Delete and overwrite', this.options.locale ?? 'en', this.options.configLocale),
                value: 'overwrite',
              },
              {
                name: t('跳过该映射', 'Skip this mapping', this.options.locale ?? 'en', this.options.configLocale),
                value: 'skip',
              },
            ],
          });

          if (action === 'skip') {
            return false;
          }

          await fs.rm(toPath, { recursive: true, force: true });
        } else if (!fromStats.isDirectory() && !toStats.isDirectory()) {
          const isSameFile = fromStats.dev === toStats.dev && fromStats.ino === toStats.ino;
          // 文件映射：如果不是同一文件（例如源文件被替换后），自动重建链接以保持同步
          if (!isSameFile) {
            await fs.unlink(toPath);
          } else {
            return true;
          }
        } else {
          throw new Error(
            t(
              `目标路径已存在且不是符号链接（${toType}）。请先手动清理后重试：${toPath}`,
              `Target path exists and is not a symlink (${toStats.isDirectory() ? 'directory' : 'file'}). Please clean it first: ${toPath}`,
              this.options.locale ?? 'en',
              this.options.configLocale,
            ),
          );
        }
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
