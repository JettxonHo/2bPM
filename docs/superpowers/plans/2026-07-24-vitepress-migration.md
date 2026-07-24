# 2bPM 迁移 VitePress 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把《自学成AI产品经理》从 Sphinx/d2lbook2 迁移到 VitePress，解决黄字可读性问题，获得极简护眼、带深色模式与全文搜索的阅读体验。

**Architecture:** 写一个 Node 迁移脚本，读取现有 296 个 markdown，做非破坏性转换（清 Sphinx 专有语法、统一图片路径、保留 HEAD 解决 git 冲突、重命名章节为 slug、生成 VitePress 导航与旧链接跳转），输出到一个新的 VitePress 站点目录；再用 GitHub Actions 构建部署到 GitHub Pages。原 `.md` 源文件保持不动，全部转换作用于生成的副本。

**Tech Stack:** VitePress v1.6、Node 22、markdown-it-mathjax3、GitHub Actions、GitHub Pages。

## Global Constraints

- 原始 `.md` 内容文件**不得改动**（迁移转换只作用于生成的副本）；唯一例外是 Task 1 解决 git 冲突标记——这本身是对内容 bug 的修复，需改动 `get_started.md` 与 `AI_critical.md`。
- git 冲突解决策略：**一律保留 `HEAD` 侧**，删除另一侧与冲突标记（用户已拍板）。
- 章节 slug 命名规则：去掉 `chapter_` 前缀、`+` 转 `-`、`AI` 小写为 `ai`、其余小写化。映射表见 Task 3。
- 链接颜色对比度必须 ≥ 4.5（WCAG AA），禁止任何黄底黄字。
- 图片统一放 `site/public/img/`，正文引用统一改为 `/img/<文件名>`。
- 构建产物输出目录沿用 `docs/`（GitHub Pages 部署源）。
- 所有提交信息结尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- Node 可用：`/usr/local/bin/node` v22.15.1；npm v10.9.2。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `scripts/lib/conflicts.mjs` | 解决 git 冲突标记（保留 HEAD 侧） |
| `scripts/lib/transform.mjs` | 单个 markdown 内容转换（去 `:label:`、toc 块、统一图片路径） |
| `scripts/lib/chapters.mjs` | 章节 slug 映射 + 解析根/章节 index 的 toc 生成导航数据 |
| `scripts/migrate.mjs` | 主迁移脚本：编排以上 lib，生成 site 内容与导航、跳转映射 |
| `scripts/verify.mjs` | 校验：文件无遗漏、无残留冲突标记、图片引用有效 |
| `site/.vitepress/config.mts` | VitePress 站点配置 |
| `site/.vitepress/theme/index.js` + `custom.css` | 折中风格自定义主题 |
| `site/.vitepress/nav.json` | 迁移脚本生成的导航（构建期产物，被 config 引用） |
| `.github/workflows/deploy.yml` | 自动构建部署到 GitHub Pages |

测试方式：本迁移是一次性内容转换，用 `scripts/verify.mjs` 做端到端断言（文件齐全、无残留标记、图片存在），而非逐函数单测。每个 lib 的关键函数在 verify 脚本里被间接覆盖。

---

## Task 1: 解决两个文件的 git 合并冲突（保留 HEAD 侧）

**Files:**
- Create: `scripts/lib/conflicts.mjs`
- Create: `scripts/resolve-conflicts.mjs`
- Modify: `get_started.md`（删除冲突标记与非 HEAD 侧）
- Modify: `AI_critical.md`（同上）

**Interfaces:**
- Produces: `resolveConflictMarkers(text: string): string` —— 输入含冲突标记的文本，返回只保留 HEAD 侧、无标记的文本。被 `resolve-conflicts.mjs` 与本任务直接调用。

- [ ] **Step 1: 写冲突解决函数**

创建 `scripts/lib/conflicts.mjs`：

