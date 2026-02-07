/**
 * 日志工具 - 使用 picocolors 实现彩色输出
 */
import pc from 'picocolors';

export const logger = {
  /** 信息日志 */
  info(message: string): void {
    console.log(pc.blue('ℹ'), message);
  },

  /** 成功日志 */
  success(message: string): void {
    console.log(pc.green('✓'), message);
  },

  /** 错误日志 */
  error(message: string): void {
    console.log(pc.red('✗'), message);
  },

  /** 警告日志 */
  warn(message: string): void {
    console.log(pc.yellow('⚠'), message);
  },

  /** 分隔线 */
  divider(): void {
    console.log(pc.gray('─'.repeat(50)));
  },

  /** 标题 */
  title(message: string): void {
    console.log();
    console.log(pc.bold(message));
    console.log(pc.gray('─'.repeat(message.length)));
  },

  /** 列表项 */
  list(
    items: Array<{
      label: string;
      value?: string;
      status?: 'ok' | 'error' | 'warn' | 'info';
    }>,
  ): void {
    for (const item of items) {
      const icon =
        item.status === 'ok'
          ? pc.green('✓')
          : item.status === 'error'
            ? pc.red('✗')
            : item.status === 'warn'
              ? pc.yellow('⚠')
              : pc.blue('•');

      const label = pc.white(item.label);
      const value = item.value ? pc.gray(item.value) : '';

      console.log(`  ${icon} ${label} ${value}`);
    }
  },

  /** 空行 */
  newline(): void {
    console.log();
  },
};
