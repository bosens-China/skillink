export interface SyncTarget {
  /** 目标名称（如 'Cursor', 'VSCode'） */
  name: string;
  /** 目标路径（相对于项目根目录） */
  path: string;
  /** 是否启用同步 */
  enabled?: boolean;
}

export interface SkillinkConfig {
  /** 技能源目录（默认为 .agents/skills） */
  source?: string;
  /** 同步目标列表 */
  targets: SyncTarget[];
  /** 忽略的文件模式（暂未使用） */
  ignore?: string[];
}

export interface Skill {
  /** 技能名称（文件夹名） */
  name: string;
  /** 技能完整路径 */
  path: string;
  /** 是否有效（包含 SKILL.md） */
  isValid: boolean;
}

export interface SyncResult {
  /** 技能名称 */
  skill: string;
  /** 目标名称 */
  target: string;
  /** 同步状态 */
  status: 'linked' | 'failed' | 'skipped' | 'cleaned';
  /** 详细信息 */
  message?: string;
}
