/**
 * watch 命令 - 监视模式
 */
import chokidar from 'chokidar';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readConfig } from '../core/config.js';
import { sync } from '../core/sync.js';
import { getSkillsDir, getConfigPath } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';

let isSyncing = false;
let pendingSync = false;

export async function watch(cwd: string = process.cwd()): Promise<void> {
  logger.title('监视模式');

  const config = await readConfig(cwd);

  if (!config) {
    logger.error('未找到配置，请先运行 skillink init');
    process.exit(1);
  }

  const skillsDir = getSkillsDir(cwd);
  const configPath = getConfigPath(cwd);

  // 检查 skills 目录是否存在
  if (!existsSync(skillsDir)) {
    logger.warn('未找到 .agent/skills/ 目录');
  }

  logger.info(`监视: ${pc.gray(path.relative(cwd, skillsDir))}`);
  logger.info('按 Ctrl+C 停止监视');
  logger.newline();

  // 创建 watcher
  const watcher = chokidar.watch(skillsDir, {
    ignored: /(^|[\\/])\../, // 忽略隐藏文件
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  // 同时监视配置文件变化
  const configWatcher = chokidar.watch(configPath, {
    persistent: true,
    ignoreInitial: true,
  });

  // 防抖同步
  const debouncedSync = async () => {
    if (isSyncing) {
      pendingSync = true;
      return;
    }

    isSyncing = true;
    pendingSync = false;

    try {
      const currentConfig = await readConfig(cwd);
      if (currentConfig) {
        await sync(cwd, currentConfig);
        console.log(pc.gray(`[${new Date().toLocaleTimeString()}] 同步完成`));
      }
    } catch (error) {
      logger.error(`同步失败: ${error}`);
    } finally {
      isSyncing = false;
      if (pendingSync) {
        debouncedSync();
      }
    }
  };

  // 监听文件变化
  watcher
    .on('add', (filePath) => {
      console.log(
        pc.gray(
          `[${new Date().toLocaleTimeString()}] 添加: ${path.relative(cwd, filePath)}`,
        ),
      );
      debouncedSync();
    })
    .on('change', (filePath) => {
      console.log(
        pc.gray(
          `[${new Date().toLocaleTimeString()}] 修改: ${path.relative(cwd, filePath)}`,
        ),
      );
      debouncedSync();
    })
    .on('unlink', (filePath) => {
      console.log(
        pc.gray(
          `[${new Date().toLocaleTimeString()}] 删除: ${path.relative(cwd, filePath)}`,
        ),
      );
      debouncedSync();
    })
    .on('addDir', () => debouncedSync())
    .on('unlinkDir', () => debouncedSync());

  // 配置文件变化时重新读取
  configWatcher.on('change', () => {
    console.log(pc.gray(`[${new Date().toLocaleTimeString()}] 配置已更新`));
    debouncedSync();
  });

  // 优雅退出
  process.on('SIGINT', () => {
    logger.newline();
    logger.info('停止监视');
    watcher.close();
    configWatcher.close();
    process.exit(0);
  });

  // 保持进程运行
  await new Promise(() => {});
}
