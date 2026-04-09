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

/**
 * 加载配置文件。
 * - 存在配置文件：按文件导出原样使用（不合并默认值）；`export default {}` 亦为合法空配置。
 * - 不存在配置文件：返回空对象（由调用方决定是否写入默认模板等）。
 */
export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<SkillinkConfig> {
  const jiti = createJiti(cwd);

  for (const file of CONFIG_FILES) {
    const configPath = path.join(cwd, file);
    if (existsSync(configPath)) {
      const mod = (await jiti.import(configPath)) as {
        default?: SkillinkConfig;
      };
      const exported = mod.default !== undefined ? mod.default : mod;
      if (exported && typeof exported === 'object') {
        return exported as SkillinkConfig;
      }
      return {};
    }
  }

  return {};
}

/**
 * 检查是否存在配置文件
 */
export function hasConfigFile(cwd: string = process.cwd()): boolean {
  return CONFIG_FILES.some((file) => existsSync(path.join(cwd, file)));
}

/**
 * 创建默认配置文件（首次运行模板，含推荐字段）
 */
export async function createDefaultConfig(
  cwd: string = process.cwd(),
): Promise<string> {
  const configPath = path.join(cwd, 'skillink.config.ts');
  const content = `export default {
  locale: 'auto',
  // Agent 文档：glob 匹配（遵守 .gitignore），to 相对于每个 AGENTS.md 所在目录
  agentsMarkdown: [
    {
      from: '**/AGENTS.md',
      to: ['CLAUDE.md'],
    },
  ],
  // Skills 目录：to 与命中的源目录同级（在其父目录下）
  agentsSkills: [
    {
      from: '.agents',
      to: ['.claude'],
    },
  ],
  // lock 默认加密列表；unlock 无参且 skillink.encrypt.json 为空时回退此列表
  encrypt: ['.mcp.json'],
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
