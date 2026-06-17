import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig } from '@/core/config.js';
import { DEFAULT_ENCRYPT_FILES } from '@/core/constants.js';
import { encrypt } from '@/utils/crypto.js';
import {
  mergeEncryptManifestFiles,
  toManifestRelPath,
} from '@/utils/encrypt-manifest.js';
import { addToGitignore } from '@/utils/gitignore.js';

interface LockOptions {
  cwd?: string;
  files?: string[];
  password?: string;
}

/**
 * 加密命令：将指定文件加密为 .lock 文件，并合并记录到 skillink.encrypt.json
 */
export async function lockCommand(options: LockOptions) {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);

  p.intro(pc.bgMagenta(pc.black(' skillink lock ')));

  // 1. 确定要加密的文件列表
  const files =
    options.files && options.files.length > 0
      ? options.files
      : (config.encrypt ?? DEFAULT_ENCRYPT_FILES);

  if (files.length === 0) {
    p.outro(pc.yellow('没有需要加密的文件'));
    return;
  }

  // 2. 过滤实际存在的文件
  const existingFiles: string[] = [];
  for (const file of files) {
    if (existsSync(path.resolve(cwd, file))) {
      existingFiles.push(file);
    } else {
      p.log.warn(`文件不存在，跳过：${pc.dim(file)}`);
    }
  }

  if (existingFiles.length === 0) {
    p.outro(pc.yellow('没有可加密的文件'));
    return;
  }

  // 3. 获取密码：CLI 参数 > 环境变量 > 交互输入
  const pwd = await resolvePassword({
    cliPassword: options.password,
    promptMessage: '输入加密密码',
  });

  // 4. 执行加密
  const lockSpinner = p.spinner();
  lockSpinner.start(`加密 ${existingFiles.length} 个文件`);

  const manifestRel: string[] = [];
  const succeeded: string[] = [];
  try {
    for (const file of existingFiles) {
      const filePath = path.resolve(cwd, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const encrypted = encrypt(content, pwd);
      await fs.writeFile(`${filePath}.lock`, encrypted, 'utf-8');
      manifestRel.push(toManifestRelPath(cwd, file));
      succeeded.push(file);
    }
  } catch (error: unknown) {
    lockSpinner.stop(pc.red('加密失败'));
    throw error;
  }

  await mergeEncryptManifestFiles(cwd, manifestRel);
  lockSpinner.stop(`已加密 ${pc.green(succeeded.length)} 个文件`);

  // 5. 列出明文 → .lock 对照
  p.note(
    succeeded
      .map(
        (f) =>
          `${pc.cyan(f)}  ${pc.dim('→')}  ${pc.green(`${path.basename(f)}.lock`)}`,
      )
      .join('\n'),
    '加密产物',
  );

  // 6. 提示把明文加入 .gitignore（避免误提交）；非 TTY 下打印建议但不阻塞
  const { added: dryAdded } = await addToGitignore(cwd, succeeded, {
    dryRun: true,
  });
  if (dryAdded.length > 0) {
    if (!process.stdin.isTTY) {
      p.log.warn(
        `明文文件未在 .gitignore 中（非交互环境跳过追加）：${pc.cyan(dryAdded.join(', '))}`,
      );
    } else {
      const accept = await confirmOrCancel(
        `明文文件尚未在 .gitignore 中，建议加入以避免误提交：${pc.cyan(dryAdded.join(', '))}`,
        true,
      );
      if (accept) {
        const { added } = await addToGitignore(cwd, succeeded);
        if (added.length > 0) {
          p.log.success(`已写入 .gitignore：${pc.cyan(added.join(', '))}`);
        }
      }
    }
  }

  p.outro(pc.green('清单已更新 → skillink.encrypt.json'));
}

/**
 * 解析密码来源；非 TTY 又没有给 -p / 环境变量时直接报错，避免 CI 挂死
 */
export async function resolvePassword(args: {
  cliPassword?: string;
  promptMessage: string;
}): Promise<string> {
  const fromCli = args.cliPassword?.trim();
  if (fromCli) return fromCli;
  const fromEnv = process.env.SKILLINK_PASSWORD?.trim();
  if (fromEnv) return fromEnv;

  if (!process.stdin.isTTY) {
    throw new Error(
      '当前环境无法交互输入密码。请通过 -p <password> 或环境变量 SKILLINK_PASSWORD 提供。',
    );
  }

  const result = await p.password({
    message: args.promptMessage,
    validate: (v) => (!v || v.length === 0 ? '密码不能为空' : undefined),
  });
  if (p.isCancel(result)) {
    p.cancel('已取消');
    process.exit(0);
  }
  return result;
}

async function confirmOrCancel(
  message: string,
  initial = true,
): Promise<boolean> {
  const ans = await p.confirm({ message, initialValue: initial });
  if (p.isCancel(ans)) {
    p.cancel('已取消');
    process.exit(0);
  }
  return ans;
}
