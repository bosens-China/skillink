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

/**
 * 检查更新
 * @returns 更新信息，如果请求失败则抛出错误
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  const controller = new AbortController();
  // 显式命令可以稍微宽容一点超时，比如 3 秒
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`请求失败: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { version: string };
    const latestVersion = data.version;

    return {
      latest: latestVersion,
      current: currentVersion,
      hasUpdate: semver.gt(latestVersion, currentVersion),
      name: pkg.name,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
