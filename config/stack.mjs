// 唯一维护入口：新增一项技术只需要在数组里加一条。
//
// 这里只声明「追踪哪些技术」和「数据从哪来」，不再记录「我在用什么版本」。
// 版本由用户在页面上输入，对比结果实时计算，所以清单不会过期，也没有清单滞后问题。
//
// 三种数据源各有分工，可以组合：
//   lifecycle —— endoflife.date，提供 cycles（每条版本线的 EOL / LTS）与 latest
//   versions  —— npm registry，提供最新版与完整稳定版本列表（用于自动补全）
//   releases  —— GitHub Releases，给没有 npm / 没有 endoflife 数据的库兜底
export const stack = [
  {
    id: 'node',
    name: 'Node.js',
    group: 'runtime',
    homepage: 'https://nodejs.org',
    lifecycle: { type: 'endoflife', product: 'nodejs' },
  },
  {
    id: 'jdk',
    name: 'JDK (Eclipse Temurin)',
    group: 'runtime',
    homepage: 'https://adoptium.net',
    lifecycle: { type: 'endoflife', product: 'eclipse-temurin' },
  },
  {
    id: 'spring-boot',
    name: 'Spring Boot',
    group: 'framework',
    homepage: 'https://spring.io/projects/spring-boot',
    lifecycle: { type: 'endoflife', product: 'spring-boot' },
    osv: { ecosystem: 'Maven', package: 'org.springframework.boot:spring-boot' },
  },
  {
    id: 'vue',
    name: 'Vue',
    group: 'framework',
    homepage: 'https://vuejs.org',
    lifecycle: { type: 'endoflife', product: 'vue' },
    versions: { type: 'npm', package: 'vue' },
    osv: { ecosystem: 'npm', package: 'vue' },
  },
  {
    id: 'astro',
    name: 'Astro',
    group: 'framework',
    homepage: 'https://astro.build',
    versions: { type: 'npm', package: 'astro' },
    osv: { ecosystem: 'npm', package: 'astro' },
  },
  {
    id: 'tailwindcss',
    name: 'Tailwind CSS',
    group: 'frontend',
    homepage: 'https://tailwindcss.com',
    lifecycle: { type: 'endoflife', product: 'tailwind-css' },
    versions: { type: 'npm', package: 'tailwindcss' },
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    group: 'frontend',
    homepage: 'https://www.typescriptlang.org',
    versions: { type: 'npm', package: 'typescript' },
  },
  {
    id: 'vite',
    name: 'Vite',
    group: 'frontend',
    homepage: 'https://vite.dev',
    versions: { type: 'npm', package: 'vite' },
  },
  {
    id: 'mybatis-plus',
    name: 'MyBatis-Plus',
    group: 'data',
    homepage: 'https://baomidou.com',
    releases: { type: 'github-release', repo: 'baomidou/mybatis-plus', tagPrefix: 'v' },
  },
  {
    id: 'jjwt',
    name: 'JJWT',
    group: 'data',
    homepage: 'https://github.com/jwtk/jjwt',
    // jjwt 的 tag 不带 v 前缀（0.13.0），与 mybatis-plus 的 vX.Y.Z 不同
    releases: { type: 'github-release', repo: 'jwtk/jjwt', tagPrefix: '' },
    osv: { ecosystem: 'Maven', package: 'io.jsonwebtoken:jjwt-api' },
  },
];
