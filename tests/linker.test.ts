import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Linker } from '../src/core/linker.js';
import type { LinkerConfig } from '../src/types/index.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillink-linker-test-'));
  tempDirs.push(dir);
  return dir;
}

async function exists(p: string) {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe('Linker.sync', () => {
  it('文件映射：创建符号链接', async () => {
    const root = await createTempDir();
    const agentsMd = path.join(root, 'AGENTS.md');
    await fs.writeFile(agentsMd, '# Agents');

    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
    };

    const linker = new Linker(root, config);
    const result = await linker.sync();
    expect(result.created).toBe(1);

    const claudeMd = path.join(root, 'CLAUDE.md');
    expect(await exists(claudeMd)).toBe(true);
    const linkTarget = await fs.readlink(claudeMd);
    const absTarget = path.resolve(path.dirname(claudeMd), linkTarget);
    expect(absTarget).toBe(path.resolve(agentsMd));
  });

  it('目录映射：整个目录符号链接到目标', async () => {
    const root = await createTempDir();
    const agentsDir = path.join(root, '.agents');
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(path.join(agentsDir, 'file1.md'), '# File 1');
    await fs.writeFile(path.join(agentsDir, 'file2.md'), '# File 2');

    const config: LinkerConfig = {
      links: [{ from: '.agents', to: '.claude' }],
    };

    const linker = new Linker(root, config);
    await linker.sync();

    const claudeLink = path.join(root, '.claude');
    expect(await exists(claudeLink)).toBe(true);

    const linkTarget = await fs.readlink(claudeLink);
    const absTarget = path.resolve(path.dirname(claudeLink), linkTarget);
    expect(absTarget).toBe(path.resolve(agentsDir));

    const content = await fs.readFile(
      path.join(claudeLink, 'file1.md'),
      'utf-8',
    );
    expect(content).toBe('# File 1');
  });

  it('幂等性：重复执行返回 reused', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
    };

    const linker = new Linker(root, config);
    const first = await linker.sync();
    expect(first.created).toBe(1);

    const second = await linker.sync();
    expect(second.created).toBe(0);
    expect(second.reused).toBe(1);

    expect(await exists(path.join(root, 'CLAUDE.md'))).toBe(true);
  });

  it('跳过不存在的源路径', async () => {
    const root = await createTempDir();

    const config: LinkerConfig = {
      links: [{ from: 'nonexistent.txt', to: 'output.txt' }],
    };

    const linker = new Linker(root, config);
    const result = await linker.sync();
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);

    expect(await exists(path.join(root, 'output.txt'))).toBe(false);
  });

  it('一对多映射：一个源链接到多个目标', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    const config: LinkerConfig = {
      links: [
        { from: 'AGENTS.md', to: 'CLAUDE.md' },
        { from: 'AGENTS.md', to: 'nested/rules/AGENTS.md' },
      ],
    };

    const linker = new Linker(root, config);
    const result = await linker.sync();
    expect(result.created).toBe(2);

    expect(await exists(path.join(root, 'CLAUDE.md'))).toBe(true);
    expect(await exists(path.join(root, 'nested', 'rules', 'AGENTS.md'))).toBe(
      true,
    );
  });

  it('--yes 模式下目标目录已存在且非链接时抛错', async () => {
    const root = await createTempDir();
    await fs.mkdir(path.join(root, '.agents'), { recursive: true });
    await fs.mkdir(path.join(root, '.claude'), { recursive: true });

    const config: LinkerConfig = {
      links: [{ from: '.agents', to: '.claude' }],
    };

    const linker = new Linker(root, config, { autoConfirm: true });

    await expect(linker.sync()).rejects.toThrow(
      '目标目录已存在且不是符号链接，--yes 模式下不会自动删除',
    );
  });

  it('--yes 模式下目标文件类型不匹配时报中文错', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');
    await fs.mkdir(path.join(root, 'CLAUDE.md'), { recursive: true });

    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
    };

    const linker = new Linker(root, config, { autoConfirm: true });

    await expect(linker.sync()).rejects.toThrow(
      '目标目录已存在且不是符号链接，--yes 模式下不会自动删除',
    );
  });

  it('文件映射：源文件被替换后再次同步应重建链接', async () => {
    const root = await createTempDir();
    const fromPath = path.join(root, 'AGENTS.md');
    const toPath = path.join(root, 'CLAUDE.md');
    await fs.writeFile(fromPath, 'v1');

    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
    };

    const linker = new Linker(root, config);
    await linker.sync();

    const tmpPath = path.join(root, 'AGENTS.tmp.md');
    await fs.writeFile(tmpPath, 'v2');
    await fs.rename(tmpPath, fromPath);

    await linker.sync();
    const content = await fs.readFile(toPath, 'utf-8');
    expect(content).toBe('v2');
  });
});
