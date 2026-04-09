export type Locale = 'auto' | 'en' | 'zh-CN';

export interface LinkMapping {
  /** 源路径（相对于项目根目录） */
  from: string;
  /** 目标路径（相对于项目根目录） */
  to: string;
}

/** Linker 仅依赖扁平映射与语言设置 */
export interface LinkerConfig {
  links: LinkMapping[];
  locale?: Locale;
}

/** AGENTS.md 等文档：按 glob 匹配文件，目标相对于每个源文件所在目录 */
export interface AgentsMarkdownRule {
  /** 相对于项目根的 glob（例：任意目录下的 AGENTS.md） */
  from: string;
  /** 目标路径片段，相对于每个命中文件所在目录 */
  to: string[];
}

/** .agents 等目录：按 glob 匹配目录，目标与每个命中源目录「同级」（在其父目录下） */
export interface AgentsSkillsRule {
  /** 相对于项目根的 glob */
  from: string;
  /** 目标路径片段，相对于每个命中源目录的父目录（与 .agents → .claude 同级） */
  to: string[];
}

export interface SkillinkConfig {
  /** 语言设置：auto 自动检测，en 英文，zh-CN 中文 */
  locale?: Locale;
  /** Agent 文档同步规则（可多组）；省略则不同步此类映射 */
  agentsMarkdown?: AgentsMarkdownRule[];
  /** Skills 目录同步规则（可多组）；省略则不同步此类映射 */
  agentsSkills?: AgentsSkillsRule[];
  /** 其它符号链接映射（字面路径） */
  links?: LinkMapping[];
  /** lock 无参时的默认候选文件；unlock 无参且清单为空时回退 */
  encrypt?: string[];
}

/** skillink.encrypt.json 结构 */
export interface EncryptManifest {
  version: 1;
  /** 曾成功执行 lock 的明文文件路径（相对项目根，POSIX 风格） */
  files: string[];
}
