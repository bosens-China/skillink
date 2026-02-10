import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Linker } from '../src/core/linker.js';
import type { SkillinkConfig } from '../src/types/index.js';

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

describe('Linker.cleanAll', () => {
  it('会清理所有配置目标（包括 disabled 目标）', async () => {
    const root = await createTempDir();
    const sourceDir = path.join(root, '.agents', 'skills');
    const skillDir = path.join(sourceDir, 'demo-skill');
    const enabledTargetDir = path.join(root, '.cursor', 'rules');
    const disabledTargetDir = path.join(root, '.gemini', 'skills');

    await fs.mkdir(skillDir, { recursive: true });
    await fs.mkdir(enabledTargetDir, { recursive: true });
    await fs.mkdir(disabledTargetDir, { recursive: true });

    const enabledLink = path.join(enabledTargetDir, 'demo-skill');
    const disabledLink = path.join(disabledTargetDir, 'demo-skill');
    await fs.symlink(skillDir, enabledLink, 'dir');
    await fs.symlink(skillDir, disabledLink, 'dir');

    const config: SkillinkConfig = {
      source: '.agents/skills',
      targets: [
        { name: 'cursor', path: '.cursor/rules', enabled: true },
        { name: 'gemini', path: '.gemini/skills', enabled: false },
      ],
    };

    const linker = new Linker(root, config);
    await linker.cleanAll();

    expect(await exists(enabledLink)).toBe(false);
    expect(await exists(disabledLink)).toBe(false);
  });

  it('不会误删 source 同前缀目录的链接', async () => {
    const root = await createTempDir();
    const sourceDir = path.join(root, '.agents', 'skills');
    const backupDir = path.join(root, '.agents', 'skills-backup');
    const targetDir = path.join(root, '.cursor', 'rules');

    await fs.mkdir(path.join(sourceDir, 'demo-skill'), { recursive: true });
    await fs.mkdir(path.join(backupDir, 'backup-skill'), { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    const backupLink = path.join(targetDir, 'backup-skill');
    await fs.symlink(path.join(backupDir, 'backup-skill'), backupLink, 'dir');

    const config: SkillinkConfig = {
      source: '.agents/skills',
      targets: [{ name: 'cursor', path: '.cursor/rules', enabled: true }],
    };

    const linker = new Linker(root, config);
    await linker.cleanAll();

    expect(await exists(backupLink)).toBe(true);
  });
});
