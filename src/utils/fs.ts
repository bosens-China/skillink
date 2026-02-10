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
 * 创建符号链接或 Junction
 * @param target 源路径（真实存在的目录）
 * @param path 链接路径（要创建的快捷方式）
 */
export async function createSymlink(
  target: string,
  path: string,
): Promise<void> {
  // Windows 下目录使用 'junction'，其他系统使用 'dir'
  const type = process.platform === 'win32' ? 'junction' : 'dir';

  // 使用 lstat 判断路径是否存在，这样可正确识别损坏的符号链接
  try {
    const stats = await fs.lstat(path);
    if (stats.isSymbolicLink()) {
      // 如果是已存在的链接（包括失效链接），先删除再重建
      await fs.unlink(path);
    } else {
      // 如果是普通文件或目录，抛出错误以防误删
      throw new Error(`路径 ${path} 已存在且不是符号链接，请手动清理。`);
    }
  } catch (error: unknown) {
    // 仅当路径不存在时忽略，其他异常继续抛出
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.symlink(target, path, type);
}

/**
 * 安全移除符号链接
 */
export async function removeSymlink(path: string): Promise<void> {
  if (isSymlink(path)) {
    await fs.unlink(path);
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
