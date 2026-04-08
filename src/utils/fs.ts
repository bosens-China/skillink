import fs from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';

/**
 * 检查路径是否存在
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保目录存在（如果不存在则递归创建）
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * 检查路径是否为符号链接（或 Windows Junction）
 */
export function isSymlink(p: string): boolean {
  try {
    const stats = lstatSync(p);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 创建符号链接
 * @param target 源路径（真实存在的文件或目录）
 * @param linkPath 链接路径（要创建的符号链接）
 */
export async function createSymlink(
  target: string,
  linkPath: string,
): Promise<void> {
  // 根据源路径类型选择链接类型：
  // - Windows: 目录使用 'junction'（兼容性更好），文件使用 'file'
  // - 非 Windows: 目录使用 'dir'，文件使用 'file'
  const targetStats = await fs.lstat(target);
  const isDir = targetStats.isDirectory();
  const type =
    process.platform === 'win32'
      ? (isDir ? 'junction' : 'file')
      : (isDir ? 'dir' : 'file');

  // 使用 lstat 判断路径是否存在，这样可正确识别损坏的符号链接
  try {
    const stats = await fs.lstat(linkPath);
    if (stats.isSymbolicLink()) {
      // 如果是已存在的链接（包括失效链接），先删除再重建
      await fs.unlink(linkPath);
    } else {
      // 如果是普通文件或目录，抛出错误以防误删
      throw new Error(`路径 ${linkPath} 已存在且不是符号链接，请手动清理。`);
    }
  } catch (error: unknown) {
    // 仅当路径不存在时忽略，其他异常继续抛出
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  try {
    await fs.symlink(target, linkPath, type);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    // Windows 下文件符号链接可能因权限受限失败（EPERM）：
    // 尝试降级为硬链接，尽量保证默认场景可用。
    if (process.platform === 'win32' && !isDir && err.code === 'EPERM') {
      await fs.link(target, linkPath);
      return;
    }
    throw error;
  }
}

/**
 * 安全移除符号链接
 */
export async function removeSymlink(linkPath: string): Promise<void> {
  if (isSymlink(linkPath)) {
    await fs.unlink(linkPath);
  }
}

/**
 * 获取指定目录下的所有子目录名（潜在的技能）
 */
export async function getSubdirectories(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}
