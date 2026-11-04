const DAY_MS = 86_400_000;
export const NEAR_DAYS = 180;

const toDate = (value) => {
  if (typeof value !== 'string') return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function pickCycle(releases, version) {
  if (!Array.isArray(releases) || !releases.length) return null;
  const parts = String(version).replace(/^v/i, '').split('.');
  const majorMinor = parts.slice(0, 2).join('.');
  const major = parts[0];
  return (
    releases.find((item) => String(item.cycle) === majorMinor) ??
    releases.find((item) => String(item.cycle) === major) ??
    null
  );
}

export function eolState(release, now = new Date()) {
  if (!release) return { state: 'unknown', date: null, daysLeft: null, cycle: null };
  const cycle = release.cycle ?? null;
  if (release.eol === true) return { state: 'eol', date: null, daysLeft: null, cycle };
  if (release.eol === false || release.eol == null) {
    return { state: 'ok', date: null, daysLeft: null, cycle };
  }
  const date = toDate(release.eol);
  if (!date) return { state: 'unknown', date: null, daysLeft: null, cycle };
  const daysLeft = Math.floor((date.getTime() - now.getTime()) / DAY_MS);
  const state = daysLeft < 0 ? 'eol' : daysLeft <= NEAR_DAYS ? 'near' : 'ok';
  return { state, date: release.eol, daysLeft, cycle };
}

export function eolLabel(state) {
  if (!state || state.state === 'unknown') return '未知';
  if (state.state === 'eol') return '已停止支持';
  if (state.state === 'near') {
    return state.daysLeft == null ? '即将停止支持' : `${state.daysLeft} 天后停止支持`;
  }
  return '支持中';
}

// 把 endoflife 的原始 cycle 数组收敛成页面要展示的精简结构。
export function normalizeCycles(releases) {
  if (!Array.isArray(releases)) return [];
  return releases
    .filter((item) => item && item.cycle != null)
    .map((item) => ({
      cycle: String(item.cycle),
      latest: item.latest ? String(item.latest) : null,
      releaseDate: item.releaseDate ?? null,
      eol: typeof item.eol === 'string' ? item.eol : item.eol === true ? true : item.eol === false ? false : null,
      support: item.support ?? null,
      lts: typeof item.lts === 'string' ? item.lts : item.lts === true ? true : null,
    }));
}
