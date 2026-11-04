import { parseVersion, compareVersions, gapBetween, describeGap } from './versions.mjs';
import { pickCycle, eolState, eolLabel } from './eol.mjs';
import type { CatalogItem, Cycle } from './catalog';

export interface Gap {
  level: 'none' | 'patch' | 'minor' | 'major';
  majors: number;
  minors: number;
  patches: number;
}

export interface CompareResult {
  ok: boolean;
  reason: string | null;
  input: string;
  latest: string | null;
  latestLts: string | null;
  gap: Gap;
  gapLabel: string;
  aheadOfLatest: boolean;
  cycle: Cycle | null;
  onLatestLine: boolean;
  eolState: 'ok' | 'near' | 'eol' | 'unknown';
  eolLabel: string;
  eolDate: string | null;
  daysLeft: number | null;
  releasedAt: string | null;
  isLts: boolean;
  // tri-state：有些数据源没有版本全集，无法判断输入是否存在
  knownVersion: boolean | null;
}

export function compareVersion(item: CatalogItem, rawInput: string, now = new Date()): CompareResult {
  const input = rawInput.trim();
  const base: CompareResult = {
    ok: false,
    reason: null,
    input,
    latest: item.latest,
    latestLts: item.latestLts,
    gap: { level: 'none', majors: 0, minors: 0, patches: 0 },
    gapLabel: '',
    aheadOfLatest: false,
    cycle: null,
    onLatestLine: false,
    eolState: 'unknown',
    eolLabel: '未知',
    eolDate: null,
    daysLeft: null,
    releasedAt: null,
    isLts: false,
    knownVersion: null,
  };

  if (!parseVersion(input)) {
    return { ...base, reason: '版本号无法识别，请输入 20.11.1 这样的格式' };
  }
  if (!item.latest) {
    return { ...base, reason: '该技术暂无最新版本数据' };
  }

  const gap = gapBetween(input, item.latest);
  const aheadOfLatest = compareVersions(input, item.latest) > 0;
  const cycle = pickCycle(item.cycles, input) as Cycle | null;
  const state = eolState(cycle, now);
  const latestCycle = pickCycle(item.cycles, item.latest) as Cycle | null;

  return {
    ...base,
    ok: true,
    // .mjs 返回的是运行时字符串，这里收窄回字面量联合类型
    gap: gap as Gap,
    gapLabel: aheadOfLatest ? '高于已发布的最新稳定版' : describeGap(gap),
    aheadOfLatest,
    cycle,
    onLatestLine: Boolean(cycle && latestCycle && cycle.cycle === latestCycle.cycle),
    eolState: state.state as CompareResult['eolState'],
    eolLabel: eolLabel(state),
    eolDate: state.date,
    daysLeft: state.daysLeft,
    releasedAt: cycle?.releaseDate ?? null,
    isLts: Boolean(cycle?.lts),
    knownVersion: item.versions.length ? item.versions.includes(input) : null,
  };
}
