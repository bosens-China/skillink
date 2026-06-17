import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig } from '@/core/config.js';
import { DEFAULT_ENCRYPT_FILES } from '@/core/constants.js';
import { decrypt } from '@/utils/crypto.js';
import { readEncryptManifest } from '@/utils/encrypt-manifest.js';
import { resolvePassword } from './lock.js';

interface UnlockOptions {
  cwd?: string;
  files?: string[];
  password?: string;
}

/**
 * 还原命令：将 .lock 文件解密还原为原始文件。
 * 无参时优先使用 skillink.encrypt.json 中的列表；清单为空则回退 config.encrypt。
 */
export async function unlockCommand(options: UnlockOptions) {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);

  p.intro(pc.bgMagenta(pc.black(' skillink unlock ')));

  // 1. 候选文件
  const hasCliFiles = options.files && options.files.length > 0;
  let files: string[];
  if (hasCliFiles) {
    files = options.files!;
  } else {
    const manifest = await readEncryptManifest(cwd);
    if (manifest && manifest.files.length > 0) {
      files = manifest.files;
    } else {
      files = config.encrypt ?? DEFAULT_ENCRYPT_FILES;
    }
  }

  if (files.length === 0) {
    p.outro(pc.yellow('没有需要还原的文件'));
    return;
  }

  // 2. 过滤实际存在的 .lock
  const existingLocks: string[] = [];
  for (const file of files) {
    const lockPath = path.resolve(cwd, `${file}.lock`);
    if (existsSync(lockPath)) {
      existingLocks.push(file);
    } else {
      p.log.warn(`锁文件不存在，跳过：${pc.dim(`${file}.lock`)}`);
    }
  }

  if (existingLocks.length === 0) {
    p.outro(pc.yellow('没有可还原的锁文件'));
    return;
  }

  // 3. 密码
  const pwd = await resolvePassword({
    cliPassword: options.password,
    promptMessage: '输入解密密码',
  });

  // 4. 执行解密
  const spinner = p.spinner();
  spinner.start(`解密 ${existingLocks.length} 个文件`);

  const succeeded: string[] = [];
  const failed: string[] = [];
  for (const file of existingLocks) {
    const lockPath = path.resolve(cwd, `${file}.lock`);
    const encryptedText = await fs.readFile(lockPath, 'utf-8');
    try {
      const decrypted = decrypt(encryptedText, pwd);
      await fs.writeFile(path.resolve(cwd, file), decrypted, 'utf-8');
      succeeded.push(file);
    } catch {
      failed.push(file);
    }
  }

  if (failed.length === 0) {
    spinner.stop(`已还原 ${pc.green(succeeded.length)} 个文件`);
  } else if (succeeded.length === 0) {
    spinner.stop(pc.red('全部解密失败'));
  } else {
    spinner.stop(
      `部分还原：成功 ${pc.green(succeeded.length)} · 失败 ${pc.red(failed.length)}`,
    );
  }

  if (succeeded.length > 0) {
    p.note(
      succeeded
        .map(
          (f) =>
            `${pc.cyan(`${path.basename(f)}.lock`)}  ${pc.dim('→')}  ${pc.green(f)}`,
        )
        .join('\n'),
      '还原结果',
    );
  }

  if (failed.length > 0) {
    p.log.error(
      `解密失败（密码错误或文件损坏）：${pc.red(failed.join(', '))}`,
    );
    p.outro(pc.red('部分文件未能还原'));
    process.exit(1);
  }

  p.outro(pc.green('全部还原完毕 ✓'));
}
