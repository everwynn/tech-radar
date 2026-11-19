import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuditMarkdown,
  buildAuditRows,
  chunk,
  latestUrl,
  parseDepsParam,
  safeTarget,
  serializeDeps,
  vulnIdsByIndex,
} from '../src/lib/audit-core.mjs';

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

test('升级目标：取所有修复版本的最大值', () => {
  const vulns = [{ fixed: '4.17.21' }, { fixed: '5.0.1' }, { fixed: null }];
  assert.deepEqual(safeTarget(vulns, '4.17.20'), { version: '5.0.1', resolved: 2, unresolved: 1 });
});

test('升级目标：修复版本不高于当前版本时不给建议', () => {
  assert.deepEqual(safeTarget([{ fixed: '1.0.0' }], '1.2.0'), { version: null, resolved: 1, unresolved: 0 });
});

test('升级目标：全部未公布修复版本时只报数量', () => {
  assert.deepEqual(safeTarget([{ fixed: null }, {}], '1.0.0'), { version: null, resolved: 0, unresolved: 2 });
  assert.deepEqual(safeTarget([], '1.0.0'), { version: null, resolved: 0, unresolved: 0 });
});

test('分享链接：依赖序列化与还原', () => {
  const deps = [
    { name: 'vue', current: '3.3.0' },
    { name: '@types/node', current: '22.10.0' },
  ];
  const encoded = serializeDeps(deps);
  assert.equal(encoded, 'vue@3.3.0,@types/node@22.10.0');
  assert.deepEqual(parseDepsParam(encoded), [
    { name: 'vue', raw: '3.3.0', current: '3.3.0' },
    { name: '@types/node', raw: '22.10.0', current: '22.10.0' },
  ]);
});

test('分享链接：跳过格式不对和重复的条目', () => {
  assert.deepEqual(parseDepsParam('vue@3.3.0,vue@3.4.0,broken,1.0.0,astro@latest,astro@4.0.0'), [
    { name: 'vue', raw: '3.3.0', current: '3.3.0' },
    { name: 'astro', raw: '4.0.0', current: '4.0.0' },
  ]);
  assert.deepEqual(parseDepsParam(''), []);
  assert.deepEqual(parseDepsParam(null), []);
});

test('Markdown 报告：统计行、表格与免责声明', () => {
  const rows = [
    {
      name: 'vue',
      raw: '^3.3.4',
      current: '3.3.4',
      latest: '3.5.22',
      gap: { level: 'minor' },
      gapLabel: '落后 2 个小版本',
      ahead: false,
      vulns: [],
      note: null,
    },
    {
      name: 'axios',
      raw: '0.21.1',
      current: '0.21.1',
      latest: '1.13.2',
      gap: { level: 'major' },
      gapLabel: '落后 1 个大版本',
      ahead: false,
      vulns: [{ fixed: '1.8.2' }, { fixed: '1.9.0' }, { fixed: null }],
      note: null,
    },
  ];
  const markdown = buildAuditMarkdown({
    rows,
    generatedAt: '2026-11-19',
    link: 'https://everwynn.github.io/tech-radar/?deps=axios@0.21.1,vue@3.3.4',
  });

  assert.equal(
    markdown,
    [
      '## 依赖体检报告（tech-radar）',
      '',
      '共 2 个包 · 2 个落后 · 1 个有漏洞（3 条公告）',
      '生成于 2026-11-19 · 来源：https://everwynn.github.io/tech-radar/?deps=axios@0.21.1,vue@3.3.4',
      '',
      '| 包 | 当前 | 最新 | 落后 | 漏洞 | 升级建议 |',
      '| --- | --- | --- | --- | --- | --- |',
      '| axios | 0.21.1 | 1.13.2 | 落后 1 个大版本 | 3 | ≥ 1.9.0（另有 1 条暂无修复） |',
      '| vue | 3.3.4 | 3.5.22 | 落后 2 个小版本 | — | — |',
      '',
      '> 漏洞为当前版本命中的 OSV 公告条目，不等于可利用性；升级建议按 OSV fixed 取最大值推算，不等于推荐升级版本。',
    ].join('\n'),
  );
});

