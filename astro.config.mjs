// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://everwynn.github.io',
  base: '/tech-radar/',
  trailingSlash: 'always',
  integrations: [tailwind()],
  output: 'static',
  devToolbar: { enabled: false },
});