```js
// 解决 git 冲突标记，一律保留 HEAD 侧。
// 冲突块形如：
//   <<<<<<< HEAD
//   ...HEAD 内容（保留）...
//   =======
//   ...另一侧内容（丢弃）...
//   >>>>>>> <commit>
export function resolveConflictMarkers(text) {
  const lines = text.split('\n');
  const out = [];
  let state = 'normal'; // normal | head | other
  for (const line of lines) {
    if (line.startsWith('<<<<<<<')) { state = 'head'; continue; }
    if (line.startsWith('=======') && state === 'head') { state = 'other'; continue; }
    if (line.startsWith('>>>>>>>') && state === 'other') { state = 'normal'; continue; }
    if (state === 'other') continue;      // 丢弃另一侧
    out.push(line);                        // normal 与 head 都保留
  }
  return out.join('\n');
}
```

- [ ] **Step 2: 写命令行入口**

创建 `scripts/resolve-conflicts.mjs`：

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveConflictMarkers } from './lib/conflicts.mjs';

const files = ['get_started.md', 'AI_critical.md'];
for (const f of files) {
  const before = readFileSync(f, 'utf8');
  const after = resolveConflictMarkers(before);
  writeFileSync(f, after);
  const removed = before.split('\n').length - after.split('\n').length;
  console.log(`${f}: 移除 ${removed} 行（含冲突标记与非 HEAD 侧）`);
}
```

- [ ] **Step 3: 运行并验证无残留标记**

```bash
cd /Users/ketchup/Projects/2bPM
node scripts/resolve-conflicts.mjs
grep -nE '^(<<<<<<<|=======|>>>>>>>)' get_started.md AI_critical.md || echo "无残留冲突标记"
```

Expected: 打印两个文件的移除行数；grep 输出"无残留冲突标记"。

- [ ] **Step 4: 人工抽查一处语义**

```bash
sed -n '8,20p' get_started.md
```

Expected: 看到 `## 项目目的` 及正文，无 `<<<<<<<` 等标记，内容连贯。

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/conflicts.mjs scripts/resolve-conflicts.mjs get_started.md AI_critical.md
git commit -m "fix: 解决 get_started 与 AI_critical 的 git 合并冲突(保留HEAD)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: VitePress 站点骨架

**Files:**
- Create: `site/package.json`
- Create: `site/.vitepress/config.mts`
- Create: `site/.vitepress/theme/index.js`
- Create: `site/.vitepress/theme/custom.css`
- Create: `site/index.md`

**Interfaces:**
- Produces: `site/.vitepress/config.mts` 引用 `./nav.json`（由 Task 3 迁移脚本生成）。本站骨架在 nav.json 缺失时也要能 `vitepress dev` 启动（用 try/catch 容错）。

- [ ] **Step 1: 初始化 package 并安装依赖**

```bash
cd /Users/ketchup/Projects/2bPM/site
npm init -y
npm install -D vitepress markdown-it-mathjax3
```

Expected: `node_modules/.bin/vitepress` 存在。

- [ ] **Step 2: 写站点配置**

创建 `site/.vitepress/config.mts`：

```ts
import { defineConfig } from 'vitepress'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const navPath = join(here, 'nav.json')
const nav = existsSync(navPath)
  ? JSON.parse(readFileSync(navPath, 'utf8'))
  : { nav: [], sidebar: {} }

export default defineConfig({
  lang: 'zh-CN',
  title: '自学成 AI 产品经理',
  description: 'AI 产品经理知识库',
  cleanUrls: true,
  srcExclude: ['**/README.md'],
  markdown: { math: true, lineNumbers: false },
  themeConfig: {
    nav: nav.nav,
    sidebar: nav.sidebar,
    search: { provider: 'local' },
    outline: { label: '本页大纲', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新于' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    socialLinks: [{ icon: 'github', link: 'https://github.com/StevenJokess/2bPM' }]
  }
})
```

- [ ] **Step 3: 写折中风格自定义主题**

创建 `site/.vitepress/theme/index.js`：

```js
import DefaultTheme from 'vitepress/theme'
import './custom.css'
export default DefaultTheme
```

创建 `site/.vitepress/theme/custom.css`：

