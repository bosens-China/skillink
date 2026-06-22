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
import {
  addToGitignore,
  collectGitignoreEntries,
  removeFromGitignore,
} from '@/utils/gitignore.js';
import type { LinkMapping, LinkMode } from '@/types/index.js';

interface SyncOptions {
  cwd?: string;
  yes?: boolean;
  dryRun?: boolean;
  /** postinstall 友好模式：无配置静默退出、不交互、冲突跳过、输出极简 */
  silent?: boolean;
  /** 首次生成配置时指定的同步方式（symlink / copy）；仅 init 生效 */
  mode?: string;
}

/** 校验并归一化 --mode 入参 */
function parseMode(mode: string | undefined): LinkMode | undefined {
  if (mode === undefined) {
    return undefined;
  }
  if (mode !== 'symlink' && mode !== 'copy') {
    throw new Error(`--mode 仅支持 symlink 或 copy，收到：${mode}`);
  }
  return mode;
}

/**
 * 默认命令：init + sync 一体化流程
 */
export async function syncCommand(options: SyncOptions) {
  const cwd = options.cwd || process.cwd();
  const autoConfirm = options.yes || options.silent || false;
  const dryRun = options.dryRun || false;
  const silent = options.silent || false;
  // 提前校验 --mode，非法值直接报错（即便后续会静默退出）
  const requestedMode = parseMode(options.mode);

  // silent 模式专供 postinstall：没有配置文件时直接静默退出，绝不在安装阶段生成文件
  if (silent && !hasConfigFile(cwd)) {
    return;
  }

  if (!silent) {
    p.intro(pc.bgCyan(pc.black(' skillink ')));
  }

  // 1. 检查/创建配置文件（silent 模式不会走到这里——前面已提前返回）
  if (!hasConfigFile(cwd)) {
    const { configPath, detection, mode } = await createDefaultConfig(
      cwd,
      requestedMode,
    );

    const detected = detection.hasAgents
      ? '.agents / AGENTS.md'
      : detection.hasClaude
        ? '.claude / CLAUDE.md'
        : '未发现已有目录';

    const directionLabel =
      detection.direction === 'agents-to-claude'
        ? '.agents/AGENTS.md → .claude/CLAUDE.md'
        : '.claude/CLAUDE.md → .agents/AGENTS.md';

    const modeLabel =
      mode === 'copy'
        ? 'copy（复制真实内容，可提交）'
        : 'symlink（软链接，默认忽略）';

    p.note(
      [
        `仓库检测：${pc.cyan(detected)}`,
        `生成模板：${pc.cyan(directionLabel)}`,
        `同步方式：${pc.cyan(modeLabel)}`,
        `配置文件：${pc.green(path.relative(cwd, configPath) || 'skillink.config.ts')}`,
      ].join('\n'),
      '首次运行已生成默认配置',
    );
  } else if (requestedMode && !silent) {
    // 配置已存在：--mode 只在首次生成时生效，此处明确提示已忽略
    p.log.info(
      `已存在配置文件，--mode 仅在首次生成时生效，本次忽略（请直接在 skillink.config.ts 中设置 mode）`,
    );
  }

  // 2. 加载配置 + 解析映射
  const config = await loadConfig(cwd);
  const resolveSpinner = silent ? null : p.spinner();
  resolveSpinner?.start('解析映射规则');
  const { mappings, warnings } = await resolveLinkMappings(cwd, config);
  resolveSpinner?.stop(`解析完成：${pc.bold(String(mappings.length))} 条映射`);

  if (!silent) {
    for (const w of warnings) {
      p.log.warn(`未匹配任何路径，跳过规则：${pc.dim(w)}`);
    }
  }

  if (mappings.length === 0) {
    if (!silent) {
      p.outro(pc.yellow('没有可同步的映射，编辑 skillink.config.ts 后重试'));
    }
    return;
  }

  // 3. 显示摘要
  if (!silent) {
    p.note(formatMappingsTable(cwd, mappings), '将同步的映射');
  }

  if (dryRun) {
    p.outro(pc.cyan('dry-run：未写入文件系统'));
    return;
  }

  // 4. .gitignore 维护：
  //    - symlink 目标：加入忽略
  //    - copy 目标：初衷是被提交，需从忽略中移除（仅移除不被任何 symlink 目标共用的条目名）
  const symlinkEntries = collectGitignoreEntries(
    mappings.filter((m) => m.mode !== 'copy').map((m) => m.to),
  );
  const symlinkSet = new Set(symlinkEntries);
  const copyOnlyEntries = collectGitignoreEntries(
    mappings.filter((m) => m.mode === 'copy').map((m) => m.to),
  ).filter((entry) => !symlinkSet.has(entry));

  if (symlinkEntries.length > 0) {
    const { added: dryAdded } = await addToGitignore(cwd, symlinkEntries, {
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
        if (added.length > 0 && !silent) {
          p.log.success(`已写入 .gitignore：${pc.cyan(added.join(', '))}`);
        }
      } else if (!silent) {
        p.log.info('跳过 .gitignore 更新');
      }
    }
  }

  if (copyOnlyEntries.length > 0) {
    const { removed: dryRemoved } = await removeFromGitignore(
      cwd,
      copyOnlyEntries,
      { dryRun: true },
    );
    if (dryRemoved.length > 0) {
      const accept = autoConfirm
        ? true
        : await confirmOrCancel(
            `${pc.cyan(dryRemoved.join(', '))} 为 copy 目标（需被提交），从 .gitignore 移除？`,
            true,
          );
      if (accept) {
        const { removed } = await removeFromGitignore(cwd, dryRemoved);
        if (removed.length > 0 && !silent) {
          p.log.success(`已从 .gitignore 移除：${pc.cyan(removed.join(', '))}`);
        }
      } else if (!silent) {
        p.log.info('保留 .gitignore 中的 copy 目标条目');
      }
    }
  }

  // 5. 执行同步（symlink / copy）
  const syncSpinner = silent ? null : p.spinner();
  syncSpinner?.start('同步中');

  const linker = new Linker(cwd, { links: mappings }, { autoConfirm, silent });
  let result;
  try {
    result = await linker.sync();
  } catch (error: unknown) {
    syncSpinner?.stop(pc.red('同步失败'));
    const err = error as NodeJS.ErrnoException;
    if (process.platform === 'win32' && err.code === 'EPERM') {
      throw new Error(
        '创建链接失败（Windows 权限限制）。请开启开发者模式，或以管理员权限运行终端后重试。',
        { cause: error },
      );
    }
    throw error;
  }

  const summary = `同步完成：新建 ${pc.green(result.created)} · 已存在 ${pc.dim(result.reused)} · 跳过 ${pc.yellow(result.skipped)}`;
  syncSpinner?.stop(summary);

  if (silent) {
    // postinstall 场景：仅在确有新建时打印一行，平时保持安静
    if (result.created > 0) {
      console.log(`skillink: 新建 ${result.created} 个同步目标`);
    }
    return;
  }

  p.outro(pc.green('全部处理完毕 ✓'));
}

/**
 * 简易表格：左侧 from → 右侧 to，按当前控制台宽度做对齐
 */
function formatMappingsTable(cwd: string, mappings: LinkMapping[]): string {
  const rows = mappings.map((m) => ({
    from: path.relative(cwd, path.resolve(cwd, m.from)) || m.from,
    to: path.relative(cwd, path.resolve(cwd, m.to)) || m.to,
    isCopy: m.mode === 'copy',
  }));
  const fromWidth = Math.min(
    Math.max(...rows.map((r) => r.from.length), 4),
    40,
  );
  // copy 模式用 ⇒ 区分（复制真实内容），symlink 用 →
  return rows
    .map((r) => {
      const arrow = r.isCopy ? pc.yellow('⇒') : pc.dim('→');
      const suffix = r.isCopy ? pc.dim(' (copy)') : '';
      return `${pc.cyan(r.from.padEnd(fromWidth))}  ${arrow}  ${pc.green(r.to)}${suffix}`;
    })
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
