import { fileURLToPath, URL } from 'url'
import { readFileSync } from 'node:fs'

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
      generate: ({ userscript, mode }) => {
        if (mode !== 'build') return userscript
        const license = readFileSync(new URL('./node_modules/dompurify/LICENSE', import.meta.url), 'utf8')
        return `${userscript}\n\n/*!\nDOMPurify ${pkg.dependencies.dompurify}\nCopyright Cure53 and other contributors\n${license}\n*/`
      },
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
          'ja': 'EH クイックタグ',
          'ko': 'EH 퀵 태그',
        },
        description: {
          '': 'E-Hentai / ExHentai quick tag search (custom profiles, multilingual search), visual search filters & search history, gallery tag colors & batch voting, visual My Tags management (batch editing, filter previews)',
          'zh-TW': 'E-Hentai / ExHentai 快捷標籤搜尋（自訂配置、多語搜尋）、視覺化搜尋條件 & 搜尋歷史、圖庫標籤顯示顏色 & 批次投票、My Tags 視覺管理（批次編輯、過濾效果預覽）',
          'zh-CN': 'E-Hentai / ExHentai 快捷标签搜索（自定义配置、多语言搜索）、可视化搜索条件 & 搜索历史、图库标签显示颜色 & 批量投票、My Tags 可视化管理（批量编辑、过滤效果预览）',
          'ja': 'E-Hentai / ExHentai クイックタグ検索（カスタム設定、多言語検索）、検索条件の可視化 & 検索履歴、ギャラリータグの色表示 & 一括投票、My Tags ビジュアル管理（一括編集、フィルタリング結果のプレビュー）',
          'ko': 'E-Hentai / ExHentai 빠른 태그 검색(사용자 지정 설정, 다국어 검색), 검색 조건 시각화 & 검색 기록, 갤러리 태그 색상 표시 & 일괄 투표, My Tags 시각적 관리(일괄 편집, 필터링 결과 미리보기)',
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
