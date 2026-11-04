import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stack } from '../config/stack.mjs';
import { validateStack } from './lib/registry.mjs';
import { readJson, writeJsonIfChanged } from './lib/files.mjs';
import { compareVersions } from '../src/lib/versions.mjs';
import { normalizeCycles } from '../src/lib/eol.mjs';
import { endoflifeReleases } from './sources/endoflife.mjs';
import { npmVersions } from './sources/npm.mjs';
import { githubReleaseLatest } from './sources/github-release.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_FILE = resolve(ROOT, 'data/catalog.json');
const sleep = (ms) => new Promise((wait) => setTimeout(wait, ms));

// endoflife 的数组顺序不保证按版本排序，必须显式比较，直接取首项会给出错误的「最新」。
const byCycleDesc = (a, b) => compareVersions(String(b.cycle), String(a.cycle));

function latestCycle(cycles) {
  return cycles.filter((cycle) => cycle.latest).sort(byCycleDesc)[0] ?? null;
}

// LTS 标记兼容两种形态：日期字符串（Node）与布尔（Temurin）。
function latestLtsCycle(cycles) {
  return cycles.filter((cycle) => cycle.lts && cycle.latest).sort(byCycleDesc)[0] ?? null;
}

async function buildItem(entry, sourceState) {
  const item = {
    id: entry.id,
    name: entry.name,
    group: entry.group,
    homepage: entry.homepage ?? null,
    latest: null,
    latestLts: null,
    cycles: [],
    versions: [],
    osv: entry.osv ?? null,
    error: null,
  };

  if (entry.lifecycle) {
    try {
      const releases = await endoflifeReleases(entry.lifecycle.product);
      item.cycles = normalizeCycles(releases).sort(byCycleDesc);
      item.latest = latestCycle(item.cycles)?.latest ?? null;
      item.latestLts = latestLtsCycle(item.cycles)?.latest ?? null;
      sourceState.endoflife = 'ok';
    } catch (error) {
      sourceState.endoflife = 'error';
      item.error = `endoflife: ${error.message}`;
    }
  }

  if (entry.versions) {
    try {
      item.versions = await npmVersions(entry.versions.package);
      if (!item.latest) item.latest = item.versions[0] ?? null;
      sourceState.npm = 'ok';
    } catch (error) {
      sourceState.npm = 'error';
      item.error = item.error ? `${item.error}；npm: ${error.message}` : `npm: ${error.message}`;
    }
  }

  if (entry.releases) {
    try {
      const latest = await githubReleaseLatest(entry.releases);
      if (!item.latest) item.latest = latest;
      sourceState.github = 'ok';
    } catch (error) {
      sourceState.github = 'error';
      item.error = item.error ? `${item.error}；GitHub: ${error.message}` : `GitHub: ${error.message}`;
    }
  }

  delete item.error;
  return item;
}

// 单项整轮失败时保留上一轮数据并标 stale，避免一次网络抖动把页面清空。
function mergeWithPrevious(previous, next) {
  if (!previous) return next;
  if (next.latest) return next;
  return { ...previous, stale: true };
}

async function run() {
  validateStack(stack);

  const previous = readJson(CATALOG_FILE, null);
  const previousItems = Array.isArray(previous?.items) ? previous.items : [];
  const sourceState = { endoflife: 'skipped', npm: 'skipped', github: 'skipped' };
  const items = [];

  for (const entry of stack) {
    const next = await buildItem(entry, sourceState);
    const merged = mergeWithPrevious(
      previousItems.find((item) => item.id === entry.id),
      next,
    );
    items.push(merged);
    console.log(
      `[radar] ${entry.id}: 最新 ${merged.latest ?? '未知'} · ${merged.cycles.length} 条版本线 · ${merged.versions.length} 个版本`,
    );
    await sleep(150);
  }

  const now = new Date().toISOString();
  const changed = JSON.stringify(items) !== JSON.stringify(previousItems);
  const written = writeJsonIfChanged(CATALOG_FILE, {
    updatedAt: changed || !previous?.updatedAt ? now : previous.updatedAt,
    sources: sourceState,
    items,
  });

  const missing = items.filter((item) => !item.latest).length;
  console.log(
    `[radar] 完成：${items.length} 项，${missing} 项无数据，catalog.json ${written ? '已更新' : '无变化'}`,
  );
}

run().catch((error) => {
  console.error(`[radar] 抓取失败：${error.message}`);
  process.exitCode = 1;
});
