import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { SkillinkConfig, LinkMapping } from '../types/index.js';
import { ensureDir, isSymlink, createSymlink } from '../utils/fs.js';

/**
 * 核心链接器类：负责同步逻辑
 */
export class Linker {
  private config: SkillinkConfig;
  private root: string;

  constructor(root: string, config: SkillinkConfig) {
    this.root = root;
    this.config = config;
  }

  /**
   * 同步所有映射
   */
  async sync(): Promise<void> {
    for (const mapping of this.config.links) {
      await this.syncMapping(mapping);
    }
  }

  /**
   * 同步单个映射
   */
  private async syncMapping(mapping: LinkMapping): Promise<void> {
    const fromPath = path.resolve(this.root, mapping.from);
    const toPath = path.resolve(this.root, mapping.to);

    if (!existsSync(fromPath)) {
      console.warn(`源路径不存在，跳过: ${mapping.from}`);
      return;
    }

    await this.syncLink(fromPath, toPath);
  }

  /**
   * 创建或修复符号链接（文件和目录通用）
   */
  private async syncLink(fromPath: string, toPath: string): Promise<void> {
    await ensureDir(path.dirname(toPath));

    if (existsSync(toPath)) {
      if (isSymlink(toPath)) {
        const currentTarget = await fs.readlink(toPath);
        const absCurrent = path.resolve(path.dirname(toPath), currentTarget);
        if (absCurrent === path.resolve(fromPath)) {
          return; // 已正确链接
        }
      }
    }

    await createSymlink(fromPath, toPath);
    console.log(`+ ${path.relative(this.root, fromPath)} -> ${path.relative(this.root, toPath)}`);
  }
}
