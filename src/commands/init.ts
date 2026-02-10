import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { checkbox, confirm } from '@inquirer/prompts';
import { ensureDir } from '@/utils/fs.js';

// 默认技能模板
const TEMPLATE_SKILL = `---
name: 示例技能
description: 这是一个由 Skillink 生成的演示技能。
---

# 使用说明

激活此技能即可使用。
`;

// 默认支持的目标工具
const DEFAULT_TARGETS = [
  { name: 'Cursor', value: 'cursor', path: '.cursor/rules' },
  { name: 'Windsurf', value: 'windsurf', path: '.windsurf/rules' },
  { name: 'VSCode', value: 'vscode', path: '.vscode/skills' },
  { name: 'Gemini', value: 'gemini', path: '.gemini/skills' },
];

/**
 * 初始化命令
 * @param cwd 当前工作目录
 */
export async function initCommand(cwd: string = process.cwd()) {
  console.log('✨ Skillink 初始化');

  const skillsDir = path.join(cwd, '.agents', 'skills');
  const configFile = path.join(cwd, 'skillink.config.ts');

  // 1. 创建技能目录
  if (!existsSync(skillsDir)) {
    const create = await confirm({
      message: `是否在 ${skillsDir} 创建技能目录？`,
      default: true,
    });
    if (create) {
      await ensureDir(skillsDir);
      // 创建示例技能
      const exampleDir = path.join(skillsDir, 'example-skill');
      await ensureDir(exampleDir);
      await fs.writeFile(path.join(exampleDir, 'SKILL.md'), TEMPLATE_SKILL);
      console.log('✅ 已创建示例技能。');
    }
  } else {
    console.log('ℹ️  技能目录已存在。');
  }

  // 2. 选择目标工具
  const selectedTargets = await checkbox({
    message: '选择要同步的 AI 工具：',
    choices: DEFAULT_TARGETS.map((t) => ({ name: t.name, value: t })),
  });

  if (selectedTargets.length === 0) {
    console.log('⚠️ 未选择任何目标。配置文件中的目标列表将为空。');
  }

  // 3. 生成配置文件
  if (existsSync(configFile)) {
    const overwrite = await confirm({
      message: '配置文件已存在。是否覆盖？',
      default: false,
    });
    if (!overwrite) {
      console.log('❌ 初始化已取消。');
      return;
    }
  }

  const configContent = `import { defineConfig } from '@boses/skillink';

export default defineConfig({
  source: '.agents/skills',
  targets: [
${selectedTargets
  .map(
    (t) => `    {
      name: '${t.value}',
      path: '${t.path}',
      enabled: true,
    },`,
  )
  .join('\n')}
  ],
});
`;

  await fs.writeFile(configFile, configContent);
  console.log('✅ 已创建 skillink.config.ts');
  if (selectedTargets.length > 0) {
    const targetPaths = selectedTargets.map((t) => t.path).join(', ');
    console.log(
      `💡 Git 建议：请将目标目录（${targetPaths}）加入 .gitignore，只提交 .agents/skills 与配置文件。`,
    );
  }
  console.log('\n👉 运行 "npx skillink sync" 开始同步！');
}
