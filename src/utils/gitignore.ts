import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * 规范化 .gitignore 条目，避免语义相同但写法不同导致重复
 */
function normalizeGitignoreEntry(entry: string): string {
  const normalizedSlashes = entry.trim().replace(/\\/g, '/');
  if (normalizedSlashes === '/') {
    return normalizedSlashes;
  }
  return normalizedSlashes.replace(/\/+$/, '');
}

/**
 * 将目标路径收敛为一次性的 .gitignore 条目。
 * 例如任意层级的 pkg/a/CLAUDE.md 最终都只写入 CLAUDE.md 一次。
 */
export function collectGitignoreEntries(targets: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    const normalizedTarget = normalizeGitignoreEntry(target);
    if (!normalizedTarget) {
      continue;
    }

    const name = normalizeGitignoreEntry(path.posix.basename(normalizedTarget));
    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    result.push(name);
  }

  return result;
}

interface AddToGitignoreOptions {
  /** dryRun 模式只计算哪些会被新增，不实际写文件 */
  dryRun?: boolean;
}

/**
 * 将条目追加到 .gitignore（跳过已存在的条目）
 */
export async function addToGitignore(
  root: string,
  entries: string[],
  options: AddToGitignoreOptions = {},
): Promise<{ added: string[]; skipped: string[] }> {
  const gitignorePath = path.join(root, '.gitignore');
  const added: string[] = [];
  const skipped: string[] = [];

  let existingContent = '';
  if (existsSync(gitignorePath)) {
    existingContent = await fs.readFile(gitignorePath, 'utf-8');
  }

  const existingLines = existingContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const existingNormalized = new Set(
    existingLines.map((line) => normalizeGitignoreEntry(line)),
  );

  const linesToAdd: string[] = [];
  const normalizedEntries = Array.from(
    new Set(
      entries.map((entry) => normalizeGitignoreEntry(entry)).filter(Boolean),
    ),
  );
  for (const entry of normalizedEntries) {
    if (existingNormalized.has(entry)) {
      skipped.push(entry);
    } else {
      linesToAdd.push(entry);
      added.push(entry);
      existingNormalized.add(entry);
    }
  }

  if (linesToAdd.length > 0 && !options.dryRun) {
    const prefix =
      existingContent.endsWith('\n') || existingContent === '' ? '' : '\n';
    const block = prefix + linesToAdd.join('\n') + '\n';
    await fs.appendFile(gitignorePath, block, 'utf-8');
  }

  return { added, skipped };
}

/**
 * 从 .gitignore 删除指定条目（按规范化后的整行匹配）。
 * 用于 copy 模式目标：它们的初衷是被提交，不应继续被忽略。
 * dryRun 时只计算将被删除的条目，不写文件。
 */
export async function removeFromGitignore(
  root: string,
  entries: string[],
  options: AddToGitignoreOptions = {},
): Promise<{ removed: string[] }> {
  const gitignorePath = path.join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    return { removed: [] };
  }

  const targets = new Set(
    entries.map((entry) => normalizeGitignoreEntry(entry)).filter(Boolean),
  );
  if (targets.size === 0) {
    return { removed: [] };
  }

  const content = await fs.readFile(gitignorePath, 'utf-8');
  const removed: string[] = [];
  const keptLines: string[] = [];

  for (const line of content.split('\n')) {
    // 注释、空行原样保留；仅删除与目标完全匹配（规范化后）的规则行
    const isRule = line.trim() && !line.trim().startsWith('#');
    if (isRule && targets.has(normalizeGitignoreEntry(line))) {
      removed.push(normalizeGitignoreEntry(line));
      continue;
    }
    keptLines.push(line);
  }

  if (removed.length > 0 && !options.dryRun) {
    await fs.writeFile(gitignorePath, keptLines.join('\n'), 'utf-8');
  }

  return { removed };
}
