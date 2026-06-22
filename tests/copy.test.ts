import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Linker } from '../src/core/linker.js';
import type { LinkerConfig } from '../src/types/index.js';
import { COPY_MANIFEST_FILE } from '../src/core/constants.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillink-copy-test-'));
  tempDirs.push(dir);
  return dir;
}

async function isSymlink(p: string) {
  try {
    return (await fs.lstat(p)).isSymbolicLink();
  } catch {
    return false;
  }
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

describe('Linker.sync copy 模式', () => {
  it('copy 文件：生成真实文件而非符号链接，内容一致', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }],
    };

    const result = await new Linker(root, config).sync();
    expect(result.created).toBe(1);

    const to = path.join(root, 'CLAUDE.md');
    expect(await isSymlink(to)).toBe(false);
    expect(await fs.readFile(to, 'utf-8')).toBe('# Agents');

    // 写入 copy 清单
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, COPY_MANIFEST_FILE), 'utf-8'),
    );
    expect(manifest.files).toContain('CLAUDE.md');
  });

  it('copy 目录：递归复制真实内容', async () => {
    const root = await createTempDir();
    await fs.mkdir(path.join(root, '.agents', 'sub'), { recursive: true });
    await fs.writeFile(path.join(root, '.agents', 'a.md'), 'a');
    await fs.writeFile(path.join(root, '.agents', 'sub', 'b.md'), 'b');

    const config: LinkerConfig = {
      links: [{ from: '.agents', to: '.claude', mode: 'copy' }],
    };

    await new Linker(root, config).sync();

    expect(await isSymlink(path.join(root, '.claude'))).toBe(false);
    expect(await fs.readFile(path.join(root, '.claude', 'a.md'), 'utf-8')).toBe(
      'a',
    );
    expect(
      await fs.readFile(path.join(root, '.claude', 'sub', 'b.md'), 'utf-8'),
    ).toBe('b');
  });

  it('幂等：内容未变时第二次返回 reused', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');
    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }],
    };

    await new Linker(root, config).sync();
    const second = await new Linker(root, config).sync();
    expect(second.reused).toBe(1);
    expect(second.created).toBe(0);
  });

  it('源内容变化后再次同步会更新副本', async () => {
    const root = await createTempDir();
    const from = path.join(root, 'AGENTS.md');
    await fs.writeFile(from, 'v1');
    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }],
    };

    await new Linker(root, config).sync();
    await fs.writeFile(from, 'v2');
    const result = await new Linker(root, config).sync();

    expect(result.created).toBe(1);
    expect(await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf-8')).toBe('v2');
  });

  it('源被删除后再次同步：清理孤儿副本并更新清单', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');
    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }],
    };

    await new Linker(root, config).sync();
    expect(await exists(path.join(root, 'CLAUDE.md'))).toBe(true);

    // 源不存在 → 该映射被跳过，孤儿副本应被清理
    await fs.rm(path.join(root, 'AGENTS.md'));
    await new Linker(root, config).sync();

    expect(await exists(path.join(root, 'CLAUDE.md'))).toBe(false);
    // 清单清空后文件被移除
    expect(await exists(path.join(root, COPY_MANIFEST_FILE))).toBe(false);
  });

  it('silent 模式遇到用户已有真实文件冲突时跳过', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '源内容');
    // 用户已有的、非 skillink 生成的目标文件
    await fs.writeFile(path.join(root, 'CLAUDE.md'), '用户自己的内容');

    const config: LinkerConfig = {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }],
    };

    const result = await new Linker(root, config, { silent: true }).sync();
    expect(result.skipped).toBe(1);
    // 用户文件保持不变
    expect(await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf-8')).toBe(
      '用户自己的内容',
    );
  });

  it('symlink → copy 切换：确认后把旧链接替换为真实副本', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    // 先用 symlink 模式生成链接
    await new Linker(root, {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'symlink' }],
    }).sync();
    expect(await isSymlink(path.join(root, 'CLAUDE.md'))).toBe(true);

    // 切换到 copy 模式（autoConfirm 跳过模式切换确认）
    const result = await new Linker(
      root,
      { links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }] },
      { autoConfirm: true },
    ).sync();

    expect(result.created).toBe(1);
    expect(await isSymlink(path.join(root, 'CLAUDE.md'))).toBe(false);
    expect(await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf-8')).toBe(
      '# Agents',
    );
  });

  it('copy → symlink 切换：自有副本不报冲突，转换为软链接', async () => {
    const root = await createTempDir();
    await fs.writeFile(path.join(root, 'AGENTS.md'), '# Agents');

    // 先用 copy 模式生成真实文件（写入 copy 清单）
    await new Linker(root, {
      links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'copy' }],
    }).sync();
    expect(await isSymlink(path.join(root, 'CLAUDE.md'))).toBe(false);

    // 切回 symlink 模式：因目标在 copy 清单中，应识别为模式切换而非用户文件冲突
    const result = await new Linker(
      root,
      { links: [{ from: 'AGENTS.md', to: 'CLAUDE.md', mode: 'symlink' }] },
      { autoConfirm: true },
    ).sync();

    expect(result.created).toBe(1);
    expect(await isSymlink(path.join(root, 'CLAUDE.md'))).toBe(true);
    // copy 清单已清空（不再有 copy 目标）
    expect(await exists(path.join(root, COPY_MANIFEST_FILE))).toBe(false);
  });
});
