import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encrypt, decrypt } from '../src/utils/crypto.js';

function createLegacyEncrypted(content: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(content, 'utf8'),
    cipher.final(),
  ]);

  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

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
    // 但两份密文都应解密回同一内容
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

  it('should detect tampered ciphertext', () => {
    const encrypted = encrypt('secret data', 'password');
    const parts = encrypted.split(':');
    const tamperedCiphertext =
      parts[4].slice(0, -2) + (parts[4].endsWith('aa') ? 'bb' : 'aa');
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      parts[3],
      tamperedCiphertext,
    ].join(':');

    expect(() => decrypt(tampered, 'password')).toThrow();
  });

  it('should detect tampered auth tag', () => {
    const encrypted = encrypt('secret data', 'password');
    const parts = encrypted.split(':');
    const tamperedAuthTag =
      parts[3].slice(0, -2) + (parts[3].endsWith('aa') ? 'bb' : 'aa');
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      tamperedAuthTag,
      parts[4],
    ].join(':');

    expect(() => decrypt(tampered, 'password')).toThrow();
  });

  it('should reject legacy unauthenticated format', () => {
    const legacyEncrypted = createLegacyEncrypted('secret data', 'password');

    expect(() => decrypt(legacyEncrypted, 'password')).toThrow(
      'Legacy encrypted format is not authenticated',
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