```css
:root {
  /* 折中风格：暖白底 + 深灰正文 + 护眼深绿链接 */
  --vp-c-bg: #fafaf7;
  --vp-c-bg-soft: #f3f2ec;
  --vp-c-text-1: #23272a;
  --vp-c-text-2: #4a4f52;
  --vp-c-brand-1: #2f6f4f;   /* 链接主色：深森林绿，对比度达标 */
  --vp-c-brand-2: #245a3e;
  --vp-c-brand-3: #2f6f4f;
  --vp-c-brand-soft: rgba(47, 111, 79, 0.12);
  --vp-font-family-base: -apple-system, BlinkMacSystemFont, "SF Pro SC",
    "PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif;
}
.dark {
  --vp-c-bg: #1a1b1e;
  --vp-c-bg-soft: #232427;
  --vp-c-text-1: #e6e4de;
  --vp-c-text-2: #b3b0a8;
  --vp-c-brand-1: #7fb894;   /* 深色模式下用浅绿保证对比度 */
  --vp-c-brand-2: #9ccbad;
  --vp-c-brand-3: #7fb894;
}
/* 中文长文排版优化 */
.vp-doc p { line-height: 1.9; }
.vp-doc { font-size: 16.5px; }
```

- [ ] **Step 4: 写首页**

创建 `site/index.md`：

```md
---
layout: home
hero:
  name: 自学成 AI 产品经理
  text: 体系化的 AI 产品经理知识库
  tagline: 学习如何成为 AI 产品经理
  actions:
    - theme: brand
      text: 开始阅读
      link: /home
---
```

- [ ] **Step 5: 验证站点能启动**

```bash
cd /Users/ketchup/Projects/2bPM/site
node_modules/.bin/vitepress dev --port 5174 &
sleep 6
curl -s http://127.0.0.1:5174/ | grep -o '自学成 AI 产品经理' | head -1
kill %1
```

Expected: 输出"自学成 AI 产品经理"（首页渲染成功，nav.json 缺失也能容错启动）。

- [ ] **Step 6: Commit**

```bash
cd /Users/ketchup/Projects/2bPM
git add site/package.json site/package-lock.json site/.vitepress site/index.md
echo "site/node_modules/" >> .gitignore
git add .gitignore
git commit -m "feat: 搭建 VitePress 站点骨架与折中风格主题

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: 章节 slug 映射与导航生成

**Files:**
- Create: `scripts/lib/chapters.mjs`

**Interfaces:**
- Produces:
  - `SLUG_MAP: Record<string, string>` —— 原目录名 → slug。
  - `parseTocFiles(indexText: string): string[]` —— 从 index.md 文本提取 toc 块里的文件条目。
  - `buildNav(root, chapters): { nav, sidebar }` —— 生成 VitePress nav/sidebar 结构。

- [ ] **Step 1: 写章节映射与解析模块**

创建 `scripts/lib/chapters.mjs`：

```js
// 原目录名 → URL slug（去 chapter_ 前缀、+ 转 -、AI 小写、小写化）
export const SLUG_MAP = {
  'chapter_introduction': 'introduction',
  'chapter_idea': 'idea',
  'chapter_knowledge': 'knowledge',
  'chapter_experience': 'experience',
  'chapter_project': 'project',
  'chapter_interview': 'interview',
  'chapter_AI_job': 'ai-job',
  'chapter_data_dive': 'data-dive',
  'chapter_AI_dive': 'ai-dive',
  'chapter_AI_politics': 'ai-politics',
  'chapter_AI_company': 'ai-company',
  'chapter_AIorPM_expert': 'ai-pm-expert',
  'chapter_AI+Finance': 'ai-finance',
  'chapter_dive': 'dive',
  'chapter_skill': 'skill',
  'chapter_more': 'more',
};

