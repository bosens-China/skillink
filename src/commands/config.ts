/**
 * config 命令 - 修改配置
 */
import { checkbox, confirm } from '@inquirer/prompts';
import { readConfig, writeConfig, getEnabledTargets } from '../core/config.js';
import { getAllBuiltInTargets } from '../core/registry.js';
import { logger } from '../utils/logger.js';


export async function config(cwd: string = process.cwd()): Promise<void> {
  logger.title('修改配置');

  // 读取现有配置
  const existingConfig = await readConfig(cwd);

  if (!existingConfig) {
    logger.error('未找到配置，请先运行 skillink init');
    process.exit(1);
  }

  const targets = getAllBuiltInTargets();
  const enabledTargets = getEnabledTargets(existingConfig);
  const enabledIds = new Set(enabledTargets.map((t) => t.id));

  // 显示当前配置
  logger.info('当前配置:');
  for (const target of targets) {
    const enabled = enabledIds.has(target.id);
    logger.list([
      {
        label: target.name,
        value: target.defaultPath,
        status: enabled ? 'ok' : 'info',
      },
    ]);
  }

  logger.newline();

  // 交互式选择
  const selectedTargets = await checkbox({
    message: '选择要同步的 AI 工具 (按空格选择/取消，回车确认):',
    choices: targets.map((t) => ({
      name: `${t.name}  →  ${t.defaultPath}`,
      value: t.id,
      checked: enabledIds.has(t.id),
    })),
  });

  // 更新配置
  const selectedIds = new Set(selectedTargets);

  for (const target of targets) {
    if (existingConfig.targets[target.id]) {
      existingConfig.targets[target.id].enabled = selectedIds.has(target.id);
    }
  }

  await writeConfig(cwd, existingConfig);

  logger.newline();
  logger.success('配置已更新');

  // 显示变更
  const changed = targets.filter((t) => {
    const wasEnabled = enabledIds.has(t.id);
    const isEnabled = selectedIds.has(t.id);
    return wasEnabled !== isEnabled;
  });

  if (changed.length > 0) {
    logger.info('变更:');
    for (const target of changed) {
      const isEnabled = selectedIds.has(target.id);
      logger.list([
        {
          label: target.name,
          value: isEnabled ? '已启用' : '已禁用',
          status: isEnabled ? 'ok' : 'warn',
        },
      ]);
    }
  }

  // 询问是否立即同步
  const shouldSync = await confirm({
    message: '是否立即同步?',
    default: true,
  });

  if (shouldSync) {
    logger.newline();
    // 动态导入避免循环依赖
    const { sync } = await import('./sync.js');
    await sync(cwd);
  }
}
