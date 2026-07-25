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
  base: '/2bPM/',          // 部署在子路径 https://jettxonho.github.io/2bPM/，资源需带此前缀
  cleanUrls: true,
  outDir: '../docs',
  srcExclude: ['**/README.md'],
  markdown: { math: true, lineNumbers: false },
  async buildEnd(siteConfig) {
    const { generateRedirects } = await import('./build-end.mjs')
    generateRedirects(siteConfig.outDir)
  },
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
