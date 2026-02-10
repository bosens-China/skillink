import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createSymlink } from '../src/utils/fs.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillink-fs-test-'));
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

describe('createSymlink', () => {
  it('可以修复失效符号链接', async () => {
    const root = await createTempDir();
    const sourceDir = path.join(root, 'source-skill');
    const brokenTarget = path.join(root, 'target-skill');

    await fs.mkdir(sourceDir, { recursive: true });

    // 先创建一个指向不存在目录的失效链接
    await fs.symlink(path.join(root, 'missing-skill'), brokenTarget, 'dir');

    await createSymlink(sourceDir, brokenTarget);

    const nextLinkTarget = await fs.readlink(brokenTarget);
    const absNextLinkTarget = path.resolve(
      path.dirname(brokenTarget),
      nextLinkTarget,
    );
    expect(absNextLinkTarget).toBe(path.resolve(sourceDir));
  });
});