test('Markdown 报告：OSV 失败时不说「未发现漏洞」', () => {
  const row = {
    name: 'vue',
    raw: '3.5.0',
    current: '3.5.0',
    latest: '3.5.0',
    gap: { level: 'none' },
    gapLabel: '已是最新',
    ahead: false,
    vulns: [],
    note: null,
  };

  const failed = buildAuditMarkdown({ rows: [row], osvFailed: true });
  assert.ok(failed.includes('本次漏洞批量查询失败，结论不含漏洞信息'), '要明确标注本次结论不含漏洞');
  assert.ok(!failed.includes('未发现已知漏洞'), 'OSV 失败时不能声称没有漏洞');
  assert.ok(!failed.includes('生成于'), '没传时间和链接时不输出这一行');

  // 批量没失败、只是部分详情失败：仍可声称未发现漏洞，但要注明失败数
  const partial = buildAuditMarkdown({ rows: [row], vulnFailures: 2 });
  assert.ok(partial.includes('未发现已知漏洞'));
  assert.ok(partial.includes('其中 2 个包的漏洞详情查询失败'));
});

test('Markdown 报告：跳过项与超出上限', () => {
  const markdown = buildAuditMarkdown({
    rows: [
      {
        name: 'vue',
        raw: '3.5.0',
        current: '3.5.0',
        latest: '3.5.0',
        gap: { level: 'none' },
        gapLabel: '已是最新',
        ahead: false,
        vulns: [],
        note: null,
      },
    ],
    skipped: [
      { name: 'foo', raw: '^1.0.0', reason: '范围写法' },
      { name: 'bar', raw: 'latest', reason: '未锁定版本' },
    ],
    overflow: 3,
  });

  assert.ok(markdown.includes('跳过 2 个（无法落到具体版本）'));
  assert.ok(markdown.includes('- foo ^1.0.0 · 范围写法'));
  assert.ok(markdown.includes('- bar latest · 未锁定版本'));
  assert.ok(markdown.includes('另有 3 个包超出 40 个上限，未查询。'));
});

test('Markdown 报告：单元格转义竖线与换行', () => {
  const markdown = buildAuditMarkdown({
    rows: [
      {
        name: 'mystery',
        raw: '1.0.0',
        current: '1.0.0',
        latest: null,
        gap: null,
        gapLabel: '',
        ahead: false,
        vulns: [],
        note: '查询失败 | 稍后重试\n请重试',
      },
    ],
  });

  assert.ok(markdown.includes('查询失败 \\| 稍后重试 请重试'), '竖线要转义，换行要压成空格');
  assert.ok(!markdown.includes('| 查询失败 |'), '未转义的竖线会破环表格');
});

test('Markdown 报告：有漏洞的排前面，全无修复版本时只报数量', () => {
  const markdown = buildAuditMarkdown({
    rows: [
      {
        name: 'zzz',
        raw: '1.0.0',
        current: '1.0.0',
        latest: '1.0.0',
        gap: { level: 'none' },
        gapLabel: '已是最新',
        ahead: false,
        vulns: [],
        note: null,
      },
      {
        name: 'aaa',
        raw: '1.0.0',
        current: '1.0.0',
        latest: '1.0.0',
        gap: { level: 'none' },
        gapLabel: '已是最新',
        ahead: false,
        vulns: [{ fixed: null }, {}],
        note: null,
      },
    ],
  });

  const table = markdown.split('\n').filter((line) => line.startsWith('| aaa') || line.startsWith('| zzz'));
  assert.equal(table.length, 2);
  assert.ok(table[0].startsWith('| aaa'), '有漏洞的行要排在前面');
  assert.ok(table[0].includes('暂无修复版本（2 条）'));
  assert.ok(table[1].includes('| — | — |'));
});
