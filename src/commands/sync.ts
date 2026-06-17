import path from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  loadConfig,
  hasConfigFile,
  createDefaultConfig,
} from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import { resolveLinkMappings } from '@/core/resolve-mappings.js';
import { addToGitignore, collectGitignoreEntries } from '@/utils/gitignore.js';
import type { LinkMapping } from '@/types/index.js';

interface SyncOptions {
  cwd?: string;
  yes?: boolean;
  dryRun?: boolean;
}

/**
 * 默认命令：init + sync 一体化流程
 */
export async function syncCommand(options: SyncOptions) {
  const cwd = options.cwd || process.cwd();
  const autoConfirm = options.yes || false;
  const dryRun = options.dryRun || false;

  p.intro(pc.bgCyan(pc.black(' skillink ')));

  // 1. 检查/创建配置文件
  if (!hasConfigFile(cwd)) {
    const { configPath, detection } = await createDefaultConfig(cwd);

    const detected = detection.hasAgents
      ? '.agents / AGENTS.md'
      : detection.hasClaude
        ? '.claude / CLAUDE.md'
        : '未发现已有目录';

    const directionLabel =
      detection.direction === 'agents-to-claude'
        ? '.agents/AGENTS.md → .claude/CLAUDE.md'
        : '.claude/CLAUDE.md → .agents/AGENTS.md';

    p.note(
      [
        `仓库检测：${pc.cyan(detected)}`,
        `生成模板：${pc.cyan(directionLabel)}`,
        `配置文件：${pc.green(path.relative(cwd, configPath) || 'skillink.config.ts')}`,
      ].join('\n'),
      '首次运行已生成默认配置',
    );
  }

  // 2. 加载配置 + 解析映射
  const config = await loadConfig(cwd);
  const resolveSpinner = p.spinner();
  resolveSpinner.start('解析映射规则');
  const { mappings, warnings } = await resolveLinkMappings(cwd, config);
  resolveSpinner.stop(
    `解析完成：${pc.bold(String(mappings.length))} 条映射`,
  );

  for (const w of warnings) {
    p.log.warn(`未匹配任何路径，跳过规则：${pc.dim(w)}`);
  }

  if (mappings.length === 0) {
    p.outro(pc.yellow('没有可同步的映射，编辑 skillink.config.ts 后重试'));
    return;
  }

  // 3. 显示摘要
  p.note(formatMappingsTable(cwd, mappings), '将同步的映射');

  if (dryRun) {
    p.outro(pc.cyan('dry-run：未写入文件系统'));
    return;
  }

  // 4. .gitignore：每次都计算"还没在 gitignore 里的新目标名"
  const candidates = collectGitignoreEntries(mappings.map((m) => m.to));
  if (candidates.length > 0) {
    const { added: dryAdded } = await addToGitignore(cwd, candidates, {
      dryRun: true,
    });
    if (dryAdded.length > 0) {
      const accept = autoConfirm
        ? true
        : await confirmOrCancel(
            `把 ${pc.cyan(dryAdded.join(', '))} 加入 .gitignore？`,
            true,
          );
      if (accept) {
        const { added } = await addToGitignore(cwd, dryAdded);
        if (added.length > 0) {
          p.log.success(`已写入 .gitignore：${pc.cyan(added.join(', '))}`);
        }
      } else {
        p.log.info('跳过 .gitignore 更新');
      }
    }
  }

  // 5. 执行符号链接同步
  const syncSpinner = p.spinner();
  syncSpinner.start('创建符号链接');

  const linker = new Linker(cwd, { links: mappings }, { autoConfirm });
  let result;
  try {
    result = await linker.sync();
  } catch (error: unknown) {
    syncSpinner.stop(pc.red('同步失败'));
    const err = error as NodeJS.ErrnoException;
    if (process.platform === 'win32' && err.code === 'EPERM') {
      throw new Error(
        '创建链接失败（Windows 权限限制）。请开启开发者模式，或以管理员权限运行终端后重试。',
        { cause: error },
      );
    }
    throw error;
  }

  syncSpinner.stop(
    `同步完成：新建 ${pc.green(result.created)} · 已存在 ${pc.dim(result.reused)} · 跳过 ${pc.yellow(result.skipped)}`,
  );

  p.outro(pc.green('全部处理完毕 ✓'));
}

/**
 * 简易表格：左侧 from → 右侧 to，按当前控制台宽度做对齐
 */
function formatMappingsTable(cwd: string, mappings: LinkMapping[]): string {
  const rows = mappings.map((m) => ({
    from: path.relative(cwd, path.resolve(cwd, m.from)) || m.from,
    to: path.relative(cwd, path.resolve(cwd, m.to)) || m.to,
  }));
  const fromWidth = Math.min(
    Math.max(...rows.map((r) => r.from.length), 4),
    40,
  );
  return rows
    .map(
      (r) =>
        `${pc.cyan(r.from.padEnd(fromWidth))}  ${pc.dim('→')}  ${pc.green(r.to)}`,
    )
    .join('\n');
}

/**
 * 包一层 confirm，处理 Ctrl+C 取消
 */
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
