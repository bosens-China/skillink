/**
 * Skillink 类型定义
 */

/** 目标 AI 工具配置 */
export interface TargetConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 目标路径（相对于项目根目录） */
  path: string;
}

/** Skillink 配置结构 */
export interface SkillinkConfig {
  /** 配置版本 */
  version: string;
  /** 目标工具配置 */
  targets: Record<string, TargetConfig>;
  /** 同步选项 */
  options?: {
    /** 同步模式: symlink | copy */
    syncMode?: 'symlink' | 'copy';
    /** 冲突时是否备份 */
    backupOnConflict?: boolean;
  };
}

/** 内置目标工具定义 */
export interface BuiltInTarget {
  /** 工具标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 默认路径 */
  defaultPath: string;
  /** 描述 */
  description?: string;
}

/** Skill 信息 */
export interface SkillInfo {
  /** skill 名称 */
  name: string;
  /** skill 路径 */
  path: string;
  /** 是否有效 */
  valid: boolean;
}

/** 同步结果 */
export interface SyncResult {
  /** skill 名称 */
  skill: string;
  /** 目标工具 */
  target: string;
  /** 目标路径 */
  targetPath: string;
  /** 操作类型 */
  action: 'created' | 'updated' | 'removed' | 'skipped' | 'error';
  /** 错误信息 */
  error?: string;
}

/** 状态信息 */
export interface StatusInfo {
  /** 配置是否存在 */
  configExists: boolean;
  /** 配置版本 */
  version?: string;
  /** 目标状态 */
  targets: Array<{
    id: string;
    enabled: boolean;
    path: string;
    exists: boolean;
    skillCount: number;
  }>;
  /** skills */
  skills: SkillInfo[];
}
