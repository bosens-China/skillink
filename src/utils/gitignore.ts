import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * 将条目追加到 .gitignore（跳过已存在的条目）
 */
export async function addToGitignore(
  root: string,
  entries: string[],
): Promise<{ added: string[]; skipped: string[] }> {
  const gitignorePath = path.join(root, '.gitignore');
  const added: string[] = [];
  const skipped: string[] = [];

  let existingContent = '';
  if (existsSync(gitignorePath)) {
    existingContent = await fs.readFile(gitignorePath, 'utf-8');
  }

  const existingLines = new Set(
    existingContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );

  const linesToAdd: string[] = [];
  for (const entry of entries) {
    if (existingLines.has(entry)) {
      skipped.push(entry);
    } else {
      linesToAdd.push(entry);
      added.push(entry);
    }
  }

  if (linesToAdd.length > 0) {
    const prefix = existingContent.endsWith('\n') || existingContent === '' ? '' : '\n';
    const block = prefix + linesToAdd.join('\n') + '\n';
    await fs.appendFile(gitignorePath, block, 'utf-8');
  }

  return { added, skipped };
}
