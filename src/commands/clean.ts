import { loadConfig } from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import { logger } from '@/utils/logger.js';
import { confirm } from '@inquirer/prompts';

interface CleanOptions {
  cwd?: string;
}

/**
 * 清理命令：移除所有生成的符号链接
 */
export async function cleanCommand(options: CleanOptions = {}) {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);
  if (!config) {
    logger.error('未找到配置。');
    return;
  }

  const answer = await confirm({
    message: '确定要移除所有已同步的技能链接吗？',
    default: false,
  });
  if (!answer) return;

  const linker = new Linker(cwd, config);
  logger.info('正在清理链接...');

  await linker.cleanAll();
  logger.success('清理完成。');
}
