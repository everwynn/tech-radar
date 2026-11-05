// package.json 依赖解析与版本归一：构建期不参与，只有浏览器端用，但拆成 .mjs 是为了能被 node --test 覆盖。
//
// 只做一件事：把用户粘贴的内容拆成「包名 + 可比版本」，拆不出来的显式标注原因，
// 不做任何猜测——猜错版本号比直接说「无法解析」更糟。

const SKIP_PREFIXES = [
  ['workspace:', '工作区依赖'],
  ['file:', '本地路径依赖'],
  ['link:', '本地链接依赖'],
  ['portal:', '工作区依赖'],
  ['git+', 'Git 来源依赖'],
  ['git:', 'Git 来源依赖'],
  ['github:', 'GitHub 来源依赖'],
  ['http://', '远程包依赖'],
  ['https://', '远程包依赖'],
  ['npm:', '别名依赖'],
];

const UNPINNED = new Set(['*', 'latest', 'next', 'beta', 'canary', '']);

export const MAX_DEPS = 40;

/**
 * 把版本范围归一成 x.y.z。
 * @returns {{ version: string | null, reason: string | null }}
 */
export function normalizeRange(raw) {
  const text = String(raw ?? '').trim();
  if (UNPINNED.has(text.toLowerCase())) return { version: null, reason: '未锁定版本' };

  for (const [prefix, reason] of SKIP_PREFIXES) {
    if (text.toLowerCase().startsWith(prefix)) return { version: null, reason };
  }

  // 1.x / 1.2.x / 1.* 这类范围无法落到单一版本，直接跳过而不是替用户猜
  if (/[xX*]/.test(text)) return { version: null, reason: '范围写法' };
  if (text.includes('||') || /\s-\s/.test(text)) return { version: null, reason: '范围写法' };

  const stripped = text.replace(/^[\s^~><=v]+/, '');
  const match = stripped.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?/);
  if (!match) return { version: null, reason: '非 semver 写法' };

  const [, major, minor = '0', patch = '0'] = match;
  return { version: `${Number(major)}.${Number(minor)}.${Number(patch)}`, reason: null };
}

function isStringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const values = Object.values(value);
  return values.length > 0 && values.every((item) => typeof item === 'string');
}

function collectPairs(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    // 同名包同时出现在两处时以 dependencies 为准，devDependencies 只是补漏
    const bag = new Map();
    for (const key of ['dependencies', 'devDependencies']) {
      if (!isStringMap(input[key])) continue;
      for (const [name, range] of Object.entries(input[key])) {
        if (!bag.has(name)) bag.set(name, range);
      }
    }
    // 只粘贴了 {"vue": "^3.5.0"} 这种裸映射
    if (!bag.size && isStringMap(input)) {
      for (const [name, range] of Object.entries(input)) bag.set(name, range);
    }
    return [...bag].map(([name, range]) => [name, String(range)]);
  }
  return null;
}

const LINE_PATTERN = /^\s*["']?(@?[A-Za-z0-9][\w./-]*)["']?\s*(?::|@|\s)\s*["']?([^\s"',]+)["']?,?\s*$/;

function parseLines(text) {
  const pairs = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
    const match = trimmed.match(LINE_PATTERN);
    if (match) pairs.push([match[1], match[2]]);
  }
  return pairs;
}

/**
 * @typedef {object} ParsedDep
 * @property {string} name
 * @property {string} raw
 * @property {string} current
 */

/**
 * @typedef {object} SkippedDep
 * @property {string} name
 * @property {string} raw
 * @property {string} reason
 */

/**
 * @typedef {object} ParsedDeps
 * @property {'json' | 'lines' | 'empty'} format
 * @property {ParsedDep[]} deps
 * @property {SkippedDep[]} skipped
 * @property {number} overflow
 */

/**
 * 解析用户粘贴的 package.json（片段或完整）或「包名 版本」行。
 * @returns {ParsedDeps}
 */
export function parseDeps(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { format: 'empty', deps: [], skipped: [], overflow: 0 };

  let pairs = null;
  let format = 'json';
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      pairs = collectPairs(JSON.parse(raw));
    } catch {
      pairs = null;
    }
  }
  if (!pairs) {
    pairs = parseLines(raw);
    format = 'lines';
  }

  const seen = new Set();
  const deps = [];
  const skipped = [];

  for (const [name, range] of pairs) {
    if (seen.has(name)) continue;
    seen.add(name);
    const { version, reason } = normalizeRange(range);
    if (version) deps.push({ name, raw: String(range), current: version });
    else skipped.push({ name, raw: String(range), reason: reason ?? '无法解析' });
  }

  const overflow = Math.max(0, deps.length - MAX_DEPS);
  return { format, deps: deps.slice(0, MAX_DEPS), skipped, overflow };
}

/**
 * 汇总体检结果，用于面板顶部的「12 个依赖 · 8 个落后 · 3 个有漏洞」。
 */
export function summarizeAudit(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const resolved = list.filter((row) => row.current && row.latest);
  const outdated = resolved.filter((row) => row.gap && row.gap.level !== 'none' && !row.ahead);
  const vulnerable = list.filter((row) => Array.isArray(row.vulns) && row.vulns.length > 0);
  const failed = list.filter((row) => row.note && !row.latest);
  return {
    total: list.length,
    resolved: resolved.length,
    outdated: outdated.length,
    vulnerable: vulnerable.length,
    failed: failed.length,
    vulnTotal: vulnerable.reduce((sum, row) => sum + row.vulns.length, 0),
  };
}

/**
 * 排序：有漏洞的排前面，其次落后的，最后是已最新的；同级按包名。
 */
export function sortAuditRows(rows) {
  const weight = (row) => {
    const vulns = Array.isArray(row.vulns) ? row.vulns.length : 0;
    const level = row.gap?.level ?? 'none';
    return vulns * 100 + (level === 'major' ? 30 : level === 'minor' ? 20 : level === 'patch' ? 10 : 0);
  };
  return [...(Array.isArray(rows) ? rows : [])].sort(
    (a, b) => weight(b) - weight(a) || String(a.name).localeCompare(String(b.name)),
  );
}
