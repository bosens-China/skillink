import { loadConfig } from '@/core/config.js';
import { logger } from '@/utils/logger.js';
import pc from 'picocolors';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isChineseLocale, resolveLocale } from '@/utils/locale.js';

/**
 * 状态命令：显示所有技能的同步状态
 */
export async function statusCommand(options: { cwd?: string }) {
  const cwd = options.cwd || process.cwd();

  // 1. 加载配置
  const config = await loadConfig(cwd);
  const locale = resolveLocale(config?.locale);
  const isChinese = isChineseLocale(locale);
  if (!config) {
    logger.error(
      isChinese
        ? '未找到配置文件。请先运行 "skillink init"。'
        : 'Configuration file not found. Run "skillink init" first.',
    );
    return;
  }

  logger.title(isChinese ? 'Skillink 同步状态' : 'Skillink Sync Status');
  logger.newline();

  const sourcePath = path.resolve(cwd, config.source || '.agents/skills');
  logger.info(
    isChinese ? `源目录: ${sourcePath}` : `Source directory: ${sourcePath}`,
  );

  if (!existsSync(sourcePath)) {
    logger.error(
      isChinese ? '源目录不存在！' : 'Source directory does not exist!',
    );
    return;
  }

  const skills = await fs.readdir(sourcePath, { withFileTypes: true });
  const validSkills = skills
    .filter((s) => s.isDirectory() && !s.name.startsWith('.'))
    .map((s) => s.name);
  logger.gray(
    isChinese
      ? `找到 ${validSkills.length} 个技能。`
      : `Found ${validSkills.length} skill(s).`,
  );
  logger.newline();

  logger.info(isChinese ? '目标工具:' : 'Targets:');

  for (const target of config.targets) {
    if (target.enabled === false) continue;

    const targetDir = path.resolve(cwd, target.path);
    console.log(`${pc.bold(target.name)} [${targetDir}]`);

    if (!existsSync(targetDir)) {
      console.log(
        pc.red(
          isChinese
            ? '  - 目录缺失（运行 sync 命令以创建）'
            : '  - Missing directory (run sync to create it)',
        ),
      );
      continue;
    }

    let syncedCount = 0;
    let missingCount = 0;
    let brokenCount = 0;
    let mismatchedCount = 0;
    let occupiedCount = 0;

    for (const skill of validSkills) {
      const linkPath = path.join(targetDir, skill);
      const sourceSkillPath = path.resolve(sourcePath, skill);

      try {
        const stats = await fs.lstat(linkPath);

        if (!stats.isSymbolicLink()) {
          // 同名普通文件/目录会阻塞同步，单独统计便于排障
          occupiedCount++;
          continue;
        }

        try {
          const currentTarget = await fs.readlink(linkPath);
          const absCurrentTarget = path.resolve(targetDir, currentTarget);
          if (absCurrentTarget === sourceSkillPath) {
            syncedCount++;
          } else {
            mismatchedCount++;
          }
        } catch {
          brokenCount++;
        }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          missingCount++;
          continue;
        }
        missingCount++;
      }
    }

    if (missingCount > 0)
      console.log(
        pc.yellow(
          isChinese
            ? `  - ${missingCount} 个缺失`
            : `  - ${missingCount} missing`,
        ),
      );
    if (brokenCount > 0)
      console.log(
        pc.red(
          isChinese
            ? `  - ${brokenCount} 个失效链接`
            : `  - ${brokenCount} broken link(s)`,
        ),
      );
    if (mismatchedCount > 0)
      console.log(
        pc.red(
          isChinese
            ? `  - ${mismatchedCount} 个错误指向链接`
            : `  - ${mismatchedCount} mismatched link(s)`,
        ),
      );
    if (occupiedCount > 0)
      console.log(
        pc.yellow(
          isChinese
            ? `  - ${occupiedCount} 个同名占位（非链接）`
            : `  - ${occupiedCount} occupied by non-link`,
        ),
      );
    if (syncedCount > 0)
      console.log(
        pc.green(
          isChinese
            ? `  - ${syncedCount} 个已同步`
            : `  - ${syncedCount} synced`,
        ),
      );
    if (
      missingCount === 0 &&
      brokenCount === 0 &&
      mismatchedCount === 0 &&
      occupiedCount === 0
    )
      console.log(pc.green(isChinese ? '  状态良好！' : '  Healthy!'));

    console.log('');
  }
}
