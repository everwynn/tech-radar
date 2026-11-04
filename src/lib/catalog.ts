import { readFileSync } from 'node:fs';

export type Group = 'runtime' | 'framework' | 'frontend' | 'data';

export interface Cycle {
  cycle: string;
  latest: string | null;
  releaseDate: string | null;
  eol: string | true | false | null;
  support: string | null;
  lts: string | true | null;
}

export interface OsvTarget {
  ecosystem: string;
  package: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  group: Group;
  homepage: string | null;
  latest: string | null;
  latestLts: string | null;
  cycles: Cycle[];
  versions: string[];
  osv: OsvTarget | null;
  stale?: boolean;
}

export interface CatalogFile {
  updatedAt: string;
  sources: Record<string, string>;
  items: CatalogItem[];
}

export const GROUP_LABELS: Record<Group, string> = {
  runtime: '运行时',
  framework: '框架',
  frontend: '前端库',
  data: '数据与安全',
};

export const GROUP_ORDER: Group[] = ['runtime', 'framework', 'frontend', 'data'];

// catalog.json 由 npm run fetch 生成；首次克隆尚未抓取时退回空结构，保证 build 不中断。
function load(): CatalogFile {
  try {
    return JSON.parse(readFileSync(new URL('../../data/catalog.json', import.meta.url), 'utf8')) as CatalogFile;
  } catch {
    return { updatedAt: '', sources: {}, items: [] };
  }
}

const catalog = load();

export function getItems(): CatalogItem[] {
  return [...catalog.items].sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name),
  );
}

export const getUpdatedAt = () => catalog.updatedAt;
export const getSources = () => catalog.sources;

export function summarize(items: CatalogItem[]) {
  return {
    total: items.length,
    withLifecycle: items.filter((item) => item.cycles.length > 0).length,
    withVersions: items.filter((item) => item.versions.length > 0).length,
    withVulns: items.filter((item) => item.osv).length,
    withLatest: items.filter((item) => item.latest).length,
  };
}

export function groupItems(items: CatalogItem[]) {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: items.filter((item) => item.group === group),
  })).filter((section) => section.items.length > 0);
}
