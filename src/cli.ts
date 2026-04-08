import { cac } from 'cac';
import { syncCommand } from './commands/sync.js';
import { logger } from './utils/logger.js';
import { currentVersion } from './utils/update.js';

const cli = cac('skillink');

cli.version(currentVersion);

cli
  .command('[root]', 'Sync files via symlinks / 通过符号链接同步文件')
  .option('-y, --yes', 'Skip confirmation prompts / 跳过交互确认')
  .action((root, options) =>
    syncCommand({ cwd: root, yes: options.yes }),
  );

cli.help();

try {
  cli.parse();
} catch (error: unknown) {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
