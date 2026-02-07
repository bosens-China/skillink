/**
 * init 命令 - 初始化 .agent 目录
 */
import { checkbox } from '@inquirer/prompts';
import { getAgentDir, ensureDir, getSkillsDir } from '../utils/fs.js';
import { initConfig } from '../core/config.js';
import { getAllBuiltInTargets } from '../core/registry.js';
import { logger } from '../utils/logger.js';


export async function init(cwd: string = process.cwd()): Promise<void> {
  logger.title('初始化 Skillink');

  const agentDir = getAgentDir(cwd);
  const skillsDir = getSkillsDir(cwd);

  // 创建目录
  await ensureDir(agentDir);
  await ensureDir(skillsDir);

  logger.success('创建 .agent/ 目录');
  logger.success('创建 .agent/skills/ 目录');

  // 交互式选择目标工具
  const targets = getAllBuiltInTargets();

  const selectedTargets = await checkbox({
    message: '选择要同步的 AI 工具 (按空格选择/取消，回车确认):',
    choices: targets.map((t) => ({
      name: `${t.name}  →  ${t.defaultPath}${t.description ? ` (${t.description})` : ''}`,
      value: t.id,
      checked: true,
    })),
  });

  // 构建选择映射
  const targetSelections: Record<string, boolean> = {};
  for (const target of targets) {
    targetSelections[target.id] = selectedTargets.includes(target.id);
  }

  // 初始化配置
  await initConfig(cwd, targetSelections);

  logger.newline();
  logger.success('配置已保存至 .agent/config.json');

  // 显示启用状态
  logger.newline();
  logger.info('已启用工具:');
  for (const target of targets) {
    const enabled = targetSelections[target.id];
    logger.list([
      {
        label: target.name,
        value: target.defaultPath,
        status: enabled ? 'ok' : 'info',
      },
    ]);
  }

  logger.newline();
  logger.success('初始化完成！');
  logger.info(
    '提示: 将您的 skills 放入 .agent/skills/ 目录，然后运行 skillink sync',
  );
}
