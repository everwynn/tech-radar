import test from 'node:test';
import assert from 'node:assert/strict';
import { npmLatest, npmVersions } from '../scripts/sources/npm.mjs';
import { githubReleaseLatest } from '../scripts/sources/github-release.mjs';
import { endoflifeReleases } from '../scripts/sources/endoflife.mjs';

const jsonResponse = (data) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

test('npm 读取 latest.version', async () => {
  const fake = async () => jsonResponse({ version: '7.4.5' });
  assert.equal(await npmLatest('astro', fake), '7.4.5');
});

test('npm 主源失败时回退 jsDelivr', async () => {
  const fake = async (url) => {
    if (url.includes('registry.npmjs.org')) throw new Error('boom');
    return jsonResponse({ tags: { latest: '7.4.5' } });
  };
  assert.equal(await npmLatest('astro', fake), '7.4.5');
});

test('npm 版本列表过滤预发布并按版本降序', async () => {
  const fake = async () =>
    jsonResponse({
      versions: {
        '1.0.0': {},
        '2.0.0-beta.1': {},
        '1.10.0': {},
        '2.0.0': {},
        '1.2.3': {},
      },
    });
  assert.deepEqual(await npmVersions('demo', fake), ['2.0.0', '1.10.0', '1.2.3', '1.0.0']);
});

test('npm 无稳定版本时报错', async () => {
  const fake = async () => jsonResponse({ versions: { '1.0.0-rc.1': {} } });
  await assert.rejects(() => npmVersions('demo', fake), /稳定版本/);
});

test('GitHub Releases 按前缀过滤并跳过预发布', async () => {
  const fake = async () =>
    jsonResponse([
      { tag_name: '@astrojs/vercel@11.0.18', prerelease: false },
      { tag_name: 'v3.5.8', prerelease: false },
      { tag_name: 'v3.5.9-beta', prerelease: true },
    ]);
  assert.equal(await githubReleaseLatest({ repo: 'baomidou/mybatis-plus', tagPrefix: 'v' }, fake), '3.5.8');
});

test('endoflife 返回数组', async () => {
  const fake = async () => jsonResponse([{ cycle: '4.1', latest: '4.1.2' }]);
  const list = await endoflifeReleases('spring-boot', fake);
  assert.equal(list[0].cycle, '4.1');
});
