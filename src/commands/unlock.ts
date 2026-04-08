import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { password } from '@inquirer/prompts';
import pc from 'picocolors';
import { loadConfig } from '@/core/config.js';
import { resolveLocale, t } from '@/utils/locale.js';
import { decrypt } from '@/utils/crypto.js';

const DEFAULT_ENCRYPT_FILES = ['.mcp.json'];

/**
 * 还原命令：将 .lock 文件解密还原为原始文件
 */
export async function unlockCommand(options: { cwd?: string; files?: string[] }) {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);
  const locale = resolveLocale(config.locale);

  // 确定要还原的文件列表
  const files = options.files && options.files.length > 0
    ? options.files
    : config.encrypt ?? DEFAULT_ENCRYPT_FILES;

  if (files.length === 0) {
    console.log(pc.yellow(t('没有需要还原的文件', 'No files to unlock', locale, config.locale)));
    return;
  }

  // 检查哪些 .lock 文件实际存在
  const existingLocks: string[] = [];
  for (const file of files) {
    const lockPath = path.resolve(cwd, `${file}.lock`);
    if (!existsSync(lockPath)) {
      console.warn(pc.yellow(t(`锁文件不存在，跳过: `, 'Lock file not found, skipping: ', locale, config.locale) + `${file}.lock`));
      continue;
    }
    existingLocks.push(file);
  }

  if (existingLocks.length === 0) {
    console.log(pc.yellow(t('没有可还原的锁文件', 'No lock files available to unlock', locale, config.locale)));
    return;
  }

  // 提示输入密码
  const pwd = await password({
    message: t('输入解密密码', 'Enter decryption password', locale, config.locale),
    mask: '*',
  });

  if (!pwd) {
    console.error(pc.red(t('密码不能为空', 'Password cannot be empty', locale, config.locale)));
    process.exit(1);
  }

  // 执行解密（保留 .lock 文件，还原文件存在则替换）
  let count = 0;
  let failed = 0;
  for (const file of existingLocks) {
    const lockPath = path.resolve(cwd, `${file}.lock`);
    const encryptedText = await fs.readFile(lockPath, 'utf-8');

    let decrypted: string;
    try {
      decrypted = decrypt(encryptedText, pwd);
    } catch {
      console.warn(pc.yellow(t(`解密失败，跳过: `, 'Decryption failed, skipping: ', locale, config.locale) + `${file}.lock`));
      failed++;
      continue;
    }

    const filePath = path.resolve(cwd, file);
    await fs.writeFile(filePath, decrypted, 'utf-8');

    console.log(
      pc.green(`+ ${path.basename(file)}.lock -> ${file}`) +
      pc.gray(
        ` ${t('(已还原)', '(decrypted)', locale, config.locale)}`,
      ),
    );
    count++;
  }

  console.log('');
  if (count > 0) {
    console.log(
      pc.green(
        t(`✓ ${count} 个文件已还原`, `✓ ${count} file(s) decrypted`, locale, config.locale),
      ),
    );
  }
  if (failed > 0) {
    console.log(
      pc.yellow(
        t(`⚠ ${failed} 个文件解密失败（密码错误或文件损坏）`, `⚠ ${failed} file(s) failed to decrypt (wrong password or corrupted)`, locale, config.locale),
      ),
    );
  }
}
