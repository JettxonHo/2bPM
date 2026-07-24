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
