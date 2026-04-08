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
  it('文件链接可创建（Windows 下允许降级为硬链接）', async () => {
    const root = await createTempDir();
    const sourceFile = path.join(root, 'AGENTS.md');
    const targetFile = path.join(root, 'CLAUDE.md');
    await fs.writeFile(sourceFile, '# Agents');

    await createSymlink(sourceFile, targetFile);

    const content = await fs.readFile(targetFile, 'utf-8');
    expect(content).toBe('# Agents');
  });

  it('可以修复失效符号链接', async () => {
    const root = await createTempDir();
    const sourceDir = path.join(root, 'source-skill');
    const brokenTarget = path.join(root, 'target-skill');

    await fs.mkdir(sourceDir, { recursive: true });

    // 先创建一个指向不存在目录的失效链接
    // Windows 下使用 junction，避免普通 dir symlink 的权限限制
    await fs.symlink(
      path.join(root, 'missing-skill'),
      brokenTarget,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    await createSymlink(sourceDir, brokenTarget);

    const nextLinkTarget = await fs.readlink(brokenTarget);
    const absNextLinkTarget = path.resolve(
      path.dirname(brokenTarget),
      nextLinkTarget,
    );
    expect(absNextLinkTarget).toBe(path.resolve(sourceDir));
  });
});
