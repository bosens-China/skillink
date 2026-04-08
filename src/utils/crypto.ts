import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-cbc' as const;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 16;

/**
 * 使用 AES-256-CBC 加密内容
 * 输出格式：salt:iv:encryptedData（全部 hex 编码）
 */
export function encrypt(content: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 使用 AES-256-CBC 解密内容
 * 输入格式：salt:iv:encryptedData（全部 hex 编码）
 */
export function decrypt(encryptedText: string, password: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  const [saltHex, ivHex, dataHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(dataHex, 'hex');
  const key = scryptSync(password, salt, KEY_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
