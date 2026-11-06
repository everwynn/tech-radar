// 「项目体检」的纯逻辑：拼 URL、切批、把 npm/OSV 的返回装成表格行。
// 网络请求在 audit.ts 里，这里只保留能被 node --test 覆盖的部分。
import { compareVersions, describeGap, gapBetween } from './versions.mjs';

const REGISTRY = 'https://registry.npmjs.org';

// 40 个包 × 6 并发，既能压满带宽又不至于被 registry 限流
export const MAX_PARALLEL = 6;

// OSV 没有硬性上限，但一次问太多容易超时；40 个依赖正常情况下只有一批
export const BATCH_SIZE = 100;

export function latestUrl(name) {
  // 作用域包名里的 / 必须编码，否则会被当成多一层路径
  return `${REGISTRY}/${encodeURIComponent(name)}/latest`;
}

/**
 * @template T
 * @param {T[]} list
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(list, size) {
  const out = [];
  const step = Math.max(1, size);
  for (let index = 0; index < list.length; index += step) out.push(list.slice(index, index + step));
  return out;
}

// querybatch 的 results 与 queries 按下标一一对应，缺失项按「没有公告」处理
export function vulnIdsByIndex(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.map((result) =>
    (Array.isArray(result?.vulns) ? result.vulns : [])
      .map((vuln) => String(vuln?.id ?? ''))
      .filter(Boolean),
  );
}

/**
 * 把依赖、npm latest、OSV 详情装成表格行。
 * @returns {object[]} 每行含 name/raw/current/latest/gap/gapLabel/ahead/vulns/note
 */
export function buildAuditRows({ deps, latestByName = {}, vulnsByName = {}, notesByName = {} }) {
  return (Array.isArray(deps) ? deps : []).map((dep) => {
    const latest = latestByName[dep.name] ?? null;
    const ahead = Boolean(latest && compareVersions(dep.current, latest) > 0);
    const gap = latest ? gapBetween(dep.current, latest) : null;
    return {
      name: dep.name,
      raw: dep.raw,
      current: dep.current,
      latest,
      gap,
      gapLabel: latest ? (ahead ? '高于 npm 最新版' : describeGap(gap)) : '',
      ahead,
      vulns: Array.isArray(vulnsByName[dep.name]) ? vulnsByName[dep.name] : [],
      note: latest ? null : (notesByName[dep.name] ?? 'npm 上找不到该包'),
    };
  });
}

/**
 * 按 OSV 给出的 fixed 版本推算「升到哪个版本能避开全部已列出公告」。
 * 返回的是所有修复版本里的最大值，属于下限而不是推荐版本。
 * @param {{ fixed?: string | null }[]} vulns
 * @param {string} current
 * @returns {{ version: string | null, resolved: number, unresolved: number }}
 */
export function safeTarget(vulns, current) {
  const list = Array.isArray(vulns) ? vulns : [];
  const fixed = list.map((vuln) => vuln?.fixed).filter((value) => typeof value === 'string' && value);
  const unresolved = list.length - fixed.length;
  if (!fixed.length) return { version: null, resolved: 0, unresolved };

  let max = fixed[0];
  for (const value of fixed) if (compareVersions(value, max) > 0) max = value;
  return {
    version: compareVersions(max, current) > 0 ? max : null,
    resolved: fixed.length,
    unresolved,
  };
}

/**
 * 把依赖压成可放进地址栏的 `name@version,name@version`。
 * 作用域包名自带 @，解析时按最后一个 @ 切分。
 * @param {{ name: string, current: string }[]} deps
 * @returns {string}
 */
export function serializeDeps(deps) {
  return (Array.isArray(deps) ? deps : [])
    .filter((dep) => dep && dep.name && dep.current)
    .map((dep) => `${dep.name}@${dep.current}`)
    .join(',');
}

/**
 * 解析 ?deps= 参数；格式不对的条目直接跳过，不做猜测。
 * @param {string | null} value
 * @returns {{ name: string, raw: string, current: string }[]}
 */
export function parseDepsParam(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value.split(',')) {
    const text = entry.trim();
    const at = text.lastIndexOf('@');
    if (at <= 0) continue;
    const name = text.slice(0, at).trim();
    const current = text.slice(at + 1).trim();
    if (!name || !/^\d+\.\d+/.test(current) || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, raw: current, current });
  }
  return out;
}
