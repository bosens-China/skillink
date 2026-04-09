// 导出库 API
export {
  defineConfig,
  loadConfig,
  hasConfigFile,
  createDefaultConfig,
} from './core/config.js';
export { resolveLinkMappings } from './core/resolve-mappings.js';
export { ENCRYPT_MANIFEST_FILE } from './core/constants.js';
export {
  readEncryptManifest,
  mergeEncryptManifestFiles,
  toManifestRelPath,
} from './utils/encrypt-manifest.js';
export type {
  Locale,
  LinkMapping,
  LinkerConfig,
  SkillinkConfig,
  AgentsMarkdownRule,
  AgentsSkillsRule,
  EncryptManifest,
} from './types/index.js';
export type { ResolveLinkMappingsResult } from './core/resolve-mappings.js';
