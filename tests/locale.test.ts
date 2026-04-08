import { describe, expect, it } from 'vitest';
import { resolveLocale, isChineseLocale, t } from '../src/utils/locale.js';

describe('locale utils', () => {
  it('auto 模式根据系统语言检测', () => {
    const origLang = process.env.LANG;
    try {
      process.env.LANG = 'zh_CN.UTF-8';
      expect(resolveLocale('auto')).toBe('zh-CN');

      process.env.LANG = 'en_US.UTF-8';
      expect(resolveLocale('auto')).toBe('en');
    } finally {
      process.env.LANG = origLang;
    }
  });

  it('非 auto 时直接返回配置值', () => {
    expect(resolveLocale('zh-CN')).toBe('zh-CN');
    expect(resolveLocale('en')).toBe('en');
  });

  it('isChineseLocale 正确判断', () => {
    expect(isChineseLocale('zh-CN')).toBe(true);
    expect(isChineseLocale('en')).toBe(false);
  });

  it('t 函数在 en 模式返回英文', () => {
    expect(t('中文', 'English', 'en')).toBe('English');
  });

  it('t 函数在 auto 模式返回双语', () => {
    expect(t('中文', 'English', 'zh-CN', 'auto')).toBe('中文 (English)');
  });

  it('t 函数在 zh-CN 模式返回纯中文', () => {
    expect(t('中文', 'English', 'zh-CN', 'zh-CN')).toBe('中文');
  });
});
