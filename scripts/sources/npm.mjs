import { fetchJson } from '../lib/http.mjs';
import { compareVersions } from '../../src/lib/versions.mjs';

// 主源失败时回退 jsDelivr：两者都返回 npm 生态的同一版本事实，
// 但 jsDelivr 的响应体更小，适合作为兜底。
export async function npmLatest(pkg, fetchImpl) {
  try {
    const data = await fetchJson(`https://registry.npmjs.org/${pkg}/latest`, { fetchImpl, retries: 0 });
    if (data?.version) return String(data.version);
    throw new Error('缺少 version');
  } catch {
    const fallback = await fetchJson(`https://data.jsdelivr.com/v1/package/npm/${pkg}`, { fetchImpl, retries: 0 });
    const version = fallback?.tags?.latest;
    if (!version) throw new Error(`npm 与 jsDelivr 均无 ${pkg} 版本`);
    return String(version);
  }
}

// 只保留 x.y.z 形式的稳定版本，预发布（-beta.1）对「版本对比」没有意义，
// 而且会把列表撑大三四倍。返回按版本号降序，首项即最新稳定版。
export async function npmVersions(pkg, fetchImpl) {
  const data = await fetchJson(`https://registry.npmjs.org/${pkg}`, {
    fetchImpl,
    timeoutMs: 30000,
    retries: 1,
  });
  const versions = Object.keys(data?.versions ?? {})
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort((a, b) => compareVersions(b, a));
  if (!versions.length) throw new Error(`npm 无 ${pkg} 稳定版本`);
  return versions;
}
