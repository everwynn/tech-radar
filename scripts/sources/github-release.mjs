import { fetchJson, USER_AGENT } from '../lib/http.mjs';

// 不能使用 /releases/latest：Astro 这类 monorepo 会返回子包 tag
// （例如 @astrojs/vercel@11.0.18），必须按前缀过滤并跳过预发布。
export async function githubReleaseLatest({ repo, tagPrefix = '' }, fetchImpl, token = process.env.GITHUB_TOKEN) {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
  };
  // 带上 token 可把匿名限速 60 次/小时提到 5000 次/小时
  if (token) headers.Authorization = `Bearer ${token}`;

  const list = await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
    headers,
    fetchImpl,
  });
  if (!Array.isArray(list)) throw new Error('GitHub Releases 返回结构异常');
  const candidate = list.find((item) => {
    const tag = String(item.tag_name ?? '');
    return !item.prerelease && tag.startsWith(tagPrefix);
  });
  if (!candidate) throw new Error(`${repo} 无匹配 tag`);
  return String(candidate.tag_name).slice(tagPrefix.length).replace(/^v/i, '');
}
