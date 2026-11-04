import test from 'node:test';
import assert from 'node:assert/strict';
import { stack } from '../config/stack.mjs';
import { validateStack } from '../scripts/lib/registry.mjs';

test('内置清单合法且不少于 10 项', () => {
  assert.doesNotThrow(() => validateStack(stack));
  assert.ok(stack.length >= 10);
});

test('拒绝重复 id', () => {
  const bad = [{ ...stack[0] }, { ...stack[1], id: stack[0].id }];
  assert.throws(() => validateStack(bad), /id 重复/);
});

test('拒绝非法 group', () => {
  assert.throws(() => validateStack([{ ...stack[0], group: 'other' }]), /group 非法/);
});

test('拒绝没有任何数据源的条目', () => {
  const { lifecycle, versions, releases, ...rest } = stack[0];
  assert.throws(() => validateStack([rest]), /至少需要 lifecycle/);
});

test('拒绝缺少 npm package', () => {
  assert.throws(() => validateStack([{ ...stack[0], versions: { type: 'npm' } }]), /缺少 package/);
});

test('拒绝缺少 endoflife product', () => {
  assert.throws(() => validateStack([{ ...stack[0], lifecycle: { type: 'endoflife' } }]), /缺少 product/);
});

test('拒绝缺少 github repo', () => {
  assert.throws(() => validateStack([{ ...stack[0], releases: { type: 'github-release', tagPrefix: 'v' } }]), /缺少 repo/);
});

test('拒绝非 https homepage', () => {
  assert.throws(() => validateStack([{ ...stack[0], homepage: 'http://nodejs.org' }]), /https/);
});

test('接受 lifecycle 与 versions 并存', () => {
  const item = { ...stack[0], versions: { type: 'npm', package: 'node' } };
  assert.doesNotThrow(() => validateStack([item]));
});

test('拒绝不完整的 osv 配置', () => {
  assert.throws(() => validateStack([{ ...stack[0], osv: { ecosystem: 'npm' } }]), /osv 配置不完整/);
});
