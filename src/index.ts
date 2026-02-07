#!/usr/bin/env node

/**
 * Skillink CLI 入口
 * 
 * 统一 AI Skills 管理工具 - 像 pnpm 一样链接到各 AI 工具目录
 */
import { Command } from 'commander';
import { init } from './commands/init.js';
import { config } from './commands/config.js';
import { sync } from './commands/sync.js';
import { status } from './commands/status.js';
import { watch } from './commands/watch.js';
import { add } from './commands/add.js';
import { logger } from './utils/logger.js';
import { findProjectRoot } from './utils/fs.js';

const program = new Command();

program
  .name('skillink')
  .description('统一 AI Skills 管理工具')
  .version('1.0.0');

// init 命令
program
  .command('init')
  .description('初始化 .agent 目录和配置')
  .action(async () => {
    try {
      await init(process.cwd());
    } catch (error) {
      logger.error(`初始化失败: ${error}`);
      process.exit(1);
    }
  });

// config 命令
program
  .command('config')
  .description('修改 AI 工具配置')
  .action(async () => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('未找到 .agent 目录，请先运行 skillink init');
        process.exit(1);
      }
      await config(projectRoot);
    } catch (error) {
      logger.error(`配置失败: ${error}`);
      process.exit(1);
    }
  });

// sync 命令
program
  .command('sync')
  .description('同步 skills 到各 AI 工具目录')
  .action(async () => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('未找到 .agent 目录，请先运行 skillink init');
        process.exit(1);
      }
      await sync(projectRoot);
    } catch (error) {
      logger.error(`同步失败: ${error}`);
      process.exit(1);
    }
  });

// status 命令
program
  .command('status')
  .description('查看当前状态')
  .action(async () => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('未找到 .agent 目录，请先运行 skillink init');
        process.exit(1);
      }
      await status(projectRoot);
    } catch (error) {
      logger.error(`获取状态失败: ${error}`);
      process.exit(1);
    }
  });

// watch 命令
program
  .command('watch')
  .description('监视模式，自动同步变更')
  .action(async () => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('未找到 .agent 目录，请先运行 skillink init');
        process.exit(1);
      }
      await watch(projectRoot);
    } catch (error) {
      logger.error(`监视失败: ${error}`);
      process.exit(1);
    }
  });

// add 命令
program
  .command('add [name]')
  .description('创建新的 skill 模板')
  .action(async (name: string) => {
    try {
      const projectRoot = await findProjectRoot();
      if (!projectRoot) {
        logger.error('未找到 .agent 目录，请先运行 skillink init');
        process.exit(1);
      }
      await add(name, projectRoot);
    } catch (error) {
      logger.error(`创建失败: ${error}`);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();

// 如果没有命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
