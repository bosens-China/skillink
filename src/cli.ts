import { cac } from 'cac';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { syncCommand } from './commands/sync.js';
import { lockCommand } from './commands/lock.js';
import { unlockCommand } from './commands/unlock.js';
import { formatErrorMessage } from './utils/errors.js';
import { currentVersion } from './utils/version.js';

const cli = cac('skillink');

cli.version(currentVersion);

cli
  .command('lock [...files]', '加密文件为 .lock 文件')
  .option('-p, --password <password>', '加密密码')
  .action((files: string[] | undefined, options) =>
    lockCommand({ files, password: options.password }),
  );

cli
  .command('unlock [...files]', '还原 .lock 文件')
  .option('-p, --password <password>', '解密密码')
  .action((files: string[] | undefined, options) =>
    unlockCommand({ files, password: options.password }),
  );

cli
  .command('[root]', '同步文件（默认命令；支持 symlink / copy 两种方式）')
  .option('-y, --yes', '跳过所有交互确认')
  .option('--dry-run', '只打印将要执行的同步，不写入文件系统')
  .option('--silent', 'postinstall 友好模式：无配置静默退出、不交互、冲突跳过')
  .option('--mode <mode>', '首次生成配置时的同步方式：symlink 或 copy（仅 init 生效）')
  .action((root, options) =>
    syncCommand({
      cwd: root,
      yes: options.yes,
      dryRun: options.dryRun,
      silent: options.silent,
      mode: options.mode,
    }),
  );

cli.help();

async function main() {
  try {
    await cli.parse();
  } catch (error: unknown) {
    p.log.error(pc.red(formatErrorMessage(error)));
    process.exit(1);
  }
}

void main();
