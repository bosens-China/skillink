// 导出库 API
export {
  defineConfig,
  loadConfig,
  hasConfigFile,
  createDefaultConfig,
  detectInit,
} from './core/config.js';
export { resolveLinkMappings } from './core/resolve-mappings.js';
export {
  ENCRYPT_MANIFEST_FILE,
  DEFAULT_ENCRYPT_FILES,
} from './core/constants.js';
export {
  readEncryptManifest,
  mergeEncryptManifestFiles,
  toManifestRelPath,
} from './utils/encrypt-manifest.js';
export type {
  LinkMapping,
  LinkerConfig,
  SkillinkConfig,
  AgentsMarkdownRule,
  AgentsSkillsRule,
  EncryptManifest,
} from './types/index.js';
export type { ResolveLinkMappingsResult } from './core/resolve-mappings.js';
export type { InitDetection } from './core/config.js';
export type { LinkerResult } from './core/linker.js';
