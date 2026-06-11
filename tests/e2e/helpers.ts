import { Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_HTML = readFileSync(resolve(__dirname, '../fixtures/eh-list.html'), 'utf-8')
const FIXTURE_CSS = readFileSync(resolve(__dirname, '../fixtures/eh-g.css'), 'utf-8')
const FIXTURE_TAGDB = readFileSync(resolve(__dirname, '../fixtures/eh-tag-db.json'), 'utf-8')
const USERSCRIPT_PATH = resolve(__dirname, '../../dist/eh-quick-tag.user.js')

// 單一 catch-all 路由：白名單放行 fixture（HTML + g.css + tagDb），其餘全 abort。
// 比起多條 page.route 疊起來（順序 + 副作用都不明顯），用 if/else 集中判斷意圖
// 直接寫在 source 上、不會漏掉某種副檔名（webp / avif / 外部廣告 JS）
//
// CSS 用 regex 接 /z/\d+/g.css：EH 把版本號從 0381 升到 0382 也通吃；
// tagDb 接 jsdelivr / fastly / gcore / github raw 任一鏡像——loadTagDb 走完真實
// fetch → buildIndex → cacheSet 路徑（不再靠 preseed cache 繞過）
const CSS_URL_RE = /^https:\/\/e-hentai\.org\/z\/\d+\/g\.css$/
const TAGDB_URL_RE = /^https:\/\/(cdn|fastly|gcore)\.jsdelivr\.net\/.*\/db\.html\.json$|^https:\/\/raw\.githubusercontent\.com\/.*\/db\.html\.json$/

export async function mockEh(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url === 'https://e-hentai.org/') {
      route.fulfill({ contentType: 'text/html', body: FIXTURE_HTML })
    } else if (CSS_URL_RE.test(url)) {
      route.fulfill({ contentType: 'text/css', body: FIXTURE_CSS })
    } else if (TAGDB_URL_RE.test(url)) {
      route.fulfill({ contentType: 'application/json', body: FIXTURE_TAGDB })
    } else {
      route.abort()
    }
  })
}

// Tampermonkey runtime API shim。GM_xmlhttpRequest 把錯誤詳細包進回呼（含 err
// object）而不是吞掉——tagDb onerror 才能傳出真實 root cause 到 CI log
function gmShimCode(): string {
  return `
    window.GM_addStyle = (css) => {
      const s = document.createElement('style')
      s.textContent = css
      document.head.appendChild(s)
    }
    window.GM_openInTab = (url) => window.open(url, '_blank')
    window.GM_xmlhttpRequest = ({ url, onload, onerror }) => {
      fetch(url)
        .then((r) => r.text().then((text) => onload?.({ responseText: text, status: r.status })))
        .catch((e) => onerror?.({ error: String(e), readyState: 4, status: 0 }))
    }
    window.GM = {
      getValue: async (key, def) => {
        const v = localStorage.getItem('eqt-test:' + key)
        return v === null ? def : JSON.parse(v)
      },
      setValue: async (key, value) => {
        localStorage.setItem('eqt-test:' + key, JSON.stringify(value))
      },
      deleteValue: async (key) => {
        localStorage.removeItem('eqt-test:' + key)
      },
      listValues: async () => {
        return Object.keys(localStorage)
          .filter((k) => k.startsWith('eqt-test:'))
          .map((k) => k.slice('eqt-test:'.length))
      },
    }
  `
}

// 一鍵把整套（GM shim + EH mock + userscript）灌進 page。addInitScript 必須在 goto
// 之前掛——shim 才會出現在 userscript 之前。順序：shim → route → goto → (optional 預設
// #f_search.value) → 注入 script
//
// initialSearch 模擬「直接訪問帶 f_search 的搜尋結果頁」——EH server-side render 後
// #f_search.value 就是 query 內容。fixture 路徑不變（pathname 仍是 /），改的是 input
// value，userscript 注入後 App.vue onMounted 讀到的 searchInput.value 就是目標 term
//
// userscript 走 path 不走 content：750KB string 透過 CDP serialize 進 Chromium
// 每個 test 都要做，用 path 讓 Playwright 直接由檔案 serve、Chrome 可 cache script resource
export async function injectUserscript(page: Page, initialSearch?: string): Promise<void> {
  await page.addInitScript(gmShimCode())
  await mockEh(page)
  await page.goto('https://e-hentai.org/')
  if (initialSearch !== undefined) {
    await page.evaluate((q) => {
      const inp = document.querySelector<HTMLInputElement>('#f_search')
      if (inp) inp.value = q
    }, initialSearch)
  }
  await page.addScriptTag({ path: USERSCRIPT_PATH })
}

// reload 後的重新注入：addInitScript / route 已掛在 context、跨 navigation 持續，
// 只需要再灌一次 userscript bundle。reload 測試（如 history 持久化）用這個避免重複
// 設定 route 觸發 'route already registered' warning
export async function reinjectUserscript(page: Page): Promise<void> {
  await page.addScriptTag({ path: USERSCRIPT_PATH })
}
