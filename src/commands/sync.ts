import { existsSync } from 'node:fs';
import path from 'node:path';
import { select } from '@inquirer/prompts';
import pc from 'picocolors';
import { loadConfig, hasConfigFile, createDefaultConfig } from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import { resolveLocale, t } from '@/utils/locale.js';
import { addToGitignore } from '@/utils/gitignore.js';

/**
 * 主命令：init + sync 一体化流程
 */
export async function syncCommand(options: { cwd?: string; yes?: boolean }) {
  const cwd = options.cwd || process.cwd();
  const autoConfirm = options.yes || false;

  // 1. 检查/创建配置文件
  if (!hasConfigFile(cwd)) {
    const configPath = await createDefaultConfig(cwd);
    console.log(
      pc.green(
        `+ ${path.relative(cwd, configPath)}`,
      ),
    );
  }

  // 2. 加载配置
  const config = await loadConfig(cwd);
  const locale = resolveLocale(config.locale);

  // 3. 检查源文件，收集有效的映射和缺失的映射
  const validMappings: typeof config.links = [];
  const gitignoreEntries: string[] = [];

  for (const link of config.links) {
    const fromPath = path.resolve(cwd, link.from);
    if (!existsSync(fromPath)) {
      console.warn(
        pc.yellow(
          t('警告：源路径不存在，跳过', 'Warning: source path not found, skipping', locale, config.locale) +
            `: ${link.from}`,
        ),
      );
      continue;
    }
    validMappings.push(link);

    // 收集目标路径用于 .gitignore
    gitignoreEntries.push(link.to);
  }

  if (validMappings.length === 0) {
    console.log(
      pc.yellow(
        t('没有可同步的映射', 'No mappings to sync', locale, config.locale),
      ),
    );
    return;
  }

  // 4. .gitignore 处理
  if (gitignoreEntries.length > 0) {
    if (autoConfirm) {
      const { added, skipped } = await addToGitignore(cwd, gitignoreEntries);
      if (added.length > 0) {
        console.log(
          pc.green(
            t('已添加到 .gitignore', 'Added to .gitignore', locale, config.locale) +
              `: ${added.join(', ')}`,
          ),
        );
      }
      if (skipped.length > 0) {
        console.log(
          pc.gray(
            t('.gitignore 中已存在', 'Already in .gitignore', locale, config.locale) +
              `: ${skipped.join(', ')}`,
          ),
        );
      }
    } else {
      const answer = await select({
        message: t(
          `是否将 ${gitignoreEntries.join(', ')} 添加到 .gitignore？`,
          `Add ${gitignoreEntries.join(', ')} to .gitignore?`,
          locale,
          config.locale,
        ),
        choices: [
          {
            name: t('添加', 'Add', locale, config.locale),
            value: 'yes',
          },
          {
            name: t('跳过', 'Skip', locale, config.locale),
            value: 'no',
          },
        ],
      });

      if (answer === 'yes') {
        const { added } = await addToGitignore(cwd, gitignoreEntries);
        if (added.length > 0) {
          console.log(
            pc.green(
              t('已添加到 .gitignore', 'Added to .gitignore', locale, config.locale) +
                `: ${added.join(', ')}`,
            ),
          );
        }
      }
    }
  }

  // 5. 执行符号链接同步
  const linker = new Linker(
    cwd,
    { links: validMappings, locale: config.locale },
    { autoConfirm, locale, configLocale: config.locale },
  );
  const syncedCount = await linker.sync();
  console.log(
    pc.green(
      t(
        `同步完成，共处理 ${syncedCount} 条映射`,
        `Sync completed, processed ${syncedCount} mapping(s)`,
        locale,
        config.locale,
      ),
    ),
  );
}
