import pc from 'picocolors';
import { loadConfig } from '@/core/config.js';
import { logger } from '@/utils/logger.js';
import { checkUpdate } from '@/utils/update.js';
import { isChineseLocale, resolveLocale } from '@/utils/locale.js';

export async function checkCommand() {
  const config = await loadConfig();
  const locale = resolveLocale(config?.locale);
  const isChinese = isChineseLocale(locale);

  logger.info(
    isChinese
      ? '正在检查更新（语义化版本比较）...'
      : 'Checking updates (semantic version comparison)...',
  );

  try {
    const info = await checkUpdate();
    if (info.hasUpdate) {
      console.log();
      console.log(
        pc.yellow('   ╭──────────────────────────────────────────────────╮'),
      );
      console.log(
        pc.yellow('   │                                                  │'),
      );
      console.log(
        pc.yellow(
          isChinese
            ? `   │      发现新版本 ${pc.green(info.latest)} (当前 ${pc.gray(info.current)})      │`
            : `   │    New version ${pc.green(info.latest)} (current ${pc.gray(info.current)})    │`,
        ),
      );
      console.log(
        pc.yellow('   │                                                  │'),
      );
      console.log(
        pc.yellow(
          isChinese
            ? `   │  请运行 ${pc.cyan(`npm install -D ${info.name}@${info.latest}`)} 更新  │`
            : `   │  Run ${pc.cyan(`npm install -D ${info.name}@${info.latest}`)} to update  │`,
        ),
      );
      console.log(
        pc.yellow('   │                                                  │'),
      );
      console.log(
        pc.yellow('   ╰──────────────────────────────────────────────────╯'),
      );
      console.log();
    } else {
      logger.success(
        isChinese
          ? `当前已是最新稳定版本 (${pc.green(info.current)})`
          : `You are on the latest stable version (${pc.green(info.current)})`,
      );
    }
  } catch (error: unknown) {
    logger.error(
      isChinese
        ? `检查更新失败: ${error instanceof Error ? error.message : String(error)}`
        : `Update check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
