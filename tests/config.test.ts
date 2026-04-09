import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/core/config.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillink-config-test-'));
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

describe('loadConfig', () => {
  it('export default {} 不合并默认值，解析为空配置', async () => {
    const root = await createTempDir();
    await fs.writeFile(
      path.join(root, 'skillink.config.mjs'),
      'export default {}\n',
      'utf-8',
    );
    const cfg = await loadConfig(root);
    expect(cfg).toEqual({});
  });

  it('无配置文件时返回空对象', async () => {
    const root = await createTempDir();
    const cfg = await loadConfig(root);
    expect(cfg).toEqual({});
  });
});
