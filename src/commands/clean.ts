import { loadConfig } from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import { logger } from '@/utils/logger.js';
import { confirm } from '@inquirer/prompts';
import { isChineseLocale, resolveLocale } from '@/utils/locale.js';

interface CleanOptions {
  cwd?: string;
}

/**
 * 清理命令：移除所有生成的符号链接
 */
export async function cleanCommand(options: CleanOptions = {}) {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);
  const locale = resolveLocale(config?.locale);
  const isChinese = isChineseLocale(locale);
  if (!config) {
    logger.error(isChinese ? '未找到配置。' : 'Configuration not found.');
    return;
  }

  const answer = await confirm({
    message: isChinese
      ? '确定要移除所有已同步的技能链接吗？'
      : 'Remove all synced skill links?',
    default: false,
  });
  if (!answer) return;

  const linker = new Linker(cwd, config);
  logger.info(isChinese ? '正在清理链接...' : 'Cleaning links...');

  await linker.cleanAll();
  logger.success(isChinese ? '清理完成。' : 'Clean completed.');
}
