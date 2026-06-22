import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { CopyManifest } from '../types/index.js';
import { COPY_MANIFEST_FILE } from '../core/constants.js';

function manifestPath(root: string): string {
  return path.join(root, COPY_MANIFEST_FILE);
}

/**
 * 读取 copy 清单中的目标路径集合；不存在或损坏时返回空数组
 */
export async function readCopyManifest(root: string): Promise<string[]> {
  const p = manifestPath(root);
  if (!existsSync(p)) {
    return [];
  }
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(raw) as CopyManifest;
    if (data.version !== 1 || !Array.isArray(data.files)) {
      return [];
    }
    return [
      ...new Set(data.files.map((f) => f.split(path.sep).join('/'))),
    ].sort();
  } catch {
    return [];
  }
}

/**
 * 以「本轮实际产出」整体覆盖 copy 清单并原子写入。
 * - 列表为空时：若清单文件存在则删除，避免留下空文件
 * - 否则：写入排序后的目标列表
 */
export async function writeCopyManifest(
  root: string,
  targets: string[],
): Promise<void> {
  const p = manifestPath(root);
  const normalized = [
    ...new Set(
      targets
        .map((f) => f.split(path.sep).join('/').replace(/^\//, ''))
        .filter(Boolean),
    ),
  ].sort();

  if (normalized.length === 0) {
    if (existsSync(p)) {
      await fs.rm(p, { force: true });
    }
    return;
  }

  const manifest: CopyManifest = { version: 1, files: normalized };
  const tmp = `${p}.${process.pid}.tmp`;
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(tmp, json, 'utf-8');
  await fs.rename(tmp, p);
}
