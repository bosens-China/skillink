import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { syncCommand } from '../src/commands/sync.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillink-sync-test-'));
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

describe('syncCommand', () => {
  it('已有配置文件时只按配置执行，不再写入 .gitignore', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents', 'utf-8');
    await fs.writeFile(
      path.join(root, 'skillink.config.mjs'),
      `export default {
  agentsMarkdown: [
    {
      from: 'AGENTS.md',
      to: ['CLAUDE.md'],
    },
  ],
};
`,
      'utf-8',
    );

    await syncCommand({ cwd: root, yes: true });

    expect(existsSync(path.join(root, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(path.join(root, '.gitignore'))).toBe(false);
  });

  it('首次初始化时只写一次目标名到 .gitignore', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Root', 'utf-8');
    await fs.mkdir(path.join(root, 'packages', 'demo'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'packages', 'demo', 'AGENTS.md'),
      '# Nested',
      'utf-8',
    );
    await fs.mkdir(path.join(root, '.agents'), { recursive: true });

    await syncCommand({ cwd: root, yes: true });

    const gitignoreContent = await fs.readFile(
      path.join(root, '.gitignore'),
      'utf-8',
    );
    expect(existsSync(path.join(root, 'skillink.config.ts'))).toBe(true);
    expect(gitignoreContent.trim().split('\n')).toEqual([
      'CLAUDE.md',
      '.claude',
    ]);
  });
});
