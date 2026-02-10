import { cac } from 'cac';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';
import { statusCommand } from './commands/status.js';
import { cleanCommand } from './commands/clean.js';
import { checkCommand } from './commands/check.js';
import { logger } from './utils/logger.js';
import { currentVersion } from './utils/update.js';

const cli = cac('skillink');

cli.version(currentVersion);

cli
  .command(
    'init',
    'Initialize Skillink configuration / 初始化 Skillink 配置',
  )
  .action(() => initCommand());

cli
  .command('sync', 'Sync skills to configured targets / 同步技能到目标工具')
  .option('-w, --watch', 'Watch file changes / 监视文件变更')
  .action((options) => syncCommand(options));

cli
  .command('status', 'Show sync status / 显示同步状态')
  .action(() => statusCommand({}));

cli
  .command('clean', 'Remove generated symlinks / 移除生成的符号链接')
  .action(() => cleanCommand());

cli
  .command('check', 'Check package updates / 检查版本更新')
  .action(() => checkCommand());

cli.help();

// 执行命令
try {
  cli.parse();
} catch (error: unknown) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
