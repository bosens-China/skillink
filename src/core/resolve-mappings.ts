import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { globby } from 'globby';
import type {
  AgentsMarkdownRule,
  AgentsSkillsRule,
  LinkMapping,
  SkillinkConfig,
} from '@/types/index.js';

const GLOB_CHARS = /[*?[\]{}]/;

function isGlobPattern(p: string): boolean {
  return GLOB_CHARS.test(p);
}

/** 规范为相对 root 的 POSIX 路径，供 LinkMapping 使用 */
function toRelPosix(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

/**
 * 将 agentsMarkdown 规则展开为多条 LinkMapping（遵守 gitignore，含嵌套 .gitignore）
 */
async function expandAgentsMarkdown(
  root: string,
  rule: AgentsMarkdownRule,
): Promise<LinkMapping[]> {
  if (rule.to.length === 0) {
    return [];
  }

  // 无 glob 元字符时直接 stat，避免部分环境下对点目录/文件的匹配差异
  if (!isGlobPattern(rule.from)) {
    const absSource = path.resolve(root, rule.from);
    if (!existsSync(absSource)) {
      return [];
    }
    const st = await fs.lstat(absSource);
    if (!st.isFile()) {
      return [];
    }
    const relPosix = toRelPosix(root, absSource);
    const sourceDir = path.dirname(absSource);
    const out: LinkMapping[] = [];
    for (const toPart of rule.to) {
      const absTo = path.resolve(sourceDir, toPart);
      out.push({
        from: relPosix,
        to: toRelPosix(root, absTo),
      });
    }
    return out;
  }

  const matches = await globby([rule.from], {
    cwd: root,
    gitignore: true,
    onlyFiles: true,
    dot: true,
  });

  const out: LinkMapping[] = [];
  for (const rel of matches) {
    const relPosix = rel.split(path.sep).join('/');
    const absSource = path.resolve(root, rel);
    const sourceDir = path.dirname(absSource);
    for (const toPart of rule.to) {
      const absTo = path.resolve(sourceDir, toPart);
      out.push({
        from: relPosix,
        to: toRelPosix(root, absTo),
      });
    }
  }
  return out;
}

/**
 * 将 agentsSkills 规则展开（仅目录）
 */
async function expandAgentsSkills(
  root: string,
  rule: AgentsSkillsRule,
): Promise<LinkMapping[]> {
  if (rule.to.length === 0) {
    return [];
  }

  if (!isGlobPattern(rule.from)) {
    const absSourceDir = path.resolve(root, rule.from);
    if (!existsSync(absSourceDir)) {
      return [];
    }
    const st = await fs.lstat(absSourceDir);
    if (!st.isDirectory()) {
      return [];
    }
    const relPosix = toRelPosix(root, absSourceDir);
    // 目标与源「目录」同级：.agents -> .claude 表示根目录下的 .claude
    const parentDir = path.dirname(absSourceDir);
    const out: LinkMapping[] = [];
    for (const toPart of rule.to) {
      const absTo = path.resolve(parentDir, toPart);
      out.push({
        from: relPosix,
        to: toRelPosix(root, absTo),
      });
    }
    return out;
  }

  const matches = await globby([rule.from], {
    cwd: root,
    gitignore: true,
    onlyDirectories: true,
    dot: true,
  });

  const out: LinkMapping[] = [];
  for (const rel of matches) {
    const relPosix = rel.split(path.sep).join('/');
    const absSourceDir = path.resolve(root, rel);
    const parentDir = path.dirname(absSourceDir);
    for (const toPart of rule.to) {
      const absTo = path.resolve(parentDir, toPart);
      out.push({
        from: relPosix,
        to: toRelPosix(root, absTo),
      });
    }
  }
  return out;
}

/**
 * 字面量 links（不支持 glob）
 */
function expandLiteralLinks(root: string, links: LinkMapping[]): LinkMapping[] {
  const out: LinkMapping[] = [];
  for (const link of links) {
    const fromAbs = path.resolve(root, link.from);
    if (!existsSync(fromAbs)) {
      continue;
    }
    out.push({
      from: toRelPosix(root, fromAbs),
      to: toRelPosix(root, path.resolve(root, link.to)),
    });
  }
  return out;
}

function dedupeMappings(mappings: LinkMapping[]): LinkMapping[] {
  const seen = new Set<string>();
  const result: LinkMapping[] = [];
  for (const m of mappings) {
    const key = `${m.from}\0${m.to}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(m);
  }
  return result;
}

export interface ResolveLinkMappingsResult {
  mappings: LinkMapping[];
  /** 某条规则的 from 未匹配到任何路径时的提示（用于控制台警告） */
  warnings: string[];
}

/**
 * 将完整配置解析为扁平符号链接映射列表
 */
export async function resolveLinkMappings(
  root: string,
  config: SkillinkConfig,
): Promise<ResolveLinkMappingsResult> {
  const all: LinkMapping[] = [];
  const warnings: string[] = [];

  for (const rule of config.agentsMarkdown ?? []) {
    const part = await expandAgentsMarkdown(root, rule);
    if (part.length === 0 && rule.to.length > 0) {
      warnings.push(`agentsMarkdown.from "${rule.from}"`);
    }
    all.push(...part);
  }

  for (const rule of config.agentsSkills ?? []) {
    const part = await expandAgentsSkills(root, rule);
    if (part.length === 0 && rule.to.length > 0) {
      warnings.push(`agentsSkills.from "${rule.from}"`);
    }
    all.push(...part);
  }

  if (config.links?.length) {
    all.push(...expandLiteralLinks(root, config.links));
  }

  return { mappings: dedupeMappings(all), warnings };
}
