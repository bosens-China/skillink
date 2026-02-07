/**
 * 链接操作模块 - 跨平台符号链接管理
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SyncResult } from '../types/index.js';
import { isSymlink, safeRemove, ensureDir } from '../utils/fs.js';

/**
 * 创建符号链接
 * 
 * Windows 处理：
 * - 对目录使用 junction（无需管理员权限）
 * - 对文件使用 symlink（需要管理员权限，失败时 fallback 到 copy）
 * 
 * macOS/Linux：
 * - 标准符号链接
 */
export async function createLink(
  source: string,
  target: string,
  options: { 
    mode?: 'symlink' | 'copy';
    backupOnConflict?: boolean;
  } = {}
): Promise<SyncResult> {
  const { mode = 'symlink', backupOnConflict = true } = options;
  const skill = path.basename(source);
  const targetName = path.basename(path.dirname(target)) + '/' + path.basename(target);
  
  try {
    // 确保目标目录存在
    await ensureDir(path.dirname(target));
    
    // 如果目标已存在，先检查是否是正确的链接
    if (existsSync(target)) {
      const isLink = await isSymlink(target);
      
      if (isLink) {
        // 检查链接指向是否正确
        const existingSource = await fs.readlink(target);
        if (path.resolve(existingSource) === path.resolve(source)) {
          return {
            skill,
            target: targetName,
            targetPath: target,
            action: 'skipped',
          };
        }
        // 链接指向不正确，删除重建
        await fs.unlink(target);
      } else {
        // 冲突处理：不是链接
        if (backupOnConflict) {
          const backupPath = `${target}.backup.${Date.now()}`;
          await fs.rename(target, backupPath);
        } else {
          // 不备份则直接递归删除
          await fs.rm(target, { recursive: true, force: true });
        }
      }
    }
    
    // 创建链接
    if (mode === 'copy') {
      await fs.cp(source, target, { recursive: true });
    } else {
      try {
        // 尝试创建符号链接
        const stat = await fs.stat(source);
        const isDirectory = stat.isDirectory();
        
        if (process.platform === 'win32' && isDirectory) {
          // Windows 目录使用 junction
          await fs.symlink(source, target, 'junction');
        } else {
          // 其他情况使用符号链接
          await fs.symlink(source, target, isDirectory ? 'dir' : 'file');
        }
      } catch (error) {
        // 权限不足，fallback 到 copy
        await fs.cp(source, target, { recursive: true });
      }
    }
    
    return {
      skill,
      target: targetName,
      targetPath: target,
      action: 'created',
    };
  } catch (error) {
    return {
      skill,
      target: targetName,
      targetPath: target,
      action: 'error',
      error: String(error),
    };
  }
}

/**
 * 移除链接
 */
export async function removeLink(target: string): Promise<SyncResult> {
  const skill = path.basename(target);
  const targetName = path.basename(path.dirname(target)) + '/' + path.basename(target);
  
  try {
    if (!existsSync(target)) {
      return {
        skill,
        target: targetName,
        targetPath: target,
        action: 'skipped',
      };
    }
    
    await safeRemove(target);
    
    return {
      skill,
      target: targetName,
      targetPath: target,
      action: 'removed',
    };
  } catch (error) {
    return {
      skill,
      target: targetName,
      targetPath: target,
      action: 'error',
      error: String(error),
    };
  }
}

/**
 * 获取链接指向的源路径
 */
export async function getLinkSource(target: string): Promise<string | null> {
  try {
    if (await isSymlink(target)) {
      return await fs.readlink(target);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 检查链接是否有效（源文件仍然存在）
 */
export async function isLinkValid(target: string): Promise<boolean> {
  try {
    const source = await getLinkSource(target);
    if (!source) return false;
    return existsSync(source);
  } catch {
    return false;
  }
}
