export type EncryptedPartLabel = 'salt' | 'iv' | 'auth tag' | 'ciphertext';

export type SkillinkErrorCode =
  | 'PATH_OUTSIDE_ROOT'
  | 'MAPPING_CONFLICT'
  | 'LEGACY_ENCRYPTED_FORMAT'
  | 'INVALID_ENCRYPTED_FORMAT'
  | 'INVALID_HEX_PART'
  | 'INVALID_SEGMENT_LENGTH';

interface SkillinkErrorOptions {
  cause?: unknown;
  meta?: Record<string, string>;
}

/**
 * 统一的业务错误类型，便于在 CLI 层做格式化输出。
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

function translatePartLabel(label: string | undefined): string {
  switch (label) {
    case 'salt':
      return '盐值';
    case 'iv':
      return '初始向量';
    case 'auth tag':
      return '认证标签';
    case 'ciphertext':
      return '密文';
    default:
      return label ?? '字段';
  }
}

/**
 * 将内部错误转换为终端可见的中文文案。
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof SkillinkError) {
    switch (error.code) {
      case 'PATH_OUTSIDE_ROOT': {
        const field = error.meta.field ?? 'path';
        const value = error.meta.value ?? '';
        return `映射路径不能超出项目根目录：${field} = ${value}`;
      }
      case 'MAPPING_CONFLICT': {
        const to = error.meta.to ?? '';
        const froms = error.meta.froms ?? '';
        return `多个源指向同一个目标，存在冲突：${to} ← [${froms}]`;
      }
      case 'LEGACY_ENCRYPTED_FORMAT':
        return '旧版加密格式缺少完整性校验，请使用 skillink lock 重新加密该文件。';
      case 'INVALID_ENCRYPTED_FORMAT':
        return '加密内容格式无效';
      case 'INVALID_HEX_PART':
        return `${translatePartLabel(error.meta.label)} 不是有效的十六进制内容`;
      case 'INVALID_SEGMENT_LENGTH':
        return `${translatePartLabel(error.meta.label)} 长度无效`;
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
