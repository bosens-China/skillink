import { describe, expect, it } from 'vitest';
import { encrypt, decrypt } from '../src/utils/crypto.js';

describe('crypto', () => {
  it('should encrypt and decrypt roundtrip correctly', () => {
    const original = '{"key": "secret-value", "nested": {"a": 1}}';
    const password = 'my-test-password';

    const encrypted = encrypt(original, password);
    const decrypted = decrypt(encrypted, password);

    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertext for same input (random salt/iv)', () => {
    const content = 'same content';
    const password = 'same-password';

    const enc1 = encrypt(content, password);
    const enc2 = encrypt(content, password);

    expect(enc1).not.toBe(enc2);
    // but both decrypt to the same content
    expect(decrypt(enc1, password)).toBe(content);
    expect(decrypt(enc2, password)).toBe(content);
  });

  it('should fail with wrong password', () => {
    const content = 'secret data';
    const encrypted = encrypt(content, 'correct-password');

    expect(() => decrypt(encrypted, 'wrong-password')).toThrow();
  });

  it('should fail with invalid format', () => {
    expect(() => decrypt('invalid-data', 'password')).toThrow(
      'Invalid encrypted format',
    );
  });

  it('should handle empty string', () => {
    const encrypted = encrypt('', 'password');
    expect(decrypt(encrypted, 'password')).toBe('');
  });

  it('should handle unicode content', () => {
    const content = '{"name": "你好世界", "emoji": "🔒"}';
    const encrypted = encrypt(content, '密码');
    expect(decrypt(encrypted, '密码')).toBe(content);
  });
});
