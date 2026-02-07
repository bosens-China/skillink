/**
 * 同步引擎 - 计算差异并执行同步
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { SkillinkConfig, SyncResult, SkillInfo } from '../types/index.js';
import { 
  getSkills, 
  ensureDir,
} from '../utils/fs';
import { getEnabledTargets } from './config.js';
import { createLink, removeLink } from './linker.js';
import { isSymlink } from '../utils/fs.js';

/**
 * 执行同步
 */
export async function sync(
  projectRoot: string,
  config: SkillinkConfig
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const skills = await getSkills(projectRoot);
  const targets = getEnabledTargets(config);
  const syncMode = config.options?.syncMode ?? 'symlink';
  const backupOnConflict = config.options?.backupOnConflict ?? true;
  
  if (skills.length === 0) {
    return results;
  }
  
  if (targets.length === 0) {
    return results;
  }
  
  for (const target of targets) {
    // 确保目标目录存在
    const targetDir = path.join(projectRoot, target.path);
    await ensureDir(targetDir);
    
    // 清理已失效的链接
    await cleanStaleLinks(targetDir, skills);
    
    // 创建/更新链接
    for (const skill of skills) {
      const sourcePath = skill.path;
      const targetPath = path.join(targetDir, skill.name);
      
      const result = await createLink(sourcePath, targetPath, {
        mode: syncMode,
        backupOnConflict
      });
      results.push({ ...result, target: target.id });
    }
  }
  
  return results;
}

/**
 * 清理已失效的链接（skills 中不存在的链接）
 */
async function cleanStaleLinks(
  targetDir: string, 
  validSkills: SkillInfo[]
): Promise<void> {
  if (!existsSync(targetDir)) {
    return;
  }
  
  const validSkillNames = new Set(validSkills.map(s => s.name));
  const items = await fs.readdir(targetDir, { withFileTypes: true });
  
  for (const item of items) {
    if (!validSkillNames.has(item.name)) {
      const itemPath = path.join(targetDir, item.name);
      const isLink = await isSymlink(itemPath);
      
      // 只删除符号链接，不删除用户自己的文件
      if (isLink) {
        await removeLink(itemPath);
      }
    }
  }
}

/**
 * 清理所有生成的链接
 */
export async function cleanAll(
  projectRoot: string,
  config: SkillinkConfig
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const skills = await getSkills(projectRoot);
  const targets = getEnabledTargets(config);
  
  for (const target of targets) {
    const targetDir = path.join(projectRoot, target.path);
    
    if (!existsSync(targetDir)) {
      continue;
    }
    
    for (const skill of skills) {
      const targetPath = path.join(targetDir, skill.name);
      
      if (existsSync(targetPath)) {
        const result = await removeLink(targetPath);
        results.push({ ...result, target: target.id });
      }
    }
  }
  
  return results;
}

/**
 * 获取同步预览（不执行实际操作）
 */
export async function getSyncPreview(
  projectRoot: string,
  config: SkillinkConfig
): Promise<Array<{ skill: string; targets: string[]; action: 'create' | 'update' | 'remove' }>> {
  const skills = await getSkills(projectRoot);
  const targets = getEnabledTargets(config);
  const preview: Array<{ skill: string; targets: string[]; action: 'create' | 'update' | 'remove' }> = [];
  
  for (const skill of skills) {
    const targetNames: string[] = [];
    
    for (const target of targets) {
      const targetPath = path.join(projectRoot, target.path, skill.name);
      
      if (existsSync(targetPath)) {
        // 检查是否需要更新
        const isLink = await isSymlink(targetPath);
        if (isLink) {
          const source = await fs.readlink(targetPath);
          if (source !== skill.path) {
            targetNames.push(target.id);
          }
        }
      } else {
        targetNames.push(target.id);
      }
    }
    
    if (targetNames.length > 0) {
      preview.push({
        skill: skill.name,
        targets: targetNames,
        action: 'create',
      });
    }
  }
  
  return preview;
}
