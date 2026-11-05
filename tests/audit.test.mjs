import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAuditRows, chunk, latestUrl, vulnIdsByIndex } from '../src/lib/audit-core.mjs';

test('npm latest 地址：作用域包名要编码', () => {
  assert.equal(latestUrl('vue'), 'https://registry.npmjs.org/vue/latest');
  assert.equal(latestUrl('@types/node'), 'https://registry.npmjs.org/%40types%2Fnode/latest');
});

test('按批切分', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 10), []);
  assert.deepEqual(chunk([1, 2], 0), [[1], [2]], '0 按 1 处理，避免死循环');
});

test('querybatch 结果按下标取公告 id', () => {
  const payload = {
    results: [{ vulns: [{ id: 'GHSA-a' }, { id: 'GHSA-b' }] }, {}, { vulns: [] }, { vulns: [{ id: 'CVE-c' }] }],
  };
  assert.deepEqual(vulnIdsByIndex(payload), [['GHSA-a', 'GHSA-b'], [], [], ['CVE-c']]);
});

test('querybatch 缺结果或返回空对象不报错', () => {
  assert.deepEqual(vulnIdsByIndex(undefined), []);
  assert.deepEqual(vulnIdsByIndex({}), []);
  assert.deepEqual(vulnIdsByIndex({ results: [null, { vulns: null }] }), [[], []]);
});

test('装行：落后程度、漏洞与失败原因', () => {
  const deps = [
    { name: 'vue', raw: '^3.3.0', current: '3.3.0' },
    { name: 'lodash', raw: '4.17.20', current: '4.17.20' },
    { name: 'gone', raw: '1.0.0', current: '1.0.0' },
    { name: 'future', raw: '2.0.0', current: '2.0.0' },
  ];
  const rows = buildAuditRows({
    deps,
    latestByName: { vue: '3.5.1', lodash: '4.17.20', gone: null, future: '1.9.0' },
    vulnsByName: { lodash: [{ id: 'GHSA-x' }] },
  });

  assert.deepEqual(
    rows.map((row) => [row.name, row.gapLabel, row.vulns.length, row.note]),
    [
      ['vue', '落后 2 个小版本', 0, null],
      ['lodash', '已是最新', 1, null],
      ['gone', '', 0, 'npm 上找不到该包'],
      ['future', '高于 npm 最新版', 0, null],
    ],
  );
  assert.equal(rows[0].gap.level, 'minor');
  assert.equal(rows[0].ahead, false);
  assert.equal(rows[3].ahead, true);
  assert.equal(rows[2].gap, null);
});

test('装行：npm 查询失败时保留网络错误而不是说找不到包', () => {
  const rows = buildAuditRows({
    deps: [{ name: 'vue', raw: '^3.5.0', current: '3.5.0' }],
    latestByName: { vue: null },
    notesByName: { vue: 'npm 查询失败（HTTP 429）' },
  });
  assert.equal(rows[0].note, 'npm 查询失败（HTTP 429）');
});

test('装行：跨大版本只报大版本差', () => {
  const [row] = buildAuditRows({
    deps: [{ name: 'astro', raw: '4.16.19', current: '4.16.19' }],
    latestByName: { astro: '7.4.5' },
  });
  assert.equal(row.gap.level, 'major');
  assert.equal(row.gapLabel, '落后 3 个大版本');
});
