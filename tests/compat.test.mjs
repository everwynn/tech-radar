import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STATUS_LABELS,
  LEVEL_ORDER,
  validateCompat,
  parseSelection,
  buildSearch,
  jdkConflict,
  migrationMatches,
  sortMigrations,
} from '../src/lib/compat.mjs';

const fixture = {
  updatedAt: '2026-11-18',
  jdkOptions: ['8', '17'],
  bootLines: [
    { id: '2.7', label: 'Boot 2.7', jdkMin: 8, eolCycle: '2.7' },
    { id: '4.x', label: 'Boot 4.x', jdkMin: 17, eolCycle: '4.1' },
  ],
  libraries: [
    {
      id: 'lombok',
      name: 'Lombok',
      homepage: 'https://projectlombok.org',
      sources: [{ label: 'Changelog', url: 'https://projectlombok.org/changelog', checkedAt: '2026-11-18' }],
      cells: {
        '2.7': { status: 'ok', detail: '1.18.24' },
        '4.x': { status: 'unknown', detail: '待核实' },
      },
    },
  ],
  migrations: [
    { title: 'A', level: 'medium', appliesTo: ['4.x'], detail: 'd' },
    { title: 'B', level: 'high', appliesTo: ['2.7', '4.x'], detail: 'd' },
  ],
};

test('fixture 校验通过', () => {
  assert.deepEqual(validateCompat(fixture), []);
});

test('缺格与多余格都会被报出', () => {
  const broken = structuredClone(fixture);
  delete broken.libraries[0].cells['2.7'];
  broken.libraries[0].cells['9.x'] = { status: 'ok', detail: 'x' };
  const errors = validateCompat(broken);
  assert.ok(errors.some((e) => e.includes('缺少')));
  assert.ok(errors.some((e) => e.includes('未知版本线')));
});

test('非法 status 与空 detail 被报出', () => {
  const broken = structuredClone(fixture);
  broken.libraries[0].cells['2.7'] = { status: 'good', detail: ' ' };
  const errors = validateCompat(broken);
  assert.ok(errors.some((e) => e.includes('status')));
  assert.ok(errors.some((e) => e.includes('detail')));
});

test('appliesTo 引用不存在的版本线', () => {
  const broken = structuredClone(fixture);
  broken.migrations[0].appliesTo = ['9.x'];
  assert.ok(validateCompat(broken).some((e) => e.includes('appliesTo')));
});

test('sources 为空与 jdkMin 非整数被报出', () => {
  const broken = structuredClone(fixture);
  broken.libraries[0].sources = [];
  broken.bootLines[1].jdkMin = '17';
  const errors = validateCompat(broken);
  assert.ok(errors.some((e) => e.includes('sources')));
  assert.ok(errors.some((e) => e.includes('jdkMin')));
});

test('parseSelection 只接受合法值', () => {
  assert.deepEqual(parseSelection('?jdk=17&boot=4.x', fixture), { jdk: '17', boot: '4.x' });
  assert.deepEqual(parseSelection('?jdk=99&boot=9.x', fixture), { jdk: null, boot: null });
  assert.deepEqual(parseSelection('', fixture), { jdk: null, boot: null });
});

test('buildSearch 跳过空值且参数顺序固定', () => {
  assert.equal(buildSearch({ jdk: '17', boot: '4.x' }), '?jdk=17&boot=4.x');
  assert.equal(buildSearch({ jdk: null, boot: '4.x' }), '?boot=4.x');
  assert.equal(buildSearch({}), '');
});

test('jdkConflict 只校验下限', () => {
  assert.equal(jdkConflict(fixture.bootLines[1], '8'), '需要 JDK 17+');
  assert.equal(jdkConflict(fixture.bootLines[1], '17'), null);
  assert.equal(jdkConflict(fixture.bootLines[0], '8'), null);
  assert.equal(jdkConflict(fixture.bootLines[0], null), null);
});

test('migrationMatches：未选择时全部可见', () => {
  assert.equal(migrationMatches(fixture.migrations[0], null), true);
  assert.equal(migrationMatches(fixture.migrations[0], '2.7'), false);
  assert.equal(migrationMatches(fixture.migrations[0], '4.x'), true);
});

test('sortMigrations 按 high→medium→low 且稳定', () => {
  const sorted = sortMigrations(fixture.migrations);
  assert.deepEqual(sorted.map((m) => m.title), ['B', 'A']);
  assert.equal(LEVEL_ORDER.high, 0);
});

test('STATUS_LABELS 覆盖四个枚举', () => {
  assert.deepEqual(Object.keys(STATUS_LABELS).sort(), ['no', 'ok', 'partial', 'unknown']);
});

const real = JSON.parse(readFileSync(new URL('../data/compat.json', import.meta.url), 'utf8'));

test('真实数据通过完整性校验', () => {
  assert.deepEqual(validateCompat(real), []);
});

test('矩阵为 5 条版本线 × 5 个库 = 25 格', () => {
  assert.equal(real.bootLines.length, 5);
  assert.equal(real.libraries.length, 5);
  for (const library of real.libraries) {
    assert.equal(Object.keys(library.cells).length, 5);
  }
});

test('迁移警告排序后等级不倒退', () => {
  const levels = sortMigrations(real.migrations).map((m) => m.level);
  assert.ok(levels.every((level, index) => index === 0 || LEVEL_ORDER[levels[index - 1]] <= LEVEL_ORDER[level]));
});
