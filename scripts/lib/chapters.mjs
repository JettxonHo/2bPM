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
