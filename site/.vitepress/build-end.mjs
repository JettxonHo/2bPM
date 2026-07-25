import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// 由 vitepress buildEnd 钩子调用，outDir 为构建输出目录
export function generateRedirects(outDir) {
  const redirects = JSON.parse(
    readFileSync(new URL('./redirects.json', import.meta.url), 'utf8'));
  let n = 0, skipped = 0;
  for (const [oldPath, newPath] of Object.entries(redirects)) {
    const file = join(outDir, oldPath);
    // 若该路径已被 VitePress 作为真实页面生成（如根 index.html 首页），不覆盖
    if (existsSync(file)) { skipped++; continue; }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file,
      `<!DOCTYPE html><html><head><meta charset="utf-8">` +
      `<meta http-equiv="refresh" content="0; url=${newPath}">` +
      `<link rel="canonical" href="${newPath}"><title>页面已迁移</title></head>` +
      `<body><p>页面已迁移至 <a href="${newPath}">${newPath}</a></p></body></html>`);
    n++;
  }
  console.log(`生成 ${n} 个旧链接跳转页（跳过 ${skipped} 个已存在的真实页面）`);
}
