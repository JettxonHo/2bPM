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
