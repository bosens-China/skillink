import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { addToGitignore } from '../src/utils/gitignore.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'skillink-gitignore-test-'),
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

describe('addToGitignore', () => {
  it('同一轮传入重复条目时只追加一次', async () => {
    const root = await createTempDir();
    const result = await addToGitignore(root, [
      '.claude',
      '.claude',
      'CLAUDE.md',
    ]);
    const content = await fs.readFile(path.join(root, '.gitignore'), 'utf-8');

    expect(result.added).toEqual(['.claude', 'CLAUDE.md']);
    expect(result.skipped).toEqual([]);
    expect(content).toBe('.claude\nCLAUDE.md\n');
  });

  it('已存在条目应跳过，不重复追加', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, '.gitignore'), '.claude\n');

    const result = await addToGitignore(root, ['.claude', 'CLAUDE.md']);
    const content = await fs.readFile(path.join(root, '.gitignore'), 'utf-8');

    expect(result.added).toEqual(['CLAUDE.md']);
    expect(result.skipped).toEqual(['.claude']);
    expect(content).toBe('.claude\nCLAUDE.md\n');
  });

  it('语义相同条目（反斜杠和末尾斜杠）应视为重复', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, '.gitignore'), '.cursor/rules\n');

    const result = await addToGitignore(root, [
      '.cursor\\rules\\',
      '.cursor/rules/',
    ]);
    const content = await fs.readFile(path.join(root, '.gitignore'), 'utf-8');

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(['.cursor/rules']);
    expect(content).toBe('.cursor/rules\n');
  });
});
