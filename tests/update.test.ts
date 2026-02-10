import { describe, expect, it } from 'vitest';
import { resolveLatestSemverVersion } from '../src/utils/update.js';

describe('resolveLatestSemverVersion', () => {
  it('返回最高稳定语义化版本', () => {
    const result = resolveLatestSemverVersion(['1.0.0', '1.2.0', '1.10.0']);
    expect(result).toBe('1.10.0');
  });

  it('忽略预发布版本', () => {
    const result = resolveLatestSemverVersion([
      '1.0.0',
      '2.0.0-beta.1',
      '1.5.0',
    ]);
    expect(result).toBe('1.5.0');
  });
});
