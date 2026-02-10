import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { SkillinkConfig, SyncResult } from '../types/index.js';
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
   * 将所有技能同步到所有目标
   */
  async sync(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const sourceDir = path.resolve(
      this.root,
      this.config.source || '.agents/skills',
    );

    if (!existsSync(sourceDir)) {
      throw new Error(`未找到源目录: ${sourceDir}`);
    }

    const skills = await this.getSkills(sourceDir);
    const targets = this.config.targets.filter((t) => t.enabled !== false);

    for (const target of targets) {
      const targetDir = path.resolve(this.root, target.path);

      try {
        await ensureDir(targetDir);

        // 1. 同步有效技能
        for (const skill of skills) {
          const result = await this.syncSkill(sourceDir, targetDir, skill);
          results.push({ ...result, target: target.name });
        }

        // 2. 清理失效链接
        const cleanResults = await this.cleanStale(targetDir, skills);
        results.push(
          ...cleanResults.map((r) => ({ ...r, target: target.name })),
        );
      } catch (error: unknown) {
        results.push({
          skill: '*',
          target: target.name,
          status: 'failed',
          message: `目标错误: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  /**
   * 同步单个技能（创建或修复链接）
   */
  private async syncSkill(
    sourceRoot: string,
    targetRoot: string,
    skillName: string,
  ): Promise<SyncResult> {
    const sourcePath = path.join(sourceRoot, skillName);
    const targetPath = path.join(targetRoot, skillName);

    try {
      if (existsSync(targetPath)) {
        if (isSymlink(targetPath)) {
          // 检查链接是否指向正确的源
          const currentTarget = await fs.readlink(targetPath);
          const absCurrent = path.resolve(
            path.dirname(targetPath),
            currentTarget,
          );
          const absSource = path.resolve(sourcePath);

          if (absCurrent === absSource) {
            return {
              skill: skillName,
              target: '',
              status: 'skipped',
              message: '已正确链接',
            };
          }
        }
        // 如果已存在但不是链接，或指向错误，createSymlink 会处理或报错
      }

      await createSymlink(sourcePath, targetPath);
      return { skill: skillName, target: '', status: 'linked' };
    } catch (error: unknown) {
      return {
        skill: skillName,
        target: '',
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 清理目标目录中的失效链接
   */
  private async cleanStale(
    targetRoot: string,
    validSkills: string[],
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    if (!existsSync(targetRoot)) return [];

    const items = await fs.readdir(targetRoot, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory() || item.isSymbolicLink()) {
        // 如果不在有效技能列表中
        if (!validSkills.includes(item.name)) {
          const itemPath = path.join(targetRoot, item.name);

          // 只删除符号链接，保护普通目录
          if (isSymlink(itemPath)) {
            await fs.unlink(itemPath);
            results.push({
              skill: item.name,
              target: '',
              status: 'cleaned',
              message: '已移除失效链接',
            });
          }
        }
      }
    }
    return results;
  }

  /**
   * 将特定技能同步到所有目标（用于 Watch 模式）
   */
  async syncSkillToAll(skillName: string): Promise<void> {
    const sourceDir = path.resolve(
      this.root,
      this.config.source || '.agents/skills',
    );
    const targets = this.config.targets.filter((t) => t.enabled !== false);

    for (const target of targets) {
      const targetDir = path.resolve(this.root, target.path);
      await ensureDir(targetDir);
      await this.syncSkill(sourceDir, targetDir, skillName);
    }
  }

  /**
   * 从所有目标中移除特定技能（用于 Watch 模式）
   */
  async removeSkillFromAll(skillName: string): Promise<void> {
    const targets = this.config.targets.filter((t) => t.enabled !== false);

    for (const target of targets) {
      const targetDir = path.resolve(this.root, target.path);
      const targetPath = path.join(targetDir, skillName);

      if (existsSync(targetPath)) {
        if (isSymlink(targetPath)) {
          await fs.unlink(targetPath);
        }
      }
    }
  }

  /**
   * 清理所有由 Skillink 创建的符号链接
   */
  async cleanAll(): Promise<void> {
    // clean 命令应清理所有配置目标（包括已 disabled 的历史目标）
    const targets = this.config.targets;
    const absSourceDir = path.resolve(
      this.root,
      this.config.source || '.agents/skills',
    );

    for (const target of targets) {
      const targetDir = path.resolve(this.root, target.path);
      if (!existsSync(targetDir)) continue;

      const items = await fs.readdir(targetDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isSymbolicLink()) {
          const itemPath = path.join(targetDir, item.name);
          try {
            const linkTarget = await fs.readlink(itemPath);
            const absLinkTarget = path.resolve(targetDir, linkTarget);
            const relative = path.relative(absSourceDir, absLinkTarget);

            // 仅删除确实位于源目录内的链接，避免前缀误判导致误删
            if (
              relative === '' ||
              (!relative.startsWith('..') && !path.isAbsolute(relative))
            ) {
              await fs.unlink(itemPath);
              console.log(`已从 ${target.name} 移除 ${item.name}`);
            }
          } catch {
            // 忽略读取错误
          }
        }
      }
    }
  }

  /**
   * 获取源目录下的所有有效技能（子目录）
   */
  private async getSkills(sourceDir: string): Promise<string[]> {
    const items = await fs.readdir(sourceDir, { withFileTypes: true });
    return items
      .filter((item) => item.isDirectory() && !item.name.startsWith('.'))
      .map((item) => item.name);
  }
}
