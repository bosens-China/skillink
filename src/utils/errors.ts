import type { Locale } from '@/types/index.js';
import { t } from './locale.js';

export type EncryptedPartLabel = 'salt' | 'iv' | 'auth tag' | 'ciphertext';

export type SkillinkErrorCode =
  | 'PATH_OUTSIDE_ROOT'
  | 'LEGACY_ENCRYPTED_FORMAT'
  | 'INVALID_ENCRYPTED_FORMAT'
  | 'INVALID_HEX_PART'
  | 'INVALID_SEGMENT_LENGTH';

interface SkillinkErrorOptions {
  cause?: unknown;
  meta?: Record<string, string>;
}

/**
 * 统一的业务错误类型，便于在 CLI 层做国际化输出。
 */
export class SkillinkError extends Error {
  readonly code: SkillinkErrorCode;
  readonly meta: Record<string, string>;

  constructor(
    code: SkillinkErrorCode,
    message: string,
    options: SkillinkErrorOptions = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'SkillinkError';
    this.code = code;
    this.meta = options.meta ?? {};
  }
}

function translatePartLabel(
  label: string | undefined,
  locale: 'en' | 'zh-CN',
  configLocale?: Locale,
): string {
  switch (label) {
    case 'salt':
      return t('盐值', 'salt', locale, configLocale);
    case 'iv':
      return t('初始向量', 'IV', locale, configLocale);
    case 'auth tag':
      return t('认证标签', 'auth tag', locale, configLocale);
    case 'ciphertext':
      return t('密文', 'ciphertext', locale, configLocale);
    default:
      return label ?? t('字段', 'field', locale, configLocale);
  }
}

/**
 * 将内部错误转换为终端可见的国际化文案。
 */
export function formatErrorMessage(
  error: unknown,
  locale: 'en' | 'zh-CN',
  configLocale?: Locale,
): string {
  if (error instanceof SkillinkError) {
    switch (error.code) {
      case 'PATH_OUTSIDE_ROOT': {
        const field = error.meta.field ?? 'path';
        const value = error.meta.value ?? '';
        return t(
          `映射路径不能超出项目根目录：${field} = ${value}`,
          `Mapping path cannot escape project root: ${field} = ${value}`,
          locale,
          configLocale,
        );
      }
      case 'LEGACY_ENCRYPTED_FORMAT':
        return t(
          '旧版加密格式缺少完整性校验，请使用 skillink lock 重新加密该文件。',
          'Legacy encrypted format is not authenticated. Please re-encrypt the file with skillink lock.',
          locale,
          configLocale,
        );
      case 'INVALID_ENCRYPTED_FORMAT':
        return t(
          '加密内容格式无效',
          'Invalid encrypted format',
          locale,
          configLocale,
        );
      case 'INVALID_HEX_PART': {
        const label = translatePartLabel(
          error.meta.label,
          locale,
          configLocale,
        );
        return t(
          `${label} 不是有效的十六进制内容`,
          `Invalid ${label} hex content`,
          locale,
          configLocale,
        );
      }
      case 'INVALID_SEGMENT_LENGTH': {
        const label = translatePartLabel(
          error.meta.label,
          locale,
          configLocale,
        );
        return t(
          `${label} 长度无效`,
          `Invalid ${label} length`,
          locale,
          configLocale,
        );
      }
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
