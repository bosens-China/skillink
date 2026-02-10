import chokidar from 'chokidar';
import path from 'node:path';
import { loadConfig } from '@/core/config.js';
import { Linker } from '@/core/linker.js';
import pc from 'picocolors';

/**
 * 同步命令
 * @param options.watch 是否启用监视模式
 * @param options.cwd 当前工作目录
 */
export async function syncCommand(options: { watch?: boolean; cwd?: string }) {
  const cwd = options.cwd || process.cwd();

  // 1. 加载配置
  const config = await loadConfig(cwd);
  if (!config) {
    console.error(pc.red('❌ 未找到配置。请先运行 "skillink init"。'));
    process.exit(1);
  }

  const linker = new Linker(cwd, config);

  // 2. 初始同步
  console.log(pc.cyan('🔄 正在同步技能...'));
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
      console.error(pc.red(`❌ ${r.skill} -> ${r.target}: ${r.message}`));
    }
  });

  if (changes === 0) {
    console.log(pc.gray('无需更改。所有技能已同步。'));
  } else {
    console.log(pc.green(`✅ 已同步 ${changes} 处变更。`));
  }

  // 3. 监视模式
  if (options.watch) {
    console.log(pc.cyan('\n👀 正在监视变更... 按 Ctrl+C 停止。'));

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
          console.log(pc.green(`+ 检测到新技能: ${fileName}`));
          await linker.syncSkillToAll(fileName);
        } else if (event === 'unlinkDir') {
          console.log(pc.red(`- 技能已移除: ${fileName}`));
          await linker.removeSkillFromAll(fileName);
        }
      } catch (error: unknown) {
        console.error(
          pc.red(
            `❌ 处理监视事件失败: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    });
  }
}
