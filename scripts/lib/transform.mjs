// 单个 markdown 内容转换：清理 Sphinx 专有语法，统一图片路径。
// 输入原始 md 文本，输出 VitePress 可渲染文本。

// 把含 + 等 URL 不安全字符的图片文件名映射为安全名（+ → -）
// 与 migrate.mjs 复制图片时使用的重命名保持一致。
export function safeImageName(filename) {
  return filename.replace(/\+/g, '-');
}

export function transformMarkdown(text) {
  let out = text;
  // 1. 去掉 :label:`xxx` 整行
  out = out.replace(/^\s*:label:`[^`]*`\s*$/gm, '');
  // 2. 把 ```toc ... ``` 块替换为提示（导航由 sidebar 承担）
  out = out.replace(/```toc[\s\S]*?```/g, '> （本节目录见左侧导航）\n');
  // 3. 去掉残留的 toc 指令行
  out = out.replace(/^\s*:(maxdepth|numbered):.*$/gm, '');
  // 4. 图片路径统一为 /img/<安全文件名>。
  //    覆盖 /img/、./img/、img/、../img/ 等写法；不动 http(s) 外链。
  //    alt 文本允许含嵌套方括号（如脚注 [^1]）。
  out = out.replace(/!\[((?:[^\][]|\[[^\]]*\])*)\]\(([^)\s]+)\)/g, (whole, alt, src) => {
    if (/^https?:/i.test(src)) return whole;            // 外链保留
    const m = src.match(/([^/]+\.(?:png|jpg|jpeg|gif|svg|webp))$/i);
    if (!m) return whole;                               // 非图片扩展名保留
    return `![${alt}](/img/${safeImageName(m[1])})`;
  });
  return out;
}
