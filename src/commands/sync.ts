/**
 * sync 命令 - 执行同步
 */
import { readConfig } from '../core/config.js';
import { sync as doSync } from '../core/sync.js';
import { getSkills } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import pc from 'picocolors';

export async function sync(cwd: string = process.cwd()): Promise<void> {
  logger.title('同步 Skills');

  // 检查配置
  const config = await readConfig(cwd);

  if (!config) {
    logger.error('未找到配置，请先运行 skillink init');
    process.exit(1);
  }

  // 获取 skills
  const skills = await getSkills(cwd);

  if (skills.length === 0) {
    logger.warn('未找到 skills，请在 .agent/skills/ 目录中添加');
    return;
  }

  logger.info(`扫描到 ${skills.length} 个 skills:`);
  for (const skill of skills) {
    logger.list([
      {
        label: skill.name,
        value: skill.valid
          ? pc.gray('(valid)')
          : pc.yellow('(missing SKILL.md)'),
        status: skill.valid ? 'ok' : 'warn',
      },
    ]);
  }

  logger.newline();

  // 执行同步
  const results = await doSync(cwd, config);

  // 显示结果
  const grouped = new Map<string, typeof results>();
  for (const result of results) {
    if (!grouped.has(result.skill)) {
      grouped.set(result.skill, []);
    }
    grouped.get(result.skill)!.push(result);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [skill, skillResults] of grouped) {
    console.log(pc.white(skill));
    for (const result of skillResults) {
      const icon =
        result.action === 'created'
          ? pc.green('  →')
          : result.action === 'updated'
            ? pc.yellow('  ~')
            : result.action === 'skipped'
              ? pc.gray('  =')
              : pc.red('  ✗');

      const targetPath = pc.gray(
        result.targetPath.replace(cwd, '').replace(/^[\\/]/, '') || '.',
      );

      if (result.error) {
        console.log(
          `${icon} ${result.target} ${targetPath} ${pc.red(result.error)}`,
        );
        errors++;
      } else {
        console.log(`${icon} ${result.target} ${targetPath}`);
        if (result.action === 'created') created++;
        if (result.action === 'updated') updated++;
        if (result.action === 'skipped') skipped++;
      }
    }
  }

  logger.newline();
  logger.success(
    `同步完成: ${created} 创建, ${updated} 更新, ${skipped} 跳过, ${errors} 错误`,
  );
}
