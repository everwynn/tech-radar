// 构建期与浏览器共用：不依赖 Node API，两端都能安全 import。
export const VERSION_PATTERN = /^[0-9A-Za-z.+_-]{1,40}$/;

export function parseVersion(text) {
  if (typeof text !== 'string' || !VERSION_PATTERN.test(text)) return null;
  const match = text.trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  return 0;
}

const NO_GAP = { level: 'none', majors: 0, minors: 0, patches: 0 };

// 只报告最高一层差异：跨大版本时不再把 minor/patch 差算进来，
// 否则 4.16.19 → 7.4.5 会得出「落后 3 个大版本 + 5 个补丁」这种误导性结果。
export function gapBetween(current, latest) {
  const left = parseVersion(current);
  const right = parseVersion(latest);
  if (!left || !right || compareVersions(current, latest) >= 0) return { ...NO_GAP };
  if (right.major > left.major) {
    return { level: 'major', majors: right.major - left.major, minors: 0, patches: 0 };
  }
  if (right.minor > left.minor) {
    return { level: 'minor', majors: 0, minors: right.minor - left.minor, patches: 0 };
  }
  return { level: 'patch', majors: 0, minors: 0, patches: right.patch - left.patch };
}

export function describeGap(gap) {
  if (!gap || gap.level === 'none') return '已是最新';
  if (gap.level === 'major') return `落后 ${gap.majors} 个大版本`;
  if (gap.level === 'minor') return `落后 ${gap.minors} 个小版本`;
  return `落后 ${gap.patches} 个补丁版本`;
}

export function isVersion(text) {
  return parseVersion(text) !== null;
}

// 同一 major 内版本差异才算「同一条版本线」，用于把输入版本映射到 cycle。
export function sameMajorLine(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return false;
  return left.major === right.major;
}
