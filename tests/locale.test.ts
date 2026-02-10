import { describe, expect, it } from 'vitest';
import { isChineseLocale, resolveLocale } from '../src/utils/locale.js';

describe('locale utils', () => {
  it('默认回退到英文', () => {
    expect(resolveLocale()).toBe('en');
    expect(resolveLocale('unknown')).toBe('en');
  });

  it('支持中文 locale 解析', () => {
    expect(resolveLocale('zh-CN')).toBe('zh-CN');
    expect(isChineseLocale('zh-CN')).toBe(true);
  });
});
