import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersion,
  compareVersions,
  gapBetween,
  describeGap,
  isVersion,
  sameMajorLine,
} from '../src/lib/versions.mjs';

test('解析标准版本', () => {
  assert.deepEqual(parseVersion('4.16.19'), { major: 4, minor: 16, patch: 19 });
});

test('解析预发布后缀时忽略后缀', () => {
  assert.deepEqual(parseVersion('7.4.4-beta.0'), { major: 7, minor: 4, patch: 4 });
});

test('解析两段版本', () => {
  assert.deepEqual(parseVersion('3.5'), { major: 3, minor: 5, patch: 0 });
});

test('非法版本返回 null', () => {
  assert.equal(parseVersion('latest'), null);
  assert.equal(parseVersion(''), null);
  assert.equal(isVersion('latest'), false);
  assert.equal(isVersion('1.2.3'), true);
});

test('版本比较', () => {
  assert.equal(compareVersions('4.16.19', '7.4.5'), -1);
  assert.equal(compareVersions('7.4.5', '4.16.19'), 1);
  assert.equal(compareVersions('3.5.4.1', '3.5.4'), 0);
});

test('落后程度只报告最高一层', () => {
  assert.deepEqual(gapBetween('4.16.19', '7.4.5'), { level: 'major', majors: 3, minors: 0, patches: 0 });
  assert.deepEqual(gapBetween('7.3.0', '7.4.5'), { level: 'minor', majors: 0, minors: 1, patches: 0 });
  assert.deepEqual(gapBetween('7.4.1', '7.4.5'), { level: 'patch', majors: 0, minors: 0, patches: 4 });
  assert.deepEqual(gapBetween('7.4.5', '7.4.5'), { level: 'none', majors: 0, minors: 0, patches: 0 });
});

test('输入版本高于最新时视为同步', () => {
  assert.equal(gapBetween('8.0.0', '7.4.5').level, 'none');
});

test('中文描述', () => {
  assert.equal(describeGap(gapBetween('4.16.19', '7.4.5')), '落后 3 个大版本');
  assert.equal(describeGap(gapBetween('7.3.0', '7.4.5')), '落后 1 个小版本');
  assert.equal(describeGap(gapBetween('7.4.5', '7.4.5')), '已是最新');
});

test('同主版本线判断', () => {
  assert.equal(sameMajorLine('4.16.19', '4.0.0'), true);
  assert.equal(sameMajorLine('4.16.19', '5.0.0'), false);
  assert.equal(sameMajorLine('bad', '4.0.0'), false);
});
