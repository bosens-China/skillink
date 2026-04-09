import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { password } from '@inquirer/prompts';
import pc from 'picocolors';
import { loadConfig } from '@/core/config.js';
import { resolveLocale, t } from '@/utils/locale.js';
import { encrypt } from '@/utils/crypto.js';
import {
  mergeEncryptManifestFiles,
  toManifestRelPath,
} from '@/utils/encrypt-manifest.js';

const DEFAULT_ENCRYPT_FILES = ['.mcp.json'];

/**
 * 加密命令：将指定文件加密为 .lock 文件，并合并记录到 skillink.encrypt.json
 */
export async function lockCommand(options: { cwd?: string; files?: string[] }) {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);
  const locale = resolveLocale(config.locale);

  // 确定要加密的文件列表
  const files =
    options.files && options.files.length > 0
      ? options.files
      : (config.encrypt ?? DEFAULT_ENCRYPT_FILES);

  if (files.length === 0) {
    console.log(
      pc.yellow(
        t('没有需要加密的文件', 'No files to encrypt', locale, config.locale),
      ),
    );
    return;
  }

  // 检查哪些文件实际存在
  const existingFiles: string[] = [];
  for (const file of files) {
    const filePath = path.resolve(cwd, file);
    if (!existsSync(filePath)) {
      console.warn(
        pc.yellow(
          t(
            `文件不存在，跳过: `,
            'File not found, skipping: ',
            locale,
            config.locale,
          ) + file,
        ),
      );
      continue;
    }
    existingFiles.push(file);
  }

  if (existingFiles.length === 0) {
    console.log(
      pc.yellow(
        t(
          '没有可加密的文件',
          'No files available to encrypt',
          locale,
          config.locale,
        ),
      ),
    );
    return;
  }

  // 提示输入密码
  const pwd = await password({
    message: t(
      '输入加密密码',
      'Enter encryption password',
      locale,
      config.locale,
    ),
    mask: '*',
  });

  if (!pwd) {
    console.error(
      pc.red(
        t('密码不能为空', 'Password cannot be empty', locale, config.locale),
      ),
    );
    process.exit(1);
  }

  // 执行加密（保留原始文件）
  const manifestRel: string[] = [];
  let count = 0;
  for (const file of existingFiles) {
    const filePath = path.resolve(cwd, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const encrypted = encrypt(content, pwd);
    const lockPath = `${filePath}.lock`;

    await fs.writeFile(lockPath, encrypted, 'utf-8');

    manifestRel.push(toManifestRelPath(cwd, file));

    console.log(
      pc.green(`+ ${file} -> ${path.basename(file)}.lock`) +
        pc.gray(` ${t('(已加密)', '(encrypted)', locale, config.locale)}`),
    );
    count++;
  }

  await mergeEncryptManifestFiles(cwd, manifestRel);

  console.log('');
  console.log(
    pc.green(
      t(
        `✓ ${count} 个文件已加密`,
        `✓ ${count} file(s) encrypted`,
        locale,
        config.locale,
      ),
    ),
  );
  console.log(
    pc.gray(
      t(
        '已更新 skillink.encrypt.json',
        'Updated skillink.encrypt.json',
        locale,
        config.locale,
      ),
    ),
  );
}
