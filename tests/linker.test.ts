import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Linker } from '../src/core/linker.js';
import type { SkillinkConfig } from '../src/types/index.js';

const tempDirs: string[] = [];
const canRunFileSymlinkCases = process.platform !== 'win32';

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
  it.skipIf(!canRunFileSymlinkCases)('文件映射：创建符号链接', async () => {
    const root = await createTempDir();
    const agentsMd = path.join(root, 'AGENTS.md');
    await fs.writeFile(agentsMd, '# Agents');

    const config: SkillinkConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
    };

    const linker = new Linker(root, config);
    await linker.sync();

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

    const config: SkillinkConfig = {
      links: [{ from: '.agents', to: '.claude' }],
    };

    const linker = new Linker(root, config);
    await linker.sync();

    const claudeLink = path.join(root, '.claude');
    expect(await exists(claudeLink)).toBe(true);

    // 验证 .claude 是一个符号链接，指向 .agents
    const linkTarget = await fs.readlink(claudeLink);
    const absTarget = path.resolve(path.dirname(claudeLink), linkTarget);
    expect(absTarget).toBe(path.resolve(agentsDir));

    // 通过符号链接可以访问源目录内的文件
    const content = await fs.readFile(path.join(claudeLink, 'file1.md'), 'utf-8');
    expect(content).toBe('# File 1');
  });

  it.skipIf(!canRunFileSymlinkCases)('幂等性：重复执行不报错', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    const config: SkillinkConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
    };

    const linker = new Linker(root, config);
    await linker.sync();
    await linker.sync(); // 第二次执行不应报错

    expect(await exists(path.join(root, 'CLAUDE.md'))).toBe(true);
  });

  it('跳过不存在的源路径', async () => {
    const root = await createTempDir();

    const config: SkillinkConfig = {
      links: [{ from: 'nonexistent.txt', to: 'output.txt' }],
    };

    const linker = new Linker(root, config);
    await linker.sync(); // 不应抛出错误

    expect(await exists(path.join(root, 'output.txt'))).toBe(false);
  });

  it.skipIf(!canRunFileSymlinkCases)('一对多映射：一个源链接到多个目标', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    const config: SkillinkConfig = {
      links: [
        { from: 'AGENTS.md', to: 'CLAUDE.md' },
        { from: 'AGENTS.md', to: '.cursor/rules/AGENTS.md' },
      ],
    };

    const linker = new Linker(root, config);
    await linker.sync();

    expect(await exists(path.join(root, 'CLAUDE.md'))).toBe(true);
    expect(await exists(path.join(root, '.cursor', 'rules', 'AGENTS.md'))).toBe(true);
  });

  it('--yes 模式下目标目录已存在且非链接时抛错', async () => {
    const root = await createTempDir();
    await fs.mkdir(path.join(root, '.agents'), { recursive: true });
    await fs.mkdir(path.join(root, '.claude'), { recursive: true });

    const config: SkillinkConfig = {
      links: [{ from: '.agents', to: '.claude' }],
      locale: 'en',
    };

    const linker = new Linker(
      root,
      config,
      { autoConfirm: true, locale: 'en', configLocale: 'en' },
    );

    await expect(linker.sync()).rejects.toThrow(
      'Target directory exists and is not a symlink; in --yes mode it will not be deleted automatically',
    );
  });

  it('类型不匹配时根据 auto 输出双语报错', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');
    await fs.mkdir(path.join(root, 'CLAUDE.md'), { recursive: true });

    const config: SkillinkConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md' }],
      locale: 'auto',
    };

    const linker = new Linker(
      root,
      config,
      { locale: 'zh-CN', configLocale: 'auto' },
    );

    await expect(linker.sync()).rejects.toThrow(
      '目标路径已存在且类型不匹配：源是文件，目标是目录',
    );
    await expect(linker.sync()).rejects.toThrow(
      'Target path exists with mismatched type: source is file, target is directory',
    );
  });
});
