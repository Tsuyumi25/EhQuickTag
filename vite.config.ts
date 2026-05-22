import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monkey from 'vite-plugin-monkey'

export default defineConfig(({ command }) => ({
  define: {
    // dev mode 暴露 Vue DevTools hook 讓 browser extension 能 attach；
    // production build 關掉避免 production user 多載幾 KB hook code。
    __VUE_PROD_DEVTOOLS__: command === 'serve' ? 'true' : 'false',
  },
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        namespace: 'https://github.com/Tsuyumi25/EhQuickTag',
        match: [
          'https://exhentai.org/*',
          'https://e-hentai.org/*',
        ],
        name: {
          '': 'EH Quick Tag',
          'zh-TW': 'EH 快捷標籤',
          'zh-CN': 'EH 快捷标签',
        },
        description: {
          '': 'Quick tag bar for E-Hentai / ExHentai search',
          'zh-TW': 'E-Hentai / ExHentai 搜尋快捷標籤列',
          'zh-CN': 'E-Hentai / ExHentai 搜索快捷标签栏',
        },
        author: 'tsuyumi',
        license: 'MIT',
        icon: 'https://e-hentai.org/favicon.ico',
        homepageURL: 'https://github.com/Tsuyumi25/EhQuickTag',
        supportURL: 'https://github.com/Tsuyumi25/EhQuickTag/issues',
        'run-at': 'document-end',
        connect: [
          'raw.githubusercontent.com',
          'cdn.jsdelivr.net',
          'fastly.jsdelivr.net',
          'gcore.jsdelivr.net',
        ],
      },
      build: {
        metaFileName: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'vuedraggable': 'vuedraggable/src/vuedraggable.js',
    },
  },
}))
