/** 加密清单文件名（与 skillink.config 并列） */
export const ENCRYPT_MANIFEST_FILE = 'skillink.encrypt.json';

/** copy 模式清单文件名：记录由 skillink 复制生成的目标，用于安全覆盖与孤儿清理 */
export const COPY_MANIFEST_FILE = 'skillink.copy.json';

/** lock/unlock 无参且配置未声明 encrypt 时的默认候选 */
export const DEFAULT_ENCRYPT_FILES = ['.mcp.json'];
