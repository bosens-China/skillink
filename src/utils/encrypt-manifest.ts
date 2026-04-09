import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { EncryptManifest } from '../types/index.js';
import { ENCRYPT_MANIFEST_FILE } from '../core/constants.js';

/**
 * 将路径规范为相对项目根的 POSIX 风格（供清单存储）
 */
export function toManifestRelPath(root: string, filePath: string): string {
  const abs = path.resolve(root, filePath);
  return path.relative(root, abs).split(path.sep).join('/');
}

function manifestPath(root: string): string {
  return path.join(root, ENCRYPT_MANIFEST_FILE);
}

/**
 * 读取加密清单；不存在或损坏时返回 null
 */
export async function readEncryptManifest(
  root: string,
): Promise<EncryptManifest | null> {
  const p = manifestPath(root);
  if (!existsSync(p)) {
    return null;
  }
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(raw) as EncryptManifest;
    if (data.version !== 1 || !Array.isArray(data.files)) {
      return null;
    }
    return {
      version: 1,
      files: [
        ...new Set(data.files.map((f) => f.split(path.sep).join('/'))),
      ].sort(),
    };
  } catch {
    return null;
  }
}

/**
 * 合并路径到清单并原子写入
 */
export async function mergeEncryptManifestFiles(
  root: string,
  newRelPaths: string[],
): Promise<void> {
  const normalized = newRelPaths
    .map((f) => f.split(path.sep).join('/').replace(/^\//, ''))
    .filter(Boolean);
  const existing = await readEncryptManifest(root);
  const merged = new Set<string>([...(existing?.files ?? []), ...normalized]);
  const manifest: EncryptManifest = {
    version: 1,
    files: [...merged].sort(),
  };
  const p = manifestPath(root);
  const tmp = `${p}.${process.pid}.tmp`;
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(tmp, json, 'utf-8');
  await fs.rename(tmp, p);
}
