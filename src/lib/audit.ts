// 浏览器端「项目体检」的网络层：npm latest + OSV querybatch。
//
// 只有浏览器会用（构建期不抓依赖），但单独拆出来是为了让组件保持纯渲染。
// 失败隔离：单个包查不到只影响自己那一行，不影响其余结果。
import { BATCH_SIZE, MAX_PARALLEL, buildAuditRows, chunk, latestUrl, vulnIdsByIndex } from './audit-core.mjs';
import { queryVulns } from './osv';
import type { Gap } from './compare';
import type { Vuln } from './osv';

export interface AuditDep {
  name: string;
  raw: string;
  current: string;
}

export interface AuditRow {
  name: string;
  raw: string;
  current: string;
  latest: string | null;
  gap: Gap | null;
  gapLabel: string;
  ahead: boolean;
  vulns: Vuln[];
  note: string | null;
}

export interface AuditOutcome {
  rows: AuditRow[];
  // 整批 OSV 查询失败：本次结果不含漏洞信息，面板要明确说出来
  osvFailed: boolean;
  // 单个包的漏洞详情查询失败数量，避免把「没查到」误解成「没有漏洞」
  vulnFailures: number;
}

export interface AuditProgress {
  done: number;
  total: number;
}

async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      await task(next);
    }
  });
  await Promise.all(workers);
}

async function fetchLatest(name: string): Promise<{ version: string | null; note: string | null }> {
  const response = await fetch(latestUrl(name), { signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return { version: null, note: 'npm 上找不到该包' };
  if (!response.ok) return { version: null, note: `npm 查询失败（HTTP ${response.status}）` };
  const data = (await response.json()) as { version?: unknown };
  const version = typeof data?.version === 'string' ? data.version : '';
  return version ? { version, note: null } : { version: null, note: 'npm 未返回版本号' };
}

// querybatch 只回答「哪些包有公告」；命中后再逐个取详情（严重度、修复版本）
async function collectVulnerable(deps: AuditDep[]): Promise<AuditDep[]> {
  const withVulns: AuditDep[] = [];
  for (const group of chunk(deps, BATCH_SIZE)) {
    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: group.map((dep) => ({
          package: { name: dep.name, ecosystem: 'npm' },
          version: dep.current,
        })),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const ids = vulnIdsByIndex(await response.json());
    group.forEach((dep, index) => {
      if (ids[index]?.length) withVulns.push(dep);
    });
  }
  return withVulns;
}

export async function auditDeps(
  deps: AuditDep[],
  onProgress?: (progress: AuditProgress) => void,
): Promise<AuditOutcome> {
  const latestByName: Record<string, string | null> = {};
  const notesByName: Record<string, string> = {};
  let done = 0;

  await runPool(deps, MAX_PARALLEL, async (dep) => {
    try {
      const { version, note } = await fetchLatest(dep.name);
      latestByName[dep.name] = version;
      if (note) notesByName[dep.name] = note;
    } catch {
      latestByName[dep.name] = null;
      notesByName[dep.name] = 'npm 查询失败，可稍后重试';
    } finally {
      done += 1;
      onProgress?.({ done, total: deps.length });
    }
  });

  let osvFailed = false;
  let vulnerable: AuditDep[] = [];
  try {
    vulnerable = await collectVulnerable(deps);
  } catch {
    osvFailed = true;
  }

  const vulnsByName: Record<string, Vuln[]> = {};
  let vulnFailures = 0;
  await runPool(vulnerable, 4, async (dep) => {
    try {
      vulnsByName[dep.name] = await queryVulns({ ecosystem: 'npm', package: dep.name }, dep.current);
    } catch {
      vulnFailures += 1;
    }
  });

  return {
    rows: buildAuditRows({ deps, latestByName, vulnsByName, notesByName }) as AuditRow[],
    osvFailed,
    vulnFailures,
  };
}
