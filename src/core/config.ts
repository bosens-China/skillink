import path from 'node:path';
import { existsSync } from 'node:fs';
import { createJiti } from 'jiti';
import type { SkillinkConfig } from '@/types/index.js';

// 支持的配置文件名
const CONFIG_FILES = [
  'skillink.config.ts',
  'skillink.config.js',
  'skillink.config.mjs',
  'skillink.config.cjs',
];

/**
 * 加载配置文件
 * @param cwd 当前工作目录
 */
export async function loadConfig(
  cwd: string = process.cwd(),
): Promise<SkillinkConfig | null> {
  const jiti = createJiti(cwd);

  for (const file of CONFIG_FILES) {
    const configPath = path.join(cwd, file);
    if (existsSync(configPath)) {
      try {
        const mod = await jiti.import(configPath);
        // 处理默认导出
        return (
          (mod as { default?: SkillinkConfig }).default ||
          (mod as SkillinkConfig)
        );
      } catch (error) {
        console.error(`无法从 ${file} 加载配置:`, error);
        return null;
      }
    }
  }

  return null;
}

/**
 * 配置定义辅助函数（提供类型提示）
 */
export function defineConfig(config: SkillinkConfig): SkillinkConfig {
  return config;
}
