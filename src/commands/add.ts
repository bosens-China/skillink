/**
 * add 命令 - 创建新 skill 模板
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { input } from '@inquirer/prompts';
import { getSkillsDir, ensureDir } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';

const SKILL_TEMPLATE = `---
name: {{name}}
description: 请在这里描述这个 skill 的用途
---

## 使用场景

- 场景 1
- 场景 2

## 示例

\`\`\`
示例代码或提示词
\`\`\`

## 注意事项

1. 注意事项 1
2. 注意事项 2
`;

export async function add(skillName: string, cwd: string = process.cwd()): Promise<void> {
  if (!skillName) {
    // 交互式输入
    skillName = await input({
      message: 'Skill 名称:',
      validate: (input: string) => {
        if (!input.trim()) {
          return '名称不能为空';
        }
        if (!/^[a-z0-9-]+$/.test(input)) {
          return '名称只能包含小写字母、数字和连字符';
        }
        return true;
      },
    });
  }
  
  // 验证名称
  if (!/^[a-z0-9-]+$/.test(skillName)) {
    logger.error('Skill 名称只能包含小写字母、数字和连字符');
    process.exit(1);
  }
  
  const skillsDir = getSkillsDir(cwd);
  const skillDir = path.join(skillsDir, skillName);
  
  // 检查是否已存在
  if (existsSync(skillDir)) {
    logger.error(`Skill "${skillName}" 已存在`);
    process.exit(1);
  }
  
  // 创建目录
  await ensureDir(skillDir);
  
  // 创建 SKILL.md
  const skillContent = SKILL_TEMPLATE.replace(/\{\{name\}\}/g, skillName);
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillContent, 'utf-8');
  
  logger.success(`创建 skill: ${pc.cyan(skillName)}`);
  logger.info(`位置: ${pc.gray(path.relative(cwd, skillDir))}`);
  logger.newline();
  logger.info('提示: 编辑 .agent/skills/{{name}}/SKILL.md 完善内容，然后运行 skillink sync');
}
