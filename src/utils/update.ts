import semver from 'semver';

// 声明全局注入的 require (由 tsup banner 提供)
declare const require: (id: string) => { version: string; name: string };

const pkg = require('../../package.json');

export const currentVersion = pkg.version;
export const pkgName = pkg.name;

export interface UpdateInfo {
  latest: string;
  current: string;
  hasUpdate: boolean;
  name: string;
}

interface NpmPackumentResponse {
  versions?: Record<string, unknown>;
}

/**
 * 仅基于 versions 字段解析最大语义化版本（不依赖 latest/tag）
 */
export function resolveLatestSemverVersion(versions: string[]): string {
  const validStableVersions = versions.filter(
    (version) => semver.valid(version) && semver.prerelease(version) === null,
  );
  const sorted = semver.rsort(validStableVersions);
  if (sorted.length === 0) {
    throw new Error('未找到可用的稳定语义化版本');
  }
  return sorted[0];
}

/**
 * 检查更新（仅比较语义化版本，不使用 latest 标签）
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.name}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`请求失败: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as NpmPackumentResponse;
    const latestVersion = resolveLatestSemverVersion(
      Object.keys(data.versions ?? {}),
    );

    return {
      latest: latestVersion,
      current: currentVersion,
      hasUpdate: semver.gt(latestVersion, currentVersion),
      name: pkgName,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
