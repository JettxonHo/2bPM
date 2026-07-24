import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SLUG_MAP, parseTocFiles } from './lib/chapters.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = join(ROOT, 'site');
const CHAPTER_ORDER = Object.keys(SLUG_MAP).filter((d) =>
  existsSync(join(ROOT, d, 'index.md')));
let fail = 0;

// 1. 磁盘上每个章节的每个 md 都有对应生成页（不丢内容）。
//    以磁盘文件为准（toc 里可能列了磁盘不存在的名字，那是源 toc 的笔误，不算缺失）。
for (const dir of CHAPTER_ORDER) {
  const slug = SLUG_MAP[dir];
  const srcDir = join(ROOT, dir);
  for (const f of readdirSync(srcDir).filter((x) => x.endsWith('.md'))) {
    const name = f.replace(/\.md$/, '');
    const page = join(SITE, slug, name + '.md');
    if (!existsSync(page)) { console.error(`缺失: ${page}`); fail++; }
  }
}

// 2. 生成的内容无残留冲突标记 / Sphinx 语法
function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'public' && f.name !== '.vitepress' && f.name !== 'node_modules') walk(p); continue; }
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
    if (f.isDirectory()) { if (f.name !== 'public' && f.name !== '.vitepress' && f.name !== 'node_modules') checkImages(p); continue; }
    if (!f.name.endsWith('.md')) continue;
    const t = readFileSync(p, 'utf8');
    for (const m of t.matchAll(/!\[(?:[^\][]|\[[^\]]*\])*\]\(\/img\/([^)]+)\)/g)) {
      if (!existsSync(join(imgDir, m[1]))) { console.error(`图片缺失: ${m[1]} (in ${p})`); fail++; }
    }
  }
}
checkImages(SITE);

console.log(fail === 0 ? '✅ 校验通过：无缺失、无残留标记、图片齐全' : `❌ 发现 ${fail} 个问题`);
process.exit(fail === 0 ? 0 : 1);
