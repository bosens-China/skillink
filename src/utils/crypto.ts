import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import type { EncryptedPartLabel } from './errors.js';
import { SkillinkError } from './errors.js';

const FORMAT_VERSION = 'v2';
const ALGORITHM = 'aes-256-gcm' as const;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function fromHexPart(value: string, label: EncryptedPartLabel): Buffer {
  if (!/^(?:[\da-f]{2})*$/i.test(value)) {
    throw new SkillinkError('INVALID_HEX_PART', `Invalid ${label}`, {
      meta: { label },
    });
  }
  return Buffer.from(value, 'hex');
}

/**
 * 使用 AES-256-GCM 加密内容，并附带认证标签用于校验是否被篡改
 * 输出格式：v2:salt:iv:authTag:encryptedData（全部 hex 编码）
 */
export function encrypt(content: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(content, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${FORMAT_VERSION}:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * 使用 AES-256-GCM 解密内容，并校验认证标签
 * 输入格式：v2:salt:iv:authTag:encryptedData（全部 hex 编码）
 */
export function decrypt(encryptedText: string, password: string): string {
  const parts = encryptedText.split(':');

  // 旧版 CBC 格式没有完整性校验，无法可靠判断文件是否被篡改。
  if (parts.length === 3) {
    throw new SkillinkError(
      'LEGACY_ENCRYPTED_FORMAT',
      'Legacy encrypted format is not authenticated. Please re-encrypt the file with skillink lock.',
    );
  }

  if (parts.length !== 5) {
    throw new SkillinkError(
      'INVALID_ENCRYPTED_FORMAT',
      'Invalid encrypted format',
    );
  }
  const [version, saltHex, ivHex, authTagHex, dataHex] = parts;
  if (version !== FORMAT_VERSION) {
    throw new SkillinkError(
      'INVALID_ENCRYPTED_FORMAT',
      'Invalid encrypted format',
    );
  }

  const salt = fromHexPart(saltHex, 'salt');
  const iv = fromHexPart(ivHex, 'iv');
  const authTag = fromHexPart(authTagHex, 'auth tag');
  const encrypted = fromHexPart(dataHex, 'ciphertext');

  if (salt.length !== SALT_LENGTH) {
    throw new SkillinkError('INVALID_SEGMENT_LENGTH', 'Invalid salt length', {
      meta: { label: 'salt' },
    });
  }
  if (iv.length !== IV_LENGTH) {
    throw new SkillinkError('INVALID_SEGMENT_LENGTH', 'Invalid IV length', {
      meta: { label: 'iv' },
    });
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new SkillinkError(
      'INVALID_SEGMENT_LENGTH',
      'Invalid auth tag length',
      {
        meta: { label: 'auth tag' },
      },
    );
  }

  const key = scryptSync(password, salt, KEY_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
