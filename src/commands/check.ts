import pc from 'picocolors';
import { logger } from '@/utils/logger.js';
import { checkUpdate } from '@/utils/update.js';

export async function checkCommand() {
  logger.info('正在检查更新...');

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
          `   │      发现新版本 ${pc.green(info.latest)} (当前 ${pc.gray(info.current)})      │`,
        ),
      );
      console.log(
        pc.yellow('   │                                                  │'),
      );
      console.log(
        pc.yellow(
          `   │    请运行 ${pc.cyan(`npm i -g ${info.name}`)} 更新    │`,
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
      logger.success(`当前已是最新版本 (${pc.green(info.current)})`);
    }
  } catch (error: unknown) {
    logger.error(
      `检查更新失败: ${error instanceof Error ? error.message : String(error)}`,
    );
    // 失败时不中断进程，只是打印错误
  }
}
