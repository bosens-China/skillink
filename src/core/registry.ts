/**
 * 目标工具注册表 - 内置支持的 AI 工具
 */
import { BuiltInTarget } from '../types/index.js';

/** 内置目标工具列表 */
export const builtInTargets: BuiltInTarget[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    defaultPath: '.cursor/skills',
    description: 'Cursor IDE Skills 目录',
  },
  {
    id: 'claude',
    name: 'Claude',
    defaultPath: '.claude/skills',
    description: 'Claude Skills 目录（Cursor 兼容）',
  },
  {
    id: 'codex',
    name: 'Codex',
    defaultPath: '.codex/skills',
    description: 'Codex Skills 目录（Cursor 兼容）',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    defaultPath: '.gemini/skills',
    description: 'Google Gemini CLI Skills 目录',
  },
];

/** 目标工具 Map（快速查找） */
export const targetMap = new Map<string, BuiltInTarget>(
  builtInTargets.map(t => [t.id, t])
);

/**
 * 获取内置目标工具
 */
export function getBuiltInTarget(id: string): BuiltInTarget | undefined {
  return targetMap.get(id);
}

/**
 * 获取所有内置目标工具
 */
export function getAllBuiltInTargets(): BuiltInTarget[] {
  return [...builtInTargets];
}

/**
 * 验证目标 ID 是否有效
 */
export function isValidTargetId(id: string): boolean {
  return targetMap.has(id);
}
