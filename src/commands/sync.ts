import chokidar from 'chokidar';
import path from 'node:path';
import { loadConfig } from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import pc from 'picocolors';
import { isChineseLocale, resolveLocale } from '@/utils/locale.js';

/**
 * 同步命令
 * @param options.watch 是否启用监视模式
 * @param options.cwd 当前工作目录
 */
export async function syncCommand(options: { watch?: boolean; cwd?: string }) {
  const cwd = options.cwd || process.cwd();
  const fallbackLocale = resolveLocale();
  const fallbackChinese = isChineseLocale(fallbackLocale);

  // 1. 加载配置
  const config = await loadConfig(cwd);
  if (!config) {
    console.error(
      pc.red(
        fallbackChinese
          ? '❌ 未找到配置。请先运行 "skillink init"。'
          : '❌ Configuration not found. Run "skillink init" first.',
      ),
    );
    process.exit(1);
  }
  const locale = resolveLocale(config.locale);
  const isChinese = isChineseLocale(locale);

  const linker = new Linker(cwd, config);

  // 2. 初始同步
  console.log(
    pc.cyan(isChinese ? '🔄 正在同步技能...' : '🔄 Syncing skills...'),
  );
  const results = await linker.sync();

  // 打印结果
  let changes = 0;
  results.forEach((r) => {
    if (r.status === 'linked' || r.status === 'cleaned') {
      console.log(
        `${pc.green(r.status === 'linked' ? '+' : '-')} ${r.skill} -> ${r.target}`,
      );
      changes++;
    } else if (r.status === 'failed') {
      console.error(
        pc.red(
          isChinese
            ? `❌ ${r.skill} -> ${r.target}: ${r.message}`
            : `❌ ${r.skill} -> ${r.target}: ${r.message}`,
        ),
      );
    }
  });

  if (changes === 0) {
    console.log(
      pc.gray(
        isChinese
          ? '无需更改。所有技能已同步。'
          : 'No changes needed. All skills are already synced.',
      ),
    );
  } else {
    console.log(
      pc.green(
        isChinese
          ? `✅ 已同步 ${changes} 处变更。`
          : `✅ Synced ${changes} change(s).`,
      ),
    );
  }

  // 3. 监视模式
  if (options.watch) {
    console.log(
      pc.cyan(
        isChinese
          ? '\n👀 正在监视变更... 按 Ctrl+C 停止。'
          : '\n👀 Watching for changes... Press Ctrl+C to stop.',
      ),
    );

    const sourceDir = path.resolve(cwd, config.source || '.agents/skills');

    // 只监视源目录的一级子目录（技能目录）的增加和删除
    const watcher = chokidar.watch(sourceDir, {
      ignoreInitial: true,
      depth: 1,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    watcher.on('all', async (event, filePath) => {
      // 仅处理源目录下“一级子目录”的增删事件
      if (path.dirname(filePath) !== sourceDir) return;

      const fileName = path.basename(filePath);
      if (!fileName || fileName.startsWith('.')) return;

      try {
        if (event === 'addDir') {
          console.log(
            pc.green(
              isChinese
                ? `+ 检测到新技能: ${fileName}`
                : `+ New skill detected: ${fileName}`,
            ),
          );
          await linker.syncSkillToAll(fileName);
        } else if (event === 'unlinkDir') {
          console.log(
            pc.red(
              isChinese
                ? `- 技能已移除: ${fileName}`
                : `- Skill removed: ${fileName}`,
            ),
          );
          await linker.removeSkillFromAll(fileName);
        }
      } catch (error: unknown) {
        console.error(
          pc.red(
            isChinese
              ? `❌ 处理监视事件失败: ${error instanceof Error ? error.message : String(error)}`
              : `❌ Failed to process watch event: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  }
}
