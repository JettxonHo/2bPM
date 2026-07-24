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
