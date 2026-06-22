import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import type { LinkMode, SkillinkConfig } from '@/types/index.js';

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
 * 检测仓库现状，决定默认配置的方向。
 * - 优先使用 .agents / AGENTS.md 作为源
 * - 否则反向使用 .claude / CLAUDE.md 作为源（目标改为 .agents / AGENTS.md）
 */
export interface InitDetection {
  /** 是否检测到 .agents/AGENTS.md 任一项 */
  hasAgents: boolean;
  /** 是否检测到 .claude/CLAUDE.md 任一项 */
  hasClaude: boolean;
  /** 默认模板使用的源方向 */
  direction: 'agents-to-claude' | 'claude-to-agents';
}

export function detectInit(cwd: string = process.cwd()): InitDetection {
  const hasAgents =
    existsSync(path.join(cwd, '.agents')) ||
    existsSync(path.join(cwd, 'AGENTS.md'));
  const hasClaude =
    existsSync(path.join(cwd, '.claude')) ||
    existsSync(path.join(cwd, 'CLAUDE.md'));

  // 仅在「只检测到 claude 一侧」时反向；其它情况都以 agents 为源
  const direction: InitDetection['direction'] =
    !hasAgents && hasClaude ? 'claude-to-agents' : 'agents-to-claude';

  return { hasAgents, hasClaude, direction };
}

/**
 * 读取打包的默认配置模板（纯文本，便于维护，无需在代码里转义反引号）。
 * 同时兼容两种运行位置：
 * - 源码 / 测试：模板在 src/templates（相对当前文件为 ../templates）
 * - 打包产物：构建时模板被复制到 dist/templates（相对入口 chunk 为 ./templates 或 ../templates）
 */
async function readTemplate(name: string): Promise<string> {
  const candidates = [
    new URL(`./templates/${name}`, import.meta.url),
    new URL(`../templates/${name}`, import.meta.url),
  ];
  for (const url of candidates) {
    const filePath = fileURLToPath(url);
    if (existsSync(filePath)) {
      return fs.readFile(filePath, 'utf-8');
    }
  }
  throw new Error(`找不到默认配置模板文件：${name}`);
}

/**
 * 决定首次生成配置时的默认同步方式。
 * - 显式传入（CLI --mode）优先
 * - 否则：仓库以 .claude 为源（claude-to-agents）时默认 copy，
 *   因为生成的 AGENTS.md / .agents 通常希望作为真实文件提交、并在不跟随软链接的环境可用
 * - 其余情况保持 symlink（默认行为不变）
 */
export function resolveInitMode(
  detection: InitDetection,
  requested?: LinkMode,
): LinkMode {
  if (requested) {
    return requested;
  }
  return detection.direction === 'claude-to-agents' ? 'copy' : 'symlink';
}

/**
 * 创建默认配置文件（首次运行模板）
 * 根据仓库现状自动选择源/目标方向，并按需写入同步方式 mode。
 */
export async function createDefaultConfig(
  cwd: string = process.cwd(),
  requestedMode?: LinkMode,
): Promise<{ configPath: string; detection: InitDetection; mode: LinkMode }> {
  const detection = detectInit(cwd);
  const mode = resolveInitMode(detection, requestedMode);
  const configPath = path.join(cwd, 'skillink.config.ts');

  const header = await readTemplate('default-config.header.txt');
  let body = await readTemplate(
    detection.direction === 'agents-to-claude'
      ? 'default-config.agents.txt'
      : 'default-config.claude.txt',
  );

  // 仅在 copy 时显式写入 mode；symlink 为缺省值，保持模板简洁、默认行为不变
  if (mode === 'copy') {
    body = body.replace(
      'export default {\n',
      "export default {\n  // 同步方式：复制真实内容，可被 git 提交（改为 'symlink' 即用软链接）\n  mode: 'copy',\n",
    );
  }

  // header 与 body 之间留一个空行
  const content = `${header}\n${body}`;
  await fs.writeFile(configPath, content, 'utf-8');
  return { configPath, detection, mode };
}

/**
 * 配置定义辅助函数（提供类型提示）
 */
export function defineConfig(config: SkillinkConfig): SkillinkConfig {
  return config;
}
