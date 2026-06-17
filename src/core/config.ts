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
 * 创建默认配置文件（首次运行模板）
 * 根据仓库现状自动选择源/目标方向。
 */
export async function createDefaultConfig(
  cwd: string = process.cwd(),
): Promise<{ configPath: string; detection: InitDetection }> {
  const detection = detectInit(cwd);
  const configPath = path.join(cwd, 'skillink.config.ts');

  const header = `// skillink 配置文件
// 文档与源码：https://github.com/bosens-China/skillink
//
// 常见使用方式：
//   1. 把一份 AGENTS.md 同步成多个工具能识别的文件（CLAUDE.md / GEMINI.md ...）
//        agentsMarkdown: [{ from: '**/AGENTS.md', to: ['CLAUDE.md', 'GEMINI.md'] }]
//   2. 把 .agents 目录链接成 .claude / .cursor 等同级目录
//        agentsSkills:   [{ from: '.agents',     to: ['.claude', '.cursor'] }]
//   3. 在 monorepo 中按 glob 匹配每个子包的 AGENTS.md，各自就地链接
//        agentsMarkdown: [{ from: 'packages/*/AGENTS.md', to: ['CLAUDE.md'] }]
//   4. 任意字面映射（既支持文件也支持目录）
//        links: [{ from: '.env.example', to: '.env.template' }]
//   5. 用 \`skillink lock\` 把敏感文件加密为 .lock 提交到仓库
//        encrypt: ['.mcp.json', '.env']
//
// 常用命令：
//   skillink                同步映射
//   skillink --dry-run      仅预览，不写盘
//   skillink --yes          全自动确认（CI 推荐）
//   skillink lock / unlock  加密 / 还原敏感文件

`;

  const body =
    detection.direction === 'agents-to-claude'
      ? `export default {
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
`
      : `export default {
  // 仓库已有 .claude / CLAUDE.md，反向以它们作为源
  agentsMarkdown: [
    {
      from: '**/CLAUDE.md',
      to: ['AGENTS.md'],
    },
  ],
  agentsSkills: [
    {
      from: '.claude',
      to: ['.agents'],
    },
  ],
  encrypt: ['.mcp.json'],
};
`;
  const content = header + body;
  await fs.writeFile(configPath, content, 'utf-8');
  return { configPath, detection };
}

/**
 * 配置定义辅助函数（提供类型提示）
 */
export function defineConfig(config: SkillinkConfig): SkillinkConfig {
  return config;
}
