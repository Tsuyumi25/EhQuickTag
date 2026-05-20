import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monkey from 'vite-plugin-monkey'

export default defineConfig({
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
})
