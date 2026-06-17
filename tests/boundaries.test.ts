import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { Linker } from '../src/core/linker.js';
import { resolveLinkMappings } from '../src/core/resolve-mappings.js';
import { decrypt } from '../src/utils/crypto.js';

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'skillink-boundary-test-'),
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

describe('Boundary Scenarios', () => {
  describe('Config & Mappings', () => {
    it('should handle completely empty config', async () => {
      const root = await createTempDir();
      const { mappings, warnings } = await resolveLinkMappings(root, {});
      expect(mappings).toEqual([]);
      expect(warnings).toEqual([]);

      const linker = new Linker(root, { links: mappings });
      const synced = await linker.sync();
      expect(synced.created).toBe(0);
      expect(synced.skipped).toBe(0);
    });

    it('should handle rules with empty to arrays', async () => {
      const root = await createTempDir();
      await fs.writeFile(path.join(root, 'AGENTS.md'), '# test');

      const { mappings } = await resolveLinkMappings(root, {
        agentsMarkdown: [{ from: 'AGENTS.md', to: [] }],
      });
      expect(mappings).toEqual([]);
    });

    it('should deduplicate identical mappings', async () => {
      const root = await createTempDir();
      await fs.writeFile(path.join(root, 'a.txt'), 'test');
      const { mappings } = await resolveLinkMappings(root, {
        links: [
          { from: 'a.txt', to: 'b.txt' },
          { from: 'a.txt', to: 'b.txt' },
        ],
      });
      // resolveLinkMappings 会对完全相同的映射去重
      expect(mappings.length).toBe(1);
    });
  });

  describe('Crypto Boundaries', () => {
    it('should throw on decryption of non-prefixed data', () => {
      expect(() => decrypt('not-a-lock-format', 'pwd')).toThrow(
        'Invalid encrypted format',
      );
    });

    it('should throw if salt/iv/tag segments are missing', () => {
      // v2:salt:iv:tag:data 一共需要 5 段
      expect(() => decrypt('v2:a:b:c', 'pwd')).toThrow(
        'Invalid encrypted format',
      );
    });
  });

  describe('FileSystem Boundaries', () => {
    it('should handle source being a symlink itself', async () => {
      const root = await createTempDir();
      const realFile = path.join(root, 'real.md');
      const sourceLink = path.join(root, 'link.md');
      const targetLink = path.join(root, 'target.md');

      await fs.writeFile(realFile, 'content');
      await fs.symlink(realFile, sourceLink);

      const linker = new Linker(root, {
        links: [{ from: 'link.md', to: 'target.md' }],
      });
      await linker.sync();

      // target.md 应该指向 link.md
      const target = await fs.readlink(targetLink);
      expect(path.resolve(root, target)).toBe(path.resolve(sourceLink));
    });

    it('should reject source paths escaping project root', async () => {
      const root = await createTempDir();

      await expect(
        resolveLinkMappings(root, {
          links: [{ from: '../skillink-secret.txt', to: 'leak.txt' }],
        }),
      ).rejects.toThrow('Mapping path cannot escape project root');
    });

    it('should reject target paths escaping project root', async () => {
      const root = await createTempDir();
      await fs.writeFile(path.join(root, 'AGENTS.md'), '# test');

      await expect(
        resolveLinkMappings(root, {
          agentsMarkdown: [{ from: 'AGENTS.md', to: ['../CLAUDE.md'] }],
        }),
      ).rejects.toThrow('Mapping path cannot escape project root');
    });
  });
});
