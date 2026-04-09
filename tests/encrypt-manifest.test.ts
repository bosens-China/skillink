import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  mergeEncryptManifestFiles,
  readEncryptManifest,
  toManifestRelPath,
} from '../src/utils/encrypt-manifest.js';
import { ENCRYPT_MANIFEST_FILE } from '../src/core/constants.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'skillink-encrypt-manifest-'),
  );
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe('encrypt-manifest', () => {
  it('mergeEncryptManifestFiles 写入并去重排序', async () => {
    const root = await createTempDir();
    await mergeEncryptManifestFiles(root, ['.mcp.json']);
    await mergeEncryptManifestFiles(root, ['.env', '.mcp.json']);

    const m = await readEncryptManifest(root);
    expect(m?.files).toEqual(['.env', '.mcp.json']);
  });

  it('toManifestRelPath 使用 POSIX 相对路径', async () => {
    const root = await createTempDir();
    const rel = toManifestRelPath(root, path.join(root, 'foo', 'bar.json'));
    expect(rel).toBe('foo/bar.json');
  });

  it('清单文件名为常量', () => {
    expect(ENCRYPT_MANIFEST_FILE).toBe('skillink.encrypt.json');
  });
});
