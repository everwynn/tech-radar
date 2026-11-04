import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';

interface CatalogFile {
  updatedAt: string;
}

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const origin = site ?? new URL('https://everwynn.github.io');

  // 用数据更新时间当 lastmod，避免每次构建都告诉爬虫「全站都变了」
  let lastmod = new Date().toISOString().slice(0, 10);
  try {
    const catalog = JSON.parse(
      readFileSync(new URL('../../data/catalog.json', import.meta.url), 'utf8'),
    ) as CatalogFile;
    if (catalog.updatedAt) lastmod = catalog.updatedAt.slice(0, 10);
  } catch {
    // 尚未抓取数据时退回构建日期
  }

  const entries = ['', 'about/']
    .map((path) => {
      const loc = new URL(`${base}${path}`, origin).href;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
