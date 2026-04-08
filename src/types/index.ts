export type Locale = 'auto' | 'en' | 'zh-CN';

export interface LinkMapping {
  /** 源路径（相对于项目根目录） */
  from: string;
  /** 目标路径（相对于项目根目录） */
  to: string;
}

export interface SkillinkConfig {
  /** 语言设置：auto 自动检测，en 英文，zh-CN 中文 */
  locale?: Locale;
  /** 符号链接映射列表 */
  links: LinkMapping[];
  /** 需要加密的文件列表，默认 ['.mcp.json'] */
  encrypt?: string[];
}
