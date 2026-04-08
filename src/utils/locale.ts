import type { Locale } from '../types/index.js';

/**
 * 解析语言配置，auto 时检测系统语言
 */
export function resolveLocale(configLocale?: Locale): 'en' | 'zh-CN' {
  if (configLocale && configLocale !== 'auto') {
    return configLocale;
  }

  // auto: 检测系统语言
  const lang =
    process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || '';
  if (lang.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

/**
 * 判断是否中文语言
 */
export function isChineseLocale(locale: 'en' | 'zh-CN'): boolean {
  return locale === 'zh-CN';
}

/**
 * 双语输出工具
 * - 中文模式 + auto：中文（English）
 * - 中文模式 + zh-CN：纯中文
 * - 英文模式：纯英文
 */
export function t(
  zh: string,
  en: string,
  locale: 'en' | 'zh-CN',
  configLocale?: Locale,
): string {
  if (locale === 'en') return en;
  // auto 模式下中英双语显示
  if (configLocale === 'auto' || configLocale === undefined) {
    return `${zh} (${en})`;
  }
  return zh;
}
