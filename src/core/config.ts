/**
 * 配置管理模块
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SkillinkConfig, TargetConfig } from '../types/index.js';
import { getConfigPath, ensureDir } from '../utils/fs.js';
import { builtInTargets } from './registry.js';

/** 默认配置版本 */
const CONFIG_VERSION = '1.0.0';

/**
 * 获取默认配置（默认启用所有内置工具）
 */
export function getDefaultConfig(): SkillinkConfig {
  const targets: Record<string, TargetConfig> = {};
  
  for (const target of builtInTargets) {
    targets[target.id] = {
      enabled: true,
      path: target.defaultPath,
    };
  }
  
  return {
    version: CONFIG_VERSION,
    targets,
    options: {
      syncMode: 'symlink',
      backupOnConflict: true,
    },
  };
}

/**
 * 读取配置
 */
export async function readConfig(projectRoot: string): Promise<SkillinkConfig | null> {
  const configPath = getConfigPath(projectRoot);
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as SkillinkConfig;
    return config;
  } catch (error) {
    throw new Error(`读取配置文件失败: ${error}`);
  }
}

/**
 * 写入配置
 */
export async function writeConfig(
  projectRoot: string, 
  config: SkillinkConfig
): Promise<void> {
  const configPath = getConfigPath(projectRoot);
  await ensureDir(path.dirname(configPath));
  
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`写入配置文件失败: ${error}`);
  }
}

/**
 * 检查配置是否存在
 */
export async function configExists(projectRoot: string): Promise<boolean> {
  const configPath = getConfigPath(projectRoot);
  return existsSync(configPath);
}

/**
 * 更新目标工具配置
 */
export async function updateTargets(
  projectRoot: string,
  targetSelections: Record<string, boolean>
): Promise<void> {
  const config = await readConfig(projectRoot) || getDefaultConfig();
  
  for (const [targetId, enabled] of Object.entries(targetSelections)) {
    if (config.targets[targetId]) {
      config.targets[targetId].enabled = enabled;
    }
  }
  
  await writeConfig(projectRoot, config);
}

/**
 * 获取启用的目标工具
 */
export function getEnabledTargets(config: SkillinkConfig): Array<{ id: string; path: string }> {
  return Object.entries(config.targets)
    .filter(([, target]) => target.enabled)
    .map(([id, target]) => ({ id, path: target.path }));
}

/**
 * 初始化配置（创建默认配置）
 */
export async function initConfig(
  projectRoot: string,
  targetSelections?: Record<string, boolean>
): Promise<void> {
  const config = getDefaultConfig();
  
  // 如果有选择，更新启用状态
  if (targetSelections) {
    for (const [targetId, enabled] of Object.entries(targetSelections)) {
      if (config.targets[targetId]) {
        config.targets[targetId].enabled = enabled;
      }
    }
  }
  
  await writeConfig(projectRoot, config);
}