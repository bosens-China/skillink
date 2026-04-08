import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createJiti } from 'jiti';
import type { SkillinkConfig } from '@/types/index.js';

const CONFIG_FILES = [
  'skillink.config.ts',
  'skillink.config.js',
  'skillink.config.mjs',
  'skillink.config.cjs',
];

const DEFAULT_CONFIG: SkillinkConfig = {
  locale: 'auto',
  links: [
    { from: 'AGENTS.md', to: 'CLAUDE.md' },
    { from: '.agents', to: '.claude' },
  ],
  encrypt: ['.mcp.json'],
};

/**
 * 加载配置文件，无配置文件时返回默认配置
 */
export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<SkillinkConfig> {
  const jiti = createJiti(cwd);

  for (const file of CONFIG_FILES) {
    const configPath = path.join(cwd, file);
    if (existsSync(configPath)) {
      const mod = await jiti.import(configPath);
      return (
        (mod as { default?: SkillinkConfig }).default ||
        (mod as SkillinkConfig)
      );
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * 检查是否存在配置文件
 */
export function hasConfigFile(cwd: string = process.cwd()): boolean {
  return CONFIG_FILES.some((file) => existsSync(path.join(cwd, file)));
}

/**
 * 创建默认配置文件
 */
export async function createDefaultConfig(cwd: string = process.cwd()): Promise<string> {
  const configPath = path.join(cwd, 'skillink.config.ts');
  const content = `export default {
  locale: 'auto',
  links: [
    { from: 'AGENTS.md', to: 'CLAUDE.md' },
    { from: '.agents', to: '.claude' },
  ],
};
`;
  await fs.writeFile(configPath, content, 'utf-8');
  return configPath;
}

/**
 * 配置定义辅助函数（提供类型提示）
 */
export function defineConfig(config: SkillinkConfig): SkillinkConfig {
  return config;
}
