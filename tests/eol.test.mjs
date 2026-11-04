import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCycle, eolState, eolLabel, normalizeCycles, NEAR_DAYS } from '../src/lib/eol.mjs';

const NOW = new Date('2026-11-04T00:00:00.000Z');
const releases = [
  { cycle: '4.1', eol: '2027-07-31', latest: '4.1.2' },
  { cycle: '3.5', eol: '2026-06-30', latest: '3.5.16' },
  { cycle: '2.7', eol: '2023-06-30', latest: '2.7.18' },
];

test('按 major.minor 匹配 cycle', () => {
  assert.equal(pickCycle(releases, '3.5.16').cycle, '3.5');
});

test('按 major 回退匹配', () => {
  assert.equal(pickCycle(releases, '2.7.18').cycle, '2.7');
});

test('无匹配返回 null', () => {
  assert.equal(pickCycle(releases, '9.0.0'), null);
});

test('已过期日期判为 eol', () => {
  const state = eolState({ cycle: '2.7', eol: '2023-06-30' }, NOW);
  assert.equal(state.state, 'eol');
  assert.ok(state.daysLeft < 0);
});

test('180 天内判为 near', () => {
  const state = eolState({ cycle: '3.5', eol: '2026-12-31' }, NOW);
  assert.equal(state.state, 'near');
  assert.ok(state.daysLeft <= NEAR_DAYS);
});

test('远期日期判为 ok', () => {
  assert.equal(eolState({ cycle: '4.1', eol: '2027-07-31' }, NOW).state, 'ok');
});

test('eol 为 true 判为 eol', () => {
  assert.equal(eolState({ cycle: '1.0', eol: true }, NOW).state, 'eol');
});

test('eol 为 false 或缺失判为 ok', () => {
  assert.equal(eolState({ cycle: '1.0', eol: false }, NOW).state, 'ok');
  assert.equal(eolState({ cycle: '1.0' }, NOW).state, 'ok');
});

test('缺少数据判为 unknown', () => {
  assert.equal(eolState(null, NOW).state, 'unknown');
});

test('中文标签', () => {
  assert.equal(eolLabel({ state: 'eol' }), '已停止支持');
  assert.equal(eolLabel({ state: 'ok' }), '支持中');
  assert.equal(eolLabel({ state: 'near', daysLeft: 42 }), '42 天后停止支持');
  assert.equal(eolLabel({ state: 'unknown' }), '未知');
});

test('归一化 cycle 时保留 LTS 日期与布尔标记', () => {
  const cycles = normalizeCycles([
    { cycle: '24', latest: '24.11.0', eol: '2028-04-30', lts: '2025-10-28', releaseDate: '2025-05-06' },
    { cycle: '8', latest: '8.0.472', eol: '2030-12-31', lts: true },
    { cycle: null, latest: '1.0.0' },
  ]);
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].lts, '2025-10-28');
  assert.equal(cycles[0].releaseDate, '2025-05-06');
  assert.equal(cycles[1].lts, true);
});

test('归一化时布尔 eol 原样保留', () => {
  const cycles = normalizeCycles([{ cycle: '1', latest: '1.0.0', eol: true }]);
  assert.equal(cycles[0].eol, true);
});
