# Tech Radar

技术栈版本雷达：一页回答三个问题——**这个版本落后多少、还在支持期内吗、有哪些已知漏洞。**

线上地址：<https://everwynn.github.io/tech-radar/>

清单里没有任何版本号，只声明「追踪哪些技术、数据从哪来」。版本由访问者输入，结论在浏览器里实时计算，
所以清单不会过期，也不需要跟着升级同步修改。粘贴一段 `package.json` 还能把整串依赖一次体检（限 npm 生态）。

## 功能

| 区域 | 作用 |
| --- | --- |
| 版本对比 | 选技术 + 输入版本，给出落后程度、所属版本线、支持状态、LTS 标记，以及该版本的已知漏洞（默认 3–8 条，可展开）；结果写进地址栏，`?tech=astro&v=4.16.19` 可直接还原 |
| 项目体检 | 粘贴 `package.json` 片段或「包名 版本」列表，一次列出每个包落后多少、命中哪些漏洞、升到哪个版本能避开；结果写进地址栏，`?deps=vue@3.3.0,astro@4.0.0` 可还原 |
| 技术清单 | 按运行时 / 框架 / 前端库 / 数据与安全 / 工具链分组，每张卡片列出最新稳定版、最新 LTS、最近 6 条版本线及各自 EOL，其余版本线可在卡片内展开 |
| 搜索 | 按技术名、分组名、版本号过滤卡片，输入 `3.5` 可同时命中 Vue、Vite、MyBatis-Plus |
| 关于 | 数据来源、计算口径、维护方式、已知局限、隐私说明 |
| 渐进增强 | 关闭 JS 时清单与全部静态信息照常显示，只有对比、搜索、漏洞查询不可用；375px 起无横向滚动 |

## 不做什么

- 不做全生态版本数据库。endoflife.date 已覆盖数百个产品，这里只挑自己关心的十几项（当前 15 项）。
- 不做自动升级、不提交依赖升级 PR、不接 CI 报警——只陈述版本事实。
- 不扫描仓库、不读取本地文件：只处理你主动粘贴的内容，也不推断「你实际在用什么版本」。
- 不做账号、收藏、通知。数据一天刷新一次，足够回答上面三个问题。

## 数据源

