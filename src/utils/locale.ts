import type { Locale } from '@/types/index.js';

/**
 * 解析语言配置，默认使用英文
 */
export function resolveLocale(locale?: string): Locale {
  return locale === 'zh-CN' ? 'zh-CN' : 'en';
}

/**
 * 判断当前是否为中文
 */
export function isChineseLocale(locale: Locale): boolean {
  return locale === 'zh-CN';
}
