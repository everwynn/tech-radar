import { fetchJson } from '../lib/http.mjs';

export async function endoflifeReleases(product, fetchImpl) {
  const data = await fetchJson(`https://endoflife.date/api/${product}.json`, { fetchImpl });
  if (!Array.isArray(data)) throw new Error('endoflife 返回结构异常');
  return data;
}
