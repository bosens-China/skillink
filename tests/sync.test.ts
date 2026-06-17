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
  it('--yes 模式下：缺失的 gitignore 条目会被自动追加', async () => {
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
    const gitignoreContent = await fs.readFile(
      path.join(root, '.gitignore'),
      'utf-8',
    );
    expect(gitignoreContent).toContain('CLAUDE.md');
  });

  it('--yes 模式下：已有的 gitignore 条目不会重复追加', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents', 'utf-8');
    await fs.writeFile(path.join(root, '.gitignore'), 'CLAUDE.md\n', 'utf-8');
    await fs.writeFile(
      path.join(root, 'skillink.config.mjs'),
      `export default {
  agentsMarkdown: [{ from: 'AGENTS.md', to: ['CLAUDE.md'] }],
};
`,
      'utf-8',
    );

    await syncCommand({ cwd: root, yes: true });

    const gitignoreContent = await fs.readFile(
      path.join(root, '.gitignore'),
      'utf-8',
    );
    expect(gitignoreContent).toBe('CLAUDE.md\n');
  });

  it('首次初始化时按检测方向生成配置 + .gitignore', async () => {
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

    expect(existsSync(path.join(root, 'skillink.config.ts'))).toBe(true);
    const gitignoreContent = await fs.readFile(
      path.join(root, '.gitignore'),
      'utf-8',
    );
    expect(gitignoreContent.trim().split('\n').sort()).toEqual(
      ['CLAUDE.md', '.claude'].sort(),
    );
  });

  it('反向检测：只有 .claude / CLAUDE.md 时生成反向模板', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'CLAUDE.md'), '# Claude', 'utf-8');
    await fs.mkdir(path.join(root, '.claude'), { recursive: true });

    await syncCommand({ cwd: root, yes: true });

    const generated = await fs.readFile(
      path.join(root, 'skillink.config.ts'),
      'utf-8',
    );
    expect(generated).toContain("from: '**/CLAUDE.md'");
    expect(generated).toContain("to: ['AGENTS.md']");
    expect(generated).toContain("from: '.claude'");

    expect(existsSync(path.join(root, 'AGENTS.md'))).toBe(true);
    expect(existsSync(path.join(root, '.agents'))).toBe(true);
  });

  it('--dry-run 不写文件系统', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents', 'utf-8');
    await fs.writeFile(
      path.join(root, 'skillink.config.mjs'),
      `export default {
  agentsMarkdown: [{ from: 'AGENTS.md', to: ['CLAUDE.md'] }],
};
`,
      'utf-8',
    );

    await syncCommand({ cwd: root, yes: true, dryRun: true });

    expect(existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(path.join(root, '.gitignore'))).toBe(false);
  });
});
