import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveLinkMappings } from '../src/core/resolve-mappings.js';
import type { SkillinkConfig } from '../src/types/index.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'skillink-resolve-test-'),
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

describe('resolveLinkMappings', () => {
  it('agentsMarkdown：展开多路径并对每个 to 生成映射', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), 'a');
    await fs.mkdir(path.join(root, 'pkg', 'a'), { recursive: true });
    await fs.writeFile(path.join(root, 'pkg', 'a', 'AGENTS.md'), 'b');

    const config: SkillinkConfig = {
      agentsMarkdown: [{ from: '**/AGENTS.md', to: ['CLAUDE.md'] }],
      agentsSkills: [],
    };

    const { mappings, warnings } = await resolveLinkMappings(root, config);
    expect(warnings).toEqual([]);
    const froms = mappings.map((m) => m.from).sort();
    expect(froms).toEqual(['AGENTS.md', 'pkg/a/AGENTS.md'].sort());
    expect(mappings.find((m) => m.from === 'AGENTS.md')?.to).toBe('CLAUDE.md');
    expect(mappings.find((m) => m.from === 'pkg/a/AGENTS.md')?.to).toBe(
      path.join('pkg', 'a', 'CLAUDE.md').split(path.sep).join('/'),
    );
  });

  it('遵守根目录 .gitignore：被 ignore 的路径不参与', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, '.gitignore'), 'dist/\n');
    await fs.mkdir(path.join(root, 'dist'), { recursive: true });
    await fs.writeFile(path.join(root, 'dist', 'AGENTS.md'), 'x');
    await fs.writeFile(path.join(root, 'AGENTS.md'), 'ok');

    const config: SkillinkConfig = {
      agentsMarkdown: [{ from: '**/AGENTS.md', to: ['OUT.md'] }],
      agentsSkills: [],
    };

    const { mappings } = await resolveLinkMappings(root, config);
    const froms = mappings.map((m) => m.from).sort();
    expect(froms).toEqual(['AGENTS.md']);
  });

  it('agentsSkills：目录映射到相对目标', async () => {
    const root = await createTempDir();
    await fs.mkdir(path.join(root, '.agents'), { recursive: true });

    const config: SkillinkConfig = {
      agentsMarkdown: [],
      agentsSkills: [{ from: '.agents', to: ['.claude'] }],
    };

    const { mappings } = await resolveLinkMappings(root, config);
    expect(mappings).toEqual([{ from: '.agents', to: '.claude' }]);
  });

  it('links：字面量补充映射', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'extra.txt'), 'x');

    const config: SkillinkConfig = {
      agentsMarkdown: [],
      agentsSkills: [],
      links: [{ from: 'extra.txt', to: 'extra.link.txt' }],
    };

    const { mappings } = await resolveLinkMappings(root, config);
    expect(mappings).toContainEqual({
      from: 'extra.txt',
      to: 'extra.link.txt',
    });
  });

  it('未匹配任何源时产生 warnings', async () => {
    const root = await createTempDir();

    const config: SkillinkConfig = {
      agentsMarkdown: [{ from: '**/NOPE.md', to: ['a.md'] }],
      agentsSkills: [{ from: '**/NOPE_DIR', to: ['.x'] }],
    };

    const { mappings, warnings } = await resolveLinkMappings(root, config);
    expect(mappings).toEqual([]);
    expect(warnings.some((w) => w.includes('agentsMarkdown'))).toBe(true);
    expect(warnings.some((w) => w.includes('agentsSkills'))).toBe(true);
  });
});
