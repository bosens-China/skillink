/**
 * 文件系统工具 - 基于原生 Node.js fs 的跨平台封装
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SkillInfo } from '../types/index.js';

/** Agent 目录名 */
export const AGENT_DIR = '.agent';
/** Skills 目录名 */
export const SKILLS_DIR = 'skills';
/** 配置文件名 */
export const CONFIG_FILE = 'config.json';

/**
 * 路径是否存在
 */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取项目根目录（从当前目录向上查找包含 .agent 的目录）
 */
export async function findProjectRoot(cwd: string = process.cwd()): Promise<string | null> {
  let current = cwd;
  
  while (true) {
    const agentPath = path.join(current, AGENT_DIR);
    if (existsSync(agentPath)) {
      return current;
    }
    
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * 获取 .agent 目录路径
 */
export function getAgentDir(projectRoot: string): string {
  return path.join(projectRoot, AGENT_DIR);
}

/**
 * 获取 skills 目录路径
 */
export function getSkillsDir(projectRoot: string): string {
  return path.join(getAgentDir(projectRoot), SKILLS_DIR);
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(projectRoot: string): string {
  return path.join(getAgentDir(projectRoot), CONFIG_FILE);
}

/**
 * 获取所有 skills
 */
export async function getSkills(projectRoot: string): Promise<SkillInfo[]> {
  const skillsDir = getSkillsDir(projectRoot);
  
  if (!existsSync(skillsDir)) {
    return [];
  }
  
  const items = await fs.readdir(skillsDir, { withFileTypes: true });
  const skills: SkillInfo[] = [];
  
  for (const item of items) {
    if (item.isDirectory()) {
      const skillPath = path.join(skillsDir, item.name);
      const hasSkillFile = existsSync(path.join(skillPath, 'SKILL.md'));
      
      skills.push({
        name: item.name,
        path: skillPath,
        valid: hasSkillFile,
      });
    }
  }
  
  return skills;
}

/**
 * 确保目录存在
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * 检查路径是否为符号链接
 */
export async function isSymlink(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(targetPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * 安全删除（如果是符号链接则删除链接，不删除源文件）
 */
export async function safeRemove(targetPath: string): Promise<void> {
  if (existsSync(targetPath)) {
    const symlink = await isSymlink(targetPath);
    if (symlink) {
      await fs.unlink(targetPath);
    } else {
      // 如果不是符号链接，递归删除
      await fs.rm(targetPath, { recursive: true, force: true });
    }
  }
}
