/**
 * status 命令 - 查看状态
 */
import { readConfig, getEnabledTargets } from '../core/config.js';
import { getSkills } from '../utils/fs.js';
import { getAllBuiltInTargets } from '../core/registry.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export async function status(cwd: string = process.cwd()): Promise<void> {
  logger.title('Skillink 状态');

  // 检查配置
  const config = await readConfig(cwd);

  if (!config) {
    logger.error('未找到配置，请先运行 skillink init');
    return;
  }

  // 配置信息
  logger.info('配置:');
  logger.list([
    {
      label: '版本',
      value: config.version,
      status: 'info',
    },
    {
      label: '同步模式',
      value: config.options?.syncMode ?? 'symlink',
      status: 'info',
    },
  ]);

  logger.newline();

  // 目标工具状态
  const enabledTargets = getEnabledTargets(config);
  const allTargets = getAllBuiltInTargets();

  logger.info('目标工具:');
  for (const target of allTargets) {
    const enabled = enabledTargets.some((t) => t.id === target.id);
    const targetPath = path.join(cwd, target.defaultPath);
    const exists = existsSync(targetPath);

    // 统计该目标的 skill 数量
    let skillCount = 0;
    if (exists) {
      try {
        const items = await fs.readdir(targetPath);
        skillCount = items.length;
      } catch {
        // ignore
      }
    }

    logger.list([
      {
        label: target.name,
        value: `${target.defaultPath} (${skillCount} links)`,
        status: enabled ? 'ok' : 'info',
      },
    ]);
  }

  logger.newline();

  // Skills 状态
  const skills = await getSkills(cwd);

  if (skills.length === 0) {
    logger.warn('未找到 skills');
  } else {
    logger.info(`Skills (${skills.length}):`);
    for (const skill of skills) {
      const targets = enabledTargets.map(async (t) => {
        const targetPath = path.join(cwd, t.path, skill.name);
        const exists = existsSync(targetPath);
        return exists ? pc.green(t.id) : pc.gray(t.id);
      });

      const targetStatus = await Promise.all(targets);

      logger.list([
        {
          label: skill.name,
          value: `→ ${targetStatus.join(', ')}`,
          status: skill.valid ? 'ok' : 'warn',
        },
      ]);
    }
  }
}