// 从 index.md 文本提取 ```toc 块里的文件条目（去掉 :maxdepth: 等指令行与空行）
export function parseTocFiles(indexText) {
  const m = indexText.match(/```toc([\s\S]*?)```/);
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(':'));
}
```

（`buildNav` 在 Task 4 主脚本里组装，本模块只提供 SLUG_MAP 与 parseTocFiles 两个纯函数，便于独立验证。）

- [ ] **Step 2: 验证解析正确**

```bash
cd /Users/ketchup/Projects/2bPM
node --input-type=module -e "
import { SLUG_MAP, parseTocFiles } from './scripts/lib/chapters.mjs';
import { readFileSync } from 'node:fs';
const files = parseTocFiles(readFileSync('chapter_AI_company/index.md','utf8'));
console.log('条目数:', files.length, '首项:', files[0]);
console.log('slug:', SLUG_MAP['chapter_AI+Finance']);
"
```

Expected: `条目数: 25 首项: company_research` 与 `slug: ai-finance`。

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/chapters.mjs
git commit -m "feat: 章节 slug 映射与 toc 解析模块

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: 内容转换模块

**Files:**
- Create: `scripts/lib/transform.mjs`

**Interfaces:**
- Consumes: `resolveConflictMarkers`（Task 1）、`parseTocFiles`（Task 3）。
- Produces: `transformMarkdown(text: string): string` —— 单文件内容转换：去 `:label:`、把 toc 块替换为提示行、图片路径统一为 `/img/<文件名>`。

- [ ] **Step 1: 写内容转换模块**

创建 `scripts/lib/transform.mjs`：

```js
// 单个 markdown 内容转换：清理 Sphinx 专有语法，统一图片路径。
// 输入原始 md 文本，输出 VitePress 可渲染文本。
export function transformMarkdown(text) {
  let out = text;
  // 1. 去掉 :label:`xxx` 整行
  out = out.replace(/^\s*:label:`[^`]*`\s*$/gm, '');
  // 2. 把 ```toc ... ``` 块替换为提示（导航由 sidebar 承担）
  out = out.replace(/```toc[\s\S]*?```/g, '> （本节目录见左侧导航）\n');
  // 3. 去掉残留的 toc 指令行
  out = out.replace(/^\s*:(maxdepth|numbered):.*$/gm, '');
  // 4. 图片路径统一为 /img/<文件名>（覆盖 /img/、./img/、img/、../img/ 写法，不动 http 外链）
  out = out.replace(/!\[([^\]]*)\]\((?!https?:)[^)]*?([^/)]+\.(?:png|jpg|jpeg|gif|svg|webp))\)/gi,
    '![$1](/img/$2)');
  return out;
}
```

- [ ] **Step 2: 验证转换正确**

```bash
cd /Users/ketchup/Projects/2bPM
node --input-type=module -e "
import { transformMarkdown } from './scripts/lib/transform.mjs';
const s = '# 标题\n:label:\`chap_x\`\n\n![图](img/a.png)\n![外链](https://x.com/b.png)\n';
console.log(transformMarkdown(s));
"
```

Expected: 输出中无 `:label:`；`![图](/img/a.png)`；外链 `https://x.com/b.png` 保持不变。

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/transform.mjs
git commit -m "feat: markdown 内容转换模块(去Sphinx语法/统一图片路径)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: 主迁移脚本

**Files:**
- Create: `scripts/migrate.mjs`
- Create: `site/.vitepress/nav.json`（生成产物）
- Create: `site/.vitepress/redirects.json`（生成产物）

**Interfaces:**
- Consumes: `resolveConflictMarkers`、`SLUG_MAP`、`parseTocFiles`、`transformMarkdown`。
- Produces: 把转换后的内容写入 `site/`（章节目录用 slug），生成 `nav.json` 与 `redirects.json`（旧路径 → 新路径）。

- [ ] **Step 1: 写主迁移脚本**

创建 `scripts/migrate.mjs`：

```js
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { join, basename } from 'node:path';
import { resolveConflictMarkers } from './lib/conflicts.mjs';
import { SLUG_MAP, parseTocFiles } from './lib/chapters.mjs';
import { transformMarkdown } from './lib/transform.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, 'site');
const CHAPTER_ORDER = [
  'chapter_introduction','chapter_idea','chapter_knowledge','chapter_experience',
  'chapter_project','chapter_interview','chapter_AI_job','chapter_data_dive',
  'chapter_AI_dive','chapter_AI_politics','chapter_AI_company','chapter_AIorPM_expert',
  'chapter_AI+Finance',
];
const ROOT_PAGES = ['index', 'get_started', 'AI_critical', 'TODO'];
const TITLE_MAP = {
  introduction:'入门', idea:'思维/软实力', knowledge:'全流程知识', experience:'前人经验',
  project:'项目实践', interview:'面试', 'ai-job':'AI工作', 'data-dive':'深入学习数据',
  'ai-dive':'深入学习AI', 'ai-politics':'AI政治', 'ai-company':'AI公司研究',
  'ai-pm-expert':'AI或产品专家', 'ai-finance':'AI金融', dive:'Dive', skill:'skill', more:'更多',
};

const redirects = {};
const sidebar = {};
let migrated = 0;

function h1Of(text) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

for (const dir of CHAPTER_ORDER) {
  const slug = SLUG_MAP[dir];
  const srcDir = join(ROOT, dir);
  const outDir = join(SITE, slug);
  mkdirSync(outDir, { recursive: true });
  const indexText = readFileSync(join(srcDir, 'index.md'), 'utf8');
  const items = [];
  for (const f of readdirSync(srcDir).filter((x) => x.endsWith('.md'))) {
    const raw = readFileSync(join(srcDir, f), 'utf8');
    const out = transformMarkdown(resolveConflictMarkers(raw));
    const name = f.replace(/\.md$/, '');
    writeFileSync(join(outDir, name + '.md'), out);
    migrated++;
    const title = h1Of(raw) || name;
    items.push({ text: title, link: `/${slug}/${name}` });
    redirects[`${dir}/${name}.html`] = `/${slug}/${name}`;
  }
  sidebar[`/${slug}/`] = [{ text: TITLE_MAP[slug] || slug, items }];
}

// 根部页面
for (const p of ROOT_PAGES) {
  const src = join(ROOT, p + '.md');
  if (!existsSync(src)) continue;
  const out = transformMarkdown(resolveConflictMarkers(readFileSync(src, 'utf8')));
  const name = p === 'index' ? 'home' : p;   // 避免与 VitePress 首页冲突
  writeFileSync(join(SITE, name + '.md'), out);
  migrated++;
  redirects[`${p}.html`] = `/${name}`;
}

// 图片统一进 site/public/img
mkdirSync(join(SITE, 'public'), { recursive: true });
cpSync(join(ROOT, 'img'), join(SITE, 'public', 'img'), { recursive: true });

// 顶层导航
const nav = [
  { text: '首页', link: '/' },
  { text: '本书首页', link: '/home' },
  ...CHAPTER_ORDER.map((d) => {
    const slug = SLUG_MAP[d];
    return { text: TITLE_MAP[slug] || slug, link: `/${slug}/index` };
  }),
];

mkdirSync(join(SITE, '.vitepress'), { recursive: true });
writeFileSync(join(SITE, '.vitepress', 'nav.json'), JSON.stringify({ nav, sidebar }, null, 2));
writeFileSync(join(SITE, '.vitepress', 'redirects.json'), JSON.stringify(redirects, null, 2));

console.log(`迁移完成：${migrated} 个 markdown，${Object.keys(redirects).length} 条旧链接跳转`);
```

- [ ] **Step 2: 运行迁移脚本**

```bash
cd /Users/ketchup/Projects/2bPM
node scripts/migrate.mjs
```

Expected: 打印"迁移完成：NNN 个 markdown，MMM 条旧链接跳转"，无报错。

- [ ] **Step 3: 抽查一个章节输出**

```bash
head -12 /Users/ketchup/Projects/2bPM/site/ai-finance/index.md
ls /Users/ketchup/Projects/2bPM/site/public/img | head -3
```

Expected: index.md 无 `:label:`、toc 块已替换为提示行；public/img 下有图片文件。

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate.mjs site/.vitepress/nav.json site/.vitepress/redirects.json
git commit -m "feat: 主迁移脚本(内容转换/导航生成/旧链接跳转映射)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: 校验脚本（完整性断言）

**Files:**
- Create: `scripts/verify.mjs`

**Interfaces:**
- Consumes: 迁移后的 `site/` 目录、原章节源目录。
- Produces: 退出码 0（通过）/ 1（失败），打印缺失/残留项。

- [ ] **Step 1: 写校验脚本**

创建 `scripts/verify.mjs`：

```js
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SLUG_MAP, parseTocFiles } from './lib/chapters.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, 'site');
const CHAPTER_ORDER = Object.keys(SLUG_MAP).filter((d) =>
  existsSync(join(ROOT, d, 'index.md')));
let fail = 0;

// 1. 每个章节 toc 列出的文件都有对应生成页
for (const dir of CHAPTER_ORDER) {
  const slug = SLUG_MAP[dir];
  const toc = parseTocFiles(readFileSync(join(ROOT, dir, 'index.md'), 'utf8'));
  for (const entry of toc) {
    const name = entry.replace(/\/index$/, '/index').replace(/\.md$/, '');
    const page = join(SITE, slug, name + '.md');
    if (!existsSync(page)) { console.error(`缺失: ${page}`); fail++; }
  }
}

// 2. 生成的内容无残留冲突标记 / Sphinx 语法
function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'public' && f.name !== '.vitepress') walk(p); continue; }
    if (!f.name.endsWith('.md')) continue;
    const t = readFileSync(p, 'utf8');
    if (/^(<<<<<<<|>>>>>>>)/m.test(t)) { console.error(`残留冲突标记: ${p}`); fail++; }
    if (/^:label:/m.test(t)) { console.error(`残留 :label: ${p}`); fail++; }
  }
}
walk(SITE);

// 3. 图片引用存在
const imgDir = join(SITE, 'public', 'img');
function checkImages(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'public' && f.name !== '.vitepress') checkImages(p); continue; }
    if (!f.name.endsWith('.md')) continue;
    const t = readFileSync(p, 'utf8');
    for (const m of t.matchAll(/!\[[^\]]*\]\(\/img\/([^)]+)\)/g)) {
      if (!existsSync(join(imgDir, m[1]))) { console.error(`图片缺失: ${m[1]} (in ${p})`); fail++; }
    }
  }
}
checkImages(SITE);

console.log(fail === 0 ? '✅ 校验通过：无缺失、无残留标记、图片齐全' : `❌ 发现 ${fail} 个问题`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行校验**

```bash
cd /Users/ketchup/Projects/2bPM
node scripts/verify.mjs
```

Expected: `✅ 校验通过`。若有缺失项，据输出补齐（多为游离页面未纳入导航，需在 migrate.mjs 的 CHAPTER_ORDER 或 ROOT_PAGES 补登）。

- [ ] **Step 3: Commit**

```bash
git add scripts/verify.mjs
git commit -m "feat: 迁移完整性校验脚本

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: 构建验证 + 旧链接跳转页

**Files:**
- Modify: `site/.vitepress/config.mts`（注入 redirects 生成逻辑）
- Create: `site/.vitepress/build-end.mjs`（构建后生成跳转 HTML）

**Interfaces:**
- Consumes: `redirects.json`（Task 5）。
- Produces: 构建后在 `docs/` 输出旧路径跳转 HTML（`<meta http-equiv="refresh">`）。

- [ ] **Step 1: 写构建后跳转生成器**

创建 `site/.vitepress/build-end.mjs`：

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// 由 vitepress buildEnd 钩子调用，outDir 为构建输出目录
export function generateRedirects(outDir) {
  const redirects = JSON.parse(
    readFileSync(new URL('./redirects.json', import.meta.url), 'utf8'));
  let n = 0;
  for (const [oldPath, newPath] of Object.entries(redirects)) {
    const file = join(outDir, oldPath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file,
      `<!DOCTYPE html><html><head><meta charset="utf-8">` +
      `<meta http-equiv="refresh" content="0; url=${newPath}">` +
      `<link rel="canonical" href="${newPath}"><title>页面已迁移</title></head>` +
      `<body><p>页面已迁移至 <a href="${newPath}">${newPath}</a></p></body></html>`);
    n++;
  }
  console.log(`生成 ${n} 个旧链接跳转页`);
}
```

- [ ] **Step 2: 在 config 中挂接 buildEnd 钩子**

修改 `site/.vitepress/config.mts`，在 `defineConfig({...})` 内追加：

```ts
  async buildEnd(siteConfig) {
    const { generateRedirects } = await import('./build-end.mjs')
    generateRedirects(siteConfig.outDir)
  },
```

- [ ] **Step 3: 配置构建输出到 docs/ 并构建**

修改 `site/.vitepress/config.mts`，在 `defineConfig({...})` 顶层加：

```ts
  outDir: '../docs',
```

运行：

```bash
cd /Users/ketchup/Projects/2bPM/site
node_modules/.bin/vitepress build
```

Expected: 构建成功无错误，打印"生成 MMM 个旧链接跳转页"。

- [ ] **Step 4: 验证跳转页与产物**

```bash
ls /Users/ketchup/Projects/2bPM/docs/ai-finance/ | head -3
cat /Users/ketchup/Projects/2bPM/docs/chapter_AI+Finance/FinTech.html | grep -o 'url=[^"]*'
```

Expected: `docs/ai-finance/` 下有页面；旧路径 HTML 含 `url=/ai-finance/FinTech`。

- [ ] **Step 5: Commit**

```bash
cd /Users/ketchup/Projects/2bPM
git add site/.vitepress/config.mts site/.vitepress/build-end.mjs
git commit -m "feat: 构建配置与旧链接跳转页生成

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: 浏览器全面验证

**Files:** 无（纯验证任务）

- [ ] **Step 1: 启动预览并实测浅色模式**

通过 preview 工具启动 `site` 的 `vitepress dev`，打开首页与 `idea/index`、`ai-finance/index`、`home`。

Expected: 链接为深绿可读（非黄色）、暖白底、左侧章节导航、右侧大纲正常。

- [ ] **Step 2: 切换深色模式**

点击右上角主题切换。

Expected: 深色底、链接浅绿、正文浅灰，均清晰可读。

- [ ] **Step 3: 测全文搜索**

搜索"产品经理"。

Expected: 出现跨章节即时结果，带高亮。

- [ ] **Step 4: 测图片 / 公式 / 脚注**

打开含图片页（如 `idea/brand`）、公式页（`idea/understand_tech`）、脚注页（`home`）。

Expected: 图片显示、公式渲染、脚注可点击。

- [ ] **Step 5: 测旧链接跳转**

访问 `http://127.0.0.1:PORT/chapter_AI+Finance/FinTech.html`（构建产物经静态服务）。

Expected: 自动跳转到 `/ai-finance/FinTech`。

---

## Task 9: GitHub Actions 自动部署

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 写部署工作流**

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy VitePress
on:
  push:
    branches: [master]
permissions:
  contents: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: 运行迁移
        run: node scripts/migrate.mjs && node scripts/verify.mjs
      - name: 安装并构建
        run: |
          cd site
          npm ci
          npx vitepress build
      - name: 部署到 GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
```

- [ ] **Step 2: 本地验证 workflow 引用的命令可跑通**

```bash
cd /Users/ketchup/Projects/2bPM
node scripts/migrate.mjs && node scripts/verify.mjs && (cd site && npx vitepress build)
```

Expected: 三步全部成功。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: VitePress 自动构建部署到 GitHub Pages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review 记录

- **Spec 覆盖**：冲突解决(T1)、站点骨架+折中风格(T2)、slug/导航(T3)、内容转换(T4)、主迁移(T5)、完整性校验(T6)、构建+跳转(T7)、浏览器验证(T8)、部署(T9) —— 覆盖设计文档全部 11 步。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码。
- **类型一致性**：`resolveConflictMarkers`/`parseTocFiles`/`SLUG_MAP`/`transformMarkdown`/`generateRedirects` 在各 Task 间命名一致。
- **游离章节处理**：`chapter_dive/skill/more` 在 SLUG_MAP 中保留，verify.mjs 只对存在 index.md 的章节做 toc 校验，游离页不会因缺失导航而报错；如需纳入导航，在 Task 5 的 CHAPTER_ORDER 补登（已在 T6 Step2 说明）。
