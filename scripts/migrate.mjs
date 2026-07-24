import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { resolveConflictMarkers } from './lib/conflicts.mjs';
import { SLUG_MAP, parseTocFiles } from './lib/chapters.mjs';
import { transformMarkdown, safeImageName } from './lib/transform.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, 'site');
// 主章节顺序（与根 index.md 的 toc 一致），其后追加游离但有 index 的章节
const MAIN_ORDER = [
  'chapter_introduction','chapter_idea','chapter_knowledge','chapter_experience',
  'chapter_project','chapter_interview','chapter_AI_job','chapter_data_dive',
  'chapter_AI_dive','chapter_AI_politics','chapter_AI_company','chapter_AIorPM_expert',
  'chapter_AI+Finance',
];
// 凡存在 index.md 的章节目录都要迁移；主章节按 MAIN_ORDER，其余（dive/skill/more）附后
const CHAPTER_ORDER = [
  ...MAIN_ORDER,
  ...Object.keys(SLUG_MAP).filter((d) => !MAIN_ORDER.includes(d) && existsSync(join(ROOT, d, 'index.md'))),
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

// 图片存在性判断：源 img/ 目录里的安全文件名集合
const IMG_SET = new Set(readdirSync(join(ROOT, 'img')).map(safeImageName));
const imageExists = (name) => IMG_SET.has(name);

for (const dir of CHAPTER_ORDER) {
  const slug = SLUG_MAP[dir];
  const srcDir = join(ROOT, dir);
  const outDir = join(SITE, slug);
  mkdirSync(outDir, { recursive: true });
  const items = [];
  for (const f of readdirSync(srcDir).filter((x) => x.endsWith('.md'))) {
    const raw = readFileSync(join(srcDir, f), 'utf8');
    const out = transformMarkdown(resolveConflictMarkers(raw), imageExists);
    const name = f.replace(/\.md$/, '');
    writeFileSync(join(outDir, name + '.md'), out);
    migrated++;
    const title = h1Of(raw) || name;
    items.push({ text: title, link: `/${slug}/${name}` });
    redirects[`${dir}/${name}.html`] = `/${slug}/${name}`;
  }
  sidebar[`/${slug}/`] = [{ text: TITLE_MAP[slug] || slug, items }];
}

// 游离页：无 index.md 的章节目录（如 chapter_more），其下 md 也要迁移并纳入导航
const ORPHAN_DIRS = Object.keys(SLUG_MAP).filter((d) =>
  !CHAPTER_ORDER.includes(d) && existsSync(join(ROOT, d)) &&
  readdirSync(join(ROOT, d)).some((x) => x.endsWith('.md')));
for (const dir of ORPHAN_DIRS) {
  const slug = SLUG_MAP[dir];
  const srcDir = join(ROOT, dir);
  const outDir = join(SITE, slug);
  mkdirSync(outDir, { recursive: true });
  const items = [];
  for (const f of readdirSync(srcDir).filter((x) => x.endsWith('.md'))) {
    const raw = readFileSync(join(srcDir, f), 'utf8');
    const out = transformMarkdown(resolveConflictMarkers(raw), imageExists);
    const name = f.replace(/\.md$/, '');
    writeFileSync(join(outDir, name + '.md'), out);
    migrated++;
    items.push({ text: h1Of(raw) || name, link: `/${slug}/${name}` });
    redirects[`${dir}/${name}.html`] = `/${slug}/${name}`;
  }
  sidebar[`/${slug}/`] = [{ text: TITLE_MAP[slug] || slug, items }];
}

// 根部页面
for (const p of ROOT_PAGES) {
  const src = join(ROOT, p + '.md');
  if (!existsSync(src)) continue;
  const out = transformMarkdown(resolveConflictMarkers(readFileSync(src, "utf8")), imageExists);
  const name = p === 'index' ? 'home' : p;   // 避免与 VitePress 首页冲突
  writeFileSync(join(SITE, name + '.md'), out);
  migrated++;
  redirects[`${p}.html`] = `/${name}`;
}

// 图片统一进 site/public/img（含 + 等字符的文件名同步重命名为 URL 安全名）
const imgSrc = join(ROOT, 'img');
const imgOut = join(SITE, 'public', 'img');
rmSync(imgOut, { recursive: true, force: true });   // 清空旧产物，避免新旧文件混杂
mkdirSync(imgOut, { recursive: true });
for (const f of readdirSync(imgSrc)) {
  copyFileSync(join(imgSrc, f), join(imgOut, safeImageName(f)));
}

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
