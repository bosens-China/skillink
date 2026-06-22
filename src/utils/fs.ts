import fs from 'node:fs/promises';
import path from 'node:path';
import { lstatSync } from 'node:fs';

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
    return lstatSync(p).isSymbolicLink();
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
      ? isDir
        ? 'junction'
        : 'file'
      : isDir
        ? 'dir'
        : 'file';

  // 使用 lstat 判断路径是否存在，这样可正确识别损坏的符号链接
  try {
    const stats = await fs.lstat(linkPath);
    if (stats.isSymbolicLink()) {
      // 如果是已存在的链接（包括失效链接），先删除再重建
      await fs.unlink(linkPath);
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
 * 递归复制：文件直接拷贝，目录逐项递归，链接按链接本身复制。
 * 手写实现而非 fs.cp，避免 Node 在部分版本对该实验性 API 打印警告（污染 postinstall 输出）。
 */
async function copyRecursive(src: string, dest: string): Promise<void> {
  const st = await fs.lstat(src);
  if (st.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const name of entries) {
      await copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else if (st.isSymbolicLink()) {
    const link = await fs.readlink(src);
    await fs.symlink(link, dest);
  } else {
    await fs.copyFile(src, dest);
  }
}

/**
 * 把源（文件或目录）的真实内容复制到目标。
 * 先清理目标（含失效链接 / 旧副本）再整体复制，保证幂等。
 */
export async function copyPath(target: string, dest: string): Promise<void> {
  await fs.rm(dest, { recursive: true, force: true });
  await copyRecursive(target, dest);
}

/**
 * 比较两个路径内容是否完全一致（用于 copy 模式判断是否需要重写，避免无意义改动）。
 * - 文件：逐字节比较
 * - 目录：递归比较条目名与各自内容
 * 任一路径不存在或类型不同则返回 false。
 */
export async function pathsContentEqual(
  a: string,
  b: string,
): Promise<boolean> {
  let sa: Awaited<ReturnType<typeof fs.lstat>>;
  let sb: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    sa = await fs.lstat(a);
    sb = await fs.lstat(b);
  } catch {
    return false;
  }

  if (sa.isDirectory() !== sb.isDirectory()) {
    return false;
  }

  if (sa.isDirectory()) {
    const [ea, eb] = await Promise.all([fs.readdir(a), fs.readdir(b)]);
    if (ea.length !== eb.length) {
      return false;
    }
    const na = [...ea].sort();
    const nb = [...eb].sort();
    for (let i = 0; i < na.length; i += 1) {
      if (na[i] !== nb[i]) {
        return false;
      }
    }
    for (const name of na) {
      if (!(await pathsContentEqual(path.join(a, name), path.join(b, name)))) {
        return false;
      }
    }
    return true;
  }

  // 普通文件（readFile 会跟随符号链接，得到真实内容再比较）
  const [ca, cb] = await Promise.all([fs.readFile(a), fs.readFile(b)]);
  return ca.equals(cb);
}
