import { loadConfig } from '@/core/config.js';
import { logger } from '@/utils/logger.js';
import pc from 'picocolors';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * 状态命令：显示所有技能的同步状态
 */
export async function statusCommand(options: { cwd?: string }) {
  const cwd = options.cwd || process.cwd();

  // 1. 加载配置
  const config = await loadConfig(cwd);
  if (!config) {
    logger.error('未找到配置文件。请先运行 "skillink init"。');
    return;
  }

  logger.title('Skillink 同步状态');
  logger.newline();

  const sourcePath = path.resolve(cwd, config.source || '.agents/skills');
  logger.info(`源目录: ${sourcePath}`);

  if (!existsSync(sourcePath)) {
    logger.error('源目录不存在！');
    return;
  }

  const skills = await fs.readdir(sourcePath, { withFileTypes: true });
  const validSkills = skills
    .filter((s) => s.isDirectory() && !s.name.startsWith('.'))
    .map((s) => s.name);
  logger.gray(`找到 ${validSkills.length} 个技能。`);
  logger.newline();

  logger.info('目标工具:');

  for (const target of config.targets) {
    if (target.enabled === false) continue;

    const targetDir = path.resolve(cwd, target.path);
    console.log(`${pc.bold(target.name)} [${targetDir}]`);

    if (!existsSync(targetDir)) {
      console.log(pc.red('  - 目录缺失（运行 sync 命令以创建）'));
      continue;
    }

    let syncedCount = 0;
    let missingCount = 0;
    let brokenCount = 0;

    for (const skill of validSkills) {
      const linkPath = path.join(targetDir, skill);

      if (!existsSync(linkPath)) {
        // 链接可能存在但指向无效（Broken）
        try {
          const stats = await fs.lstat(linkPath);
          if (stats.isSymbolicLink()) {
            brokenCount++;
          } else {
            missingCount++;
          }
        } catch {
          missingCount++;
        }
      } else {
        syncedCount++;
      }
    }

    if (missingCount > 0) console.log(pc.yellow(`  - ${missingCount} 个缺失`));
    if (brokenCount > 0) console.log(pc.red(`  - ${brokenCount} 个失效链接`));
    if (syncedCount > 0) console.log(pc.green(`  - ${syncedCount} 个已同步`));
    if (missingCount === 0 && brokenCount === 0)
      console.log(pc.green('  状态良好！'));

    console.log('');
  }
}
