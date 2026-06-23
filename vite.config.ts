import { fileURLToPath, URL } from 'url'

import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import monkey from 'vite-plugin-monkey'
import pkg from './package.json'

export default defineConfig(({ command }) => ({
  define: {
    // dev mode 暴露 Vue DevTools hook 讓 browser extension 能 attach；
    // production build 關掉避免 production user 多載幾 KB hook code。
    __VUE_PROD_DEVTOOLS__: command === 'serve' ? 'true' : 'false',
    // 編譯時把 package.json version 注入 client code；release 改版號後 about 區
    // 自動同步。userscript header 的 @version 由 vite-plugin-monkey 自己讀 pkg，
    // 這邊只負責 UI 顯示。
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'hex-alpha-color-picker',
        },
      },
    }),
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
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
}))
