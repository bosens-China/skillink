import path from 'node:path';
import { select, confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import {
  loadConfig,
  hasConfigFile,
  createDefaultConfig,
} from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import { resolveLinkMappings } from '@/core/resolve-mappings.js';
import { resolveLocale, t } from '@/utils/locale.js';
import { addToGitignore, collectGitignoreEntries } from '@/utils/gitignore.js';
import type { Locale } from '@/types/index.js';

/**
 * 主命令：init + sync 一体化流程
 */
export async function syncCommand(options: { cwd?: string; yes?: boolean }) {
  const cwd = options.cwd || process.cwd();
  const autoConfirm = options.yes || false;
  const hadConfigFile = hasConfigFile(cwd);

  // 1. 检查/创建配置文件
  if (!hadConfigFile) {
    const defaultLocale = resolveLocale(); // 基于系统语言确定默认值

    // 提示用户选择语言（--yes 模式下直接使用 auto）
    const selectedLocale = autoConfirm
      ? 'auto'
      : ((await select({
          message: t(
            '请选择语言偏好 / Please select language preference',
            'Please select language preference / 请选择语言偏好',
            defaultLocale,
          ),
          choices: [
            { name: 'Auto (Detect System)', value: 'auto' },
            { name: 'English Only', value: 'en' },
            { name: '简体中文 (仅中文)', value: 'zh-CN' },
          ],
          default: 'auto',
        })) as Locale);

    const configPath = await createDefaultConfig(cwd, selectedLocale);
    const locale = resolveLocale(selectedLocale);
    console.log(
      pc.cyan(
        t(
          '首次使用，已创建默认配置文件：',
          'First time use, created default config file: ',
          locale,
          selectedLocale,
        ) + pc.green(path.relative(cwd, configPath)),
      ),
    );
  }

  // 2. 加载配置（此时如果是刚创建的，selectedLocale 已经生效）
  const config = await loadConfig(cwd);
  const locale = resolveLocale(config.locale);

  // 3. 解析 glob + 字面量映射
  const { mappings: validMappings, warnings } = await resolveLinkMappings(
    cwd,
    config,
  );

  for (const w of warnings) {
    console.warn(
      pc.yellow(
        t(
          `未匹配任何路径，跳过规则: ${w}`,
          `No paths matched, skipping rule: ${w}`,
          locale,
          config.locale,
        ),
      ),
    );
  }

  // 仅首次初始化时处理 .gitignore，避免后续重复打扰或写入多余子路径。
  const gitignoreEntries = hadConfigFile
    ? []
    : collectGitignoreEntries(validMappings.map((mapping) => mapping.to));

  if (validMappings.length === 0) {
    console.log(
      pc.yellow(
        t(
          !hadConfigFile
            ? '当前配置没有解析出任何同步目标。你可以编辑 skillink.config.ts 后重试。'
            : '没有可同步的映射',
          !hadConfigFile
            ? 'No sync targets resolved. You can edit skillink.config.ts and retry.'
            : 'No mappings to sync',
          locale,
          config.locale,
        ),
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
            t(
              '已添加到 .gitignore',
              'Added to .gitignore',
              locale,
              config.locale,
            ) + `: ${added.join(', ')}`,
          ),
        );
      }
      if (skipped.length > 0) {
        console.log(
          pc.gray(
            t(
              '.gitignore 中已存在',
              'Already in .gitignore',
              locale,
              config.locale,
            ) + `: ${skipped.join(', ')}`,
          ),
        );
      }
    } else {
      const answer = await confirm({
        message: t(
          `检测到将要生成 ${gitignoreEntries.join(', ')}，这些通常不建议提交。要不要帮你加入 .gitignore？`,
          `Detected generated targets ${gitignoreEntries.join(', ')} which are usually not recommended for commit. Add them to .gitignore?`,
          locale,
          config.locale,
        ),
        default: true,
      });

      if (answer) {
        const { added } = await addToGitignore(cwd, gitignoreEntries);
        if (added.length > 0) {
          console.log(
            pc.green(
              t(
                '已添加到 .gitignore',
                'Added to .gitignore',
                locale,
                config.locale,
              ) + `: ${added.join(', ')}`,
            ),
          );
        }
      }
    }
  }

  if (!hadConfigFile) {
    console.log(
      pc.cyan(
        t(
          '已完成初始化。后续你可以修改配置来调整同步规则，后续运行将不再重复处理 .gitignore。',
          'Initialization complete. You can modify the config to adjust sync rules; future runs will not prompt for .gitignore again.',
          locale,
          config.locale,
        ),
      ),
    );
  }

  // 5. 执行符号链接同步
  const linker = new Linker(
    cwd,
    { links: validMappings, locale: config.locale },
    { autoConfirm, locale, configLocale: config.locale },
  );
  let syncedCount: number;
  try {
    syncedCount = await linker.sync();
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (process.platform === 'win32' && err.code === 'EPERM') {
      throw new Error(
        t(
          '创建链接失败（Windows 权限限制）。请开启开发者模式，或以管理员权限运行终端后重试。',
          'Failed to create link due to Windows permission restrictions. Enable Developer Mode, or run terminal as Administrator and retry.',
          locale,
          config.locale,
        ),
        { cause: error },
      );
    }
    throw error;
  }
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
