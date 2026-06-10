import { defineConfig } from '@playwright/test'

// 跑這個 test suite 前要先 `pnpm build`——helpers.ts 從 dist/eh-quick-tag.user.js
// 讀 production bundle 灌進頁面，跟使用者瀏覽器跑的是同一份字串
export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    // useI18n 看 navigator.languages 偵測 locale；headless Chromium 預設英文，
    // 強制 zh-TW 讓 test assert 中文 UI 字串穩定。要測其他 locale 行為的 spec
    // 自己用 test.use({ locale: 'ja' }) 蓋掉
    locale: 'zh-TW',
  },
})
