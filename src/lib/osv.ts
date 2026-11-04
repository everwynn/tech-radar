import { compareVersions } from './versions.mjs';

export type Severity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNKNOWN';

export interface Vuln {
  id: string;
  summary: string;
  severity: Severity;
  fixed: string | null;
  aliases: string[];
  url: string;
  published: string | null;
}

export interface OsvTarget {
  ecosystem: string;
  package: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MODERATE: 2,
  LOW: 3,
  UNKNOWN: 4,
};

// 同一包同一版本重复查询很常见（反复点对比），内存缓存避免重复打 OSV。
const cache = new Map<string, Vuln[]>();

const firstLine = (text: unknown) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';

function normalizeSeverity(raw: Record<string, unknown>): Severity {
  const candidates = [
    (raw.database_specific as Record<string, unknown> | undefined)?.severity,
    (raw.ecosystem_specific as Record<string, unknown> | undefined)?.severity,
  ];
  for (const value of candidates) {
    const text = String(value ?? '').toUpperCase();
    // NVD 用 MEDIUM，GitHub 用 MODERATE，页面统一成 MODERATE
    if (text === 'MEDIUM') return 'MODERATE';
    if (text in SEVERITY_ORDER) return text as Severity;
  }
  return 'UNKNOWN';
}

// 一个漏洞可能有多段影响区间，取最小的 fixed 作为「最早能修好的版本」。
function firstFixed(affected: unknown): string | null {
  const fixes: string[] = [];
  for (const entry of Array.isArray(affected) ? affected : []) {
    for (const range of Array.isArray(entry?.ranges) ? entry.ranges : []) {
      for (const event of Array.isArray(range?.events) ? range.events : []) {
        if (event?.fixed) fixes.push(String(event.fixed));
      }
    }
  }
  if (!fixes.length) return null;
  return fixes.sort(compareVersions)[0];
}

export function parseVulns(data: unknown): Vuln[] {
  const list = Array.isArray((data as { vulns?: unknown })?.vulns) ? (data as { vulns: unknown[] }).vulns : [];
  const seen = new Set<string>();
  const out: Vuln[] = [];

  for (const raw of list) {
    const item = raw as Record<string, unknown>;
    const id = item?.id ? String(item.id) : '';
    // withdrawn 表示公告已撤回，不应再计入
    if (!id || item.withdrawn || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      summary: String(item.summary ?? '') || firstLine(item.details),
      severity: normalizeSeverity(item),
      fixed: firstFixed(item.affected),
      aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
      url: `https://osv.dev/vulnerability/${id}`,
      published: item.published ? String(item.published) : null,
    });
  }

  return out.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.id.localeCompare(b.id),
  );
}

export async function queryVulns(
  target: OsvTarget,
  version: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Vuln[]> {
  const key = `${target.ecosystem}:${target.package}:${version}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const response = await fetchImpl('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      package: { name: target.package, ecosystem: target.ecosystem },
      version,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const vulns = parseVulns(await response.json());
  cache.set(key, vulns);
  return vulns;
}
