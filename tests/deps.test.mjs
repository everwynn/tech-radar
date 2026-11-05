import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_DEPS,
  normalizeRange,
  parseDeps,
  sortAuditRows,
  summarizeAudit,
} from '../src/lib/deps.mjs';

test('版本归一：常见前缀', () => {
  const cases = [
    ['^1.2.3', '1.2.3'],
    ['~3.5', '3.5.0'],
    ['>=4.0.0', '4.0.0'],
    ['v2.7.18', '2.7.18'],
    ['=1.0.0', '1.0.0'],
    ['  ^20.11.1  ', '20.11.1'],
    ['4.0.0-rc.1', '4.0.0'],
    ['1', '1.0.0'],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(normalizeRange(input), { version: expected, reason: null }, input);
  }
});

test('版本归一：拒绝无法落地的写法', () => {
  const cases = [
    ['workspace:*', '工作区依赖'],
    ['file:../shared', '本地路径依赖'],
    ['link:../x', '本地链接依赖'],
    ['git+https://github.com/a/b.git', 'Git 来源依赖'],
    ['github:a/b', 'GitHub 来源依赖'],
    ['npm:lodash@4.17.21', '别名依赖'],
    ['*', '未锁定版本'],
    ['latest', '未锁定版本'],
    ['1.x', '范围写法'],
    ['^1.2.3 || ^2.0.0', '范围写法'],
    ['1.2.3 - 2.0.0', '范围写法'],
    ['not-a-version', '非 semver 写法'],
    ['', '未锁定版本'],
  ];
  for (const [input, reason] of cases) {
    assert.deepEqual(normalizeRange(input), { version: null, reason }, input);
  }
});

test('解析完整 package.json：合并 dependencies 与 devDependencies', () => {
  const text = JSON.stringify({
    name: 'demo',
    version: '1.0.0',
    dependencies: { vue: '^3.3.0', astro: '4.16.19' },
    devDependencies: { typescript: '~5.6.0' },
  });
  const result = parseDeps(text);
  assert.equal(result.format, 'json');
  assert.deepEqual(
    result.deps.map((item) => [item.name, item.current]),
    [
      ['vue', '3.3.0'],
      ['astro', '4.16.19'],
      ['typescript', '5.6.0'],
    ],
  );
  assert.equal(result.skipped.length, 0);
});

test('解析裸映射片段', () => {
  const result = parseDeps('{"vue": "^3.5.0", "vite": "~5.4.0"}');
  assert.deepEqual(
    result.deps.map((item) => item.name),
    ['vue', 'vite'],
  );
});

test('解析行文本：冒号、@、空格三种分隔', () => {
  const text = ['"vue": "^3.5.0",', 'vite@^5.4.0', 'astro 4.16.19', '// 注释行', ''].join('\n');
  const result = parseDeps(text);
  assert.equal(result.format, 'lines');
  assert.deepEqual(
    result.deps.map((item) => [item.name, item.current]),
    [
      ['vue', '3.5.0'],
      ['vite', '5.4.0'],
      ['astro', '4.16.19'],
    ],
  );
});

test('跳过的依赖保留原因，不混进可比列表', () => {
  const result = parseDeps(
    JSON.stringify({
      dependencies: { 'local-pkg': 'file:../local', 'ws-pkg': 'workspace:^1.0.0', vue: '^3.5.0' },
    }),
  );
  assert.equal(result.deps.length, 1);
  assert.deepEqual(
    result.skipped.map((item) => [item.name, item.reason]),
    [
      ['local-pkg', '本地路径依赖'],
      ['ws-pkg', '工作区依赖'],
    ],
  );
});

test('重复包名只保留一次', () => {
  const text = JSON.stringify({ dependencies: { vue: '^3.5.0' }, devDependencies: { vue: '^2.0.0' } });
  const result = parseDeps(text);
  assert.equal(result.deps.length, 1);
  assert.equal(result.deps[0].current, '3.5.0');
});

test('超过上限时截断并记录溢出数量', () => {
  const dependencies = {};
  for (let index = 0; index < MAX_DEPS + 5; index += 1) dependencies[`pkg-${index}`] = '1.0.0';
  const result = parseDeps(JSON.stringify({ dependencies }));
  assert.equal(result.deps.length, MAX_DEPS);
  assert.equal(result.overflow, 5);
});

test('空输入不报错', () => {
  assert.deepEqual(parseDeps('   '), { format: 'empty', deps: [], skipped: [], overflow: 0 });
});

test('汇总统计', () => {
  const rows = [
    { name: 'a', current: '1.0.0', latest: '2.0.0', gap: { level: 'major' }, vulns: ['X', 'Y'] },
    { name: 'b', current: '1.0.0', latest: '1.0.1', gap: { level: 'patch' }, vulns: [] },
    { name: 'c', current: '3.0.0', latest: '3.0.0', gap: { level: 'none' }, vulns: [] },
    { name: 'd', current: '1.0.0', latest: null, gap: null, vulns: ['Z'], note: 'npm 上找不到该包' },
  ];
  assert.deepEqual(summarizeAudit(rows), {
    total: 4,
    resolved: 3,
    outdated: 2,
    vulnerable: 2,
    failed: 1,
    vulnTotal: 3,
  });
});

test('排序：有漏洞优先，其次落后程度', () => {
  const rows = [
    { name: 'safe-latest', vulns: [], gap: { level: 'none' } },
    { name: 'minor', vulns: [], gap: { level: 'minor' } },
    { name: 'one-vuln', vulns: ['A'], gap: { level: 'none' } },
    { name: 'major', vulns: [], gap: { level: 'major' } },
    { name: 'two-vuln', vulns: ['A', 'B'], gap: { level: 'patch' } },
  ];
  assert.deepEqual(
    sortAuditRows(rows).map((row) => row.name),
    ['two-vuln', 'one-vuln', 'major', 'minor', 'safe-latest'],
  );
});