| 来源 | 用途 | 当前覆盖 |
| --- | --- | --- |
| [endoflife.date](https://endoflife.date) | 版本线、EOL、支持截止、LTS | Node.js、Temurin、Tomcat、Spring Boot、Spring Framework、Vue、Tailwind CSS、MySQL、Redis、Apache Maven |
| [npm registry](https://registry.npmjs.org) | 最新稳定版与版本全集 | Vue、Astro、Tailwind CSS、TypeScript、Vite |
| [GitHub Releases](https://docs.github.com/rest/releases) | npm 与 endoflife 都没覆盖的库 | MyBatis-Plus、JJWT |
| [OSV](https://osv.dev) | 任意版本的已知漏洞 | Spring Boot、Spring Framework、Tomcat、Vue、Astro、Vite、MyBatis-Plus、JJWT、Apache Maven（按生态 + 包名 + 版本查询） |

三个抓取源（`endoflife` / `npm` / `github`）可以任意组合，每项至少用一个。OSV 不参与抓取，
由浏览器直连，所以站点本身不存漏洞数据。

### 踩过的坑

- **不能用 GitHub `/releases/latest`**：Astro 这类 monorepo 会返回子包 tag（如 `@astrojs/vercel@11.0.18`），
  必须拉列表按前缀过滤。
- **Maven Central 的 `latestVersion` 索引滞后**（查询时返回 3.5.3，实际已是 4.1.2），不能作为主源。
- **endoflife 的数组顺序不保证按版本排序**，取「最新」必须显式比较版本号。
- **PowerShell 的 `Invoke-RestMethod` 对 npm registry 会超时**，抓取一律走 Node 的 `fetch`。
- **npm 的 `dist-tags.latest` 可能是预发布**，版本全集只保留 `x.y.z` 形式，避免把 `4.0.0-beta.1` 当成最新。

## 数据模型

`npm run fetch` 写出 `data/catalog.json`，页面在构建期读取：

| 字段 | 说明 |
| --- | --- |
| `updatedAt` | 本轮抓取完成时间（ISO 8601），页面显示「今天 / N 天前」 |
| `sources` | 各源本轮状态：`ok` / `skipped` / `error`，用于展示健康度 |
| `items[]` | 每项技术一条，顺序与 `config/stack.mjs` 一致 |
| `items[].latest` | 最新稳定版；取不到时为 `null` |
| `items[].latestLts` | 最新 LTS 版本线的版本号；没有 LTS 概念时不出现 |
| `items[].cycles` | 版本线数组，按版本号降序，字段见下 |
| `items[].versions` | 稳定版本全集，降序；只有 npm 源才有，其余为空数组 |
| `items[].osv` | 漏洞查询坐标 `{ ecosystem, package }`；不支持时为 `null` |
| `items[].stale` | 本轮抓取失败的项沿用上一轮数据时置 `true`，页面显示「沿用上次」 |

`cycles` 每项包含 `cycle`（版本线，如 `20` 或 `2.7`）、`latest`、`releaseDate`、`eol`、`support`、`lts`。
`eol` 与 `lts` 在 endoflife 里可能是日期、`true` / `false` 或 `null`，`fetch` 阶段统一归一化。

## 计算口径

### 落后程度

只比较版本号前三段，且只报告最高一层差异。`4.16.19 → 7.4.5` 得到「落后 3 个大版本」，
不会同时说「落后 5 个补丁」——避免制造虚假的精确感。输入高于已发布版本时显示「高于已发布的最新稳定版」，
版本号不符合 `^[0-9A-Za-z.+_-]{1,40}$` 时直接判为无法识别。

### 支持状态

先把输入版本映射到版本线：优先匹配 `major.minor`（如 `2.7.18 → 2.7`），匹配不到再回退 `major`（`2`）。
再用该版本线的 `eol` 与今天比较：已过期为「已停止支持」，180 天内为「即将停止支持」，其余为「支持中」。
没有版本线数据的技术不显示这个判断，改为一条「该技术暂无 EOL 数据」。

### 漏洞

浏览器按 `{ ecosystem, package, version }` POST 到 `api.osv.dev/v1/query`，15 秒超时。
返回结果过滤 `withdrawn`、按 id 去重；严重度取 `database_specific.severity`（`MEDIUM` 归一为 `MODERATE`），
修复版本取所有 `ranges` 中最小的 `fixed`；按严重度排序后展示。结果在内存里按「生态:包:版本」缓存，
同一版本重复查询不再发起请求。

### 升级目标

如果当前版本命中公告，体检行会给出「升到 X 及以上可避开」。X 取所有命中公告 `fixed` 版本的最大值，
也就是「能避开全部已公布修复」的最低版本；没有 `fixed` 的公告单独计数。这个数字是按 OSV 数据推算的下限，
不等于推荐升级版本——跨大版本时仍要看迁移说明。

### 项目体检

粘贴的内容先归一成「包名 + x.y.z」：支持完整 `package.json`、`dependencies` / `devDependencies` 片段，
或每行「包名 版本」。同名包以 `dependencies` 为准；`workspace:`、`file:`、`link:`、`git+`、`npm:` 别名
以及 `1.x`、`||` 这类范围写法不做猜测，归入「已跳过」并标注原因。最多查询 40 个包。

每个包取 `registry.npmjs.org/{name}/latest` 的 `version`（6 并发，10 秒超时），再一次性 POST 到
`api.osv.dev/v1/querybatch` 问哪些包命中公告；只有命中的包才逐个取详情（严重度、修复版本）。
单个包查询失败只影响自己那一行；整批 OSV 失败时面板会明确标注「这次结论不含漏洞信息」。

成功的体检会把已识别的包写进地址栏：`?deps=vue@3.3.0,astro@4.0.0`。
打开链接会填回输入框并重新体检（最新版本与漏洞是实时的，所以只能还原范围，不能还原当时的结论）。

## 维护一项技术

`config/stack.mjs` 是唯一维护入口：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 唯一，小写字母、数字、连字符 |
| `name` / `group` / `homepage` | 是 | `group` 只能是 `runtime`、`framework`、`frontend`、`data`、`tool`；`homepage` 必须 `https://` |
| `lifecycle` | 否 | `{ type: 'endoflife', product: 'nodejs' }`，product 用 endoflife 的 slug |
| `versions` | 否 | `{ type: 'npm', package: 'vue' }` |
| `releases` | 否 | `{ type: 'github-release', repo: 'owner/name', tagPrefix: 'v' }`，tag 无前缀时写空字符串 |
| `osv` | 否 | `{ ecosystem: 'npm' | 'Maven', package: '...' }`，Maven 用 `groupId:artifactId` |

三段流程：

1. 在 `config/stack.mjs` 增删条目，只写数据源，不写版本号；
2. `npm run fetch`，确认该项有 `latest`（没有就是 slug 或 repo 写错了）；
3. `npm run dev` 试一次对比，确认版本线与漏洞正常后提交 `config/` 与 `data/` 的变化。

## 本地运行

需要 Node.js ≥ 20.6（用到 `node --test` 与内置 `fetch`）。

```bash
npm install
npm run fetch     # 抓取数据，写入 data/catalog.json
npm run dev       # 本地预览
npm test          # node --test：版本比较、EOL、取数源、清单校验、体检与分享链接
npm run check     # astro check
npm run build     # 产出 dist/
```

`npm run fetch` 的行为约定：

- 单项失败只影响该项，保留上一轮数据并标 `stale`，不会让整轮抓取失败；
- 内容无变化时不写盘，避免每天产生无意义的提交；
- 除非清单校验不通过，退出码恒为 0，可以直接放进定时任务。

## 目录结构

```
config/stack.mjs          技术清单（唯一维护入口，不含版本号）
scripts/fetch.mjs         抓取编排：取数 → 归一化 → 合并上一轮 → 写盘
scripts/lib/              http（重试与超时）/ registry（清单校验）/ files（幂等写盘）
scripts/sources/          endoflife / npm / github-release
src/lib/versions.mjs      版本解析、比较、差距计算（构建期与浏览器共用）
src/lib/eol.mjs           版本线匹配、EOL 三态判定
src/lib/compare.ts        对比结果组装（服务端与客户端共用的口径）
src/lib/deps.mjs          package.json / 行文本解析与版本归一
src/lib/audit-core.mjs    体检用纯逻辑：npm 地址、切批、行组装
src/lib/audit.ts          浏览器端体检编排：npm latest + OSV 批量查询
src/lib/vuln-ui.ts        严重度文案与色板（对比与体检共用）
src/lib/osv.ts            浏览器端漏洞查询、解析与缓存
src/lib/catalog.ts        构建期读取 catalog.json，容错空结构
src/lib/format.ts         日期与「N 天前」格式化
src/components/           ComparePanel（对比与漏洞）/ AuditPanel（项目体检）/ TechCard / ThemeToggle
src/pages/                首页、关于、404、robots.txt、sitemap.xml
data/catalog.json         页面读取的数据快照
```

`versions.mjs` 与 `eol.mjs` 写成 `.mjs` 并开启 `allowJs`，是为了让 `fetch` 脚本与浏览器端
共用同一套比较逻辑——两处各写一遍必然会出现口径漂移。

## 部署

`.github/workflows/deploy.yml` 每天 06:41（Asia/Shanghai）执行 `test → check → fetch → build → deploy`，
数据有变化时以 `[skip ci]` 提交回仓库，避免自己触发自己。

- 仓库名必须是 `tech-radar`，Pages 地址才会是 `https://everwynn.github.io/tech-radar/`，
  与 `astro.config.mjs` 的 `base: '/tech-radar/'` 对应；
- Pages 的 Source 设为 **GitHub Actions**；
- `DATA_PUSH_TOKEN` 可选：默认用 `GITHUB_TOKEN` 提交，配置 PAT 后可以绕开保护分支限制；
- 抓取时传入 `GITHUB_TOKEN` 只为提高 GitHub API 限额（匿名 60 次/小时）。

## 已知局限

- **JDK 与 Node.js 查不到漏洞**：OSV 按包管理生态组织数据，这两个属于运行时分发版，没有对应生态。
- **版本全集只覆盖 npm**：MyBatis-Plus 与 JJWT 只有 GitHub 上的最新 release，输入更早版本时不校验是否存在。
- **预发布版本会被截断为三段**后参与比较，`4.0.0-beta.1` 与 `4.0.0` 视为同版本，结果仅供参考。
- **漏洞条数不等于可利用性**：返回的是「影响该版本的公告条目」，需结合修复版本、调用方式自行评估。
- **版本号差距不等于迁移成本**：跨大版本往往伴随破坏性变更，本站在版本事实之外不做任何承诺。
- **数据滞后最长一天**：新披露的漏洞能实时查到（OSV 直连），但最新版本号依赖每日抓取。
- **项目体检只覆盖 npm**：Java 侧依赖仍需逐项对比；`latest` 标签也不等于推荐升级目标，跨大版本仍要看迁移说明。
- **升级目标是下限而不是推荐值**：只按 OSV 的 `fixed` 取最大值推算，未考虑破坏性变更、传递依赖与调用方式。
- **Tailwind CSS 与 TypeScript 查不到漏洞**：OSV 目前没有这两个包的公告记录，不是查询失败。

## 许可

内容与代码仅用于个人学习与自用。
