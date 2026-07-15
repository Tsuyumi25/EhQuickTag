import { Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { gzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_HTML = readFileSync(resolve(__dirname, '../fixtures/eh-list.html'), 'utf-8')
const FIXTURE_GALLERY_HTML = readFileSync(resolve(__dirname, '../fixtures/eh-g.html'), 'utf-8')
const FIXTURE_CSS = readFileSync(resolve(__dirname, '../fixtures/eh-g.css'), 'utf-8')
const FIXTURE_TAGDB = readFileSync(resolve(__dirname, '../fixtures/eh-tag-db.json'), 'utf-8')
const FIXTURE_TAG_WIKI_GZ = gzipSync(JSON.stringify({ version: 3, entries: {} }))
const FIXTURE_TAG_COUNT_GZ = gzipSync('tag_name,len\n')
const USERSCRIPT_PATH = resolve(__dirname, '../../dist/eh-quick-tag.user.js')

// gallery 詳情頁 fixture 的真實 URL（真實抓取，pathname 需對得上 route 白名單）
const GALLERY_URL = 'https://e-hentai.org/g/757/483b65e703/'

// 單一 catch-all 路由：白名單回傳 fixture（HTML、g.css 與三種資料資產）；
// 未知 document 維持 abort，EH 自身的廣告／圖片等非測試子資源則回空 204。
// 比起多條 page.route 疊起來（順序 + 副作用都不明顯），用 if/else 集中判斷意圖
// 直接寫在 source 上、不會漏掉某種副檔名（webp / avif / 外部廣告 JS）
//
// CSS 用 regex 接 /z/\d+/g.css：EH 把版本號從 0381 升到 0382 也通吃；
// tagDb 接 jsdelivr / fastly / gcore / github raw 任一鏡像——loadTagDb 走完真實
// fetch → buildIndex → cacheSet 路徑；tagWiki / tagCount 則回最小合法 gzip，
// 讓 App setup 的背景載入正常 settle，不在 page console 製造假警報。
const CSS_URL_RE = /^https:\/\/e-hentai\.org\/z\/\d+\/g\.css$/
const TAGDB_URL_RE = /^https:\/\/(cdn|fastly|gcore)\.jsdelivr\.net\/.*\/db\.html\.json$|^https:\/\/raw\.githubusercontent\.com\/.*\/db\.html\.json$/
const TAG_WIKI_URL_RE = /\/tag-wiki\/wiki\.json\.gz$/
const TAG_COUNT_URL_RE = /\/tag-count\/tagname_count\.csv\.gz$/
const EHG_INDEX_URL_RE = /^https:\/\/e-hentai\.org\/z\/\d+\/ehg_index\.c\.js$/

export async function mockEh(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url === 'https://e-hentai.org/') {
      route.fulfill({ contentType: 'text/html', body: FIXTURE_HTML })
    } else if (url === GALLERY_URL) {
      route.fulfill({ contentType: 'text/html', body: FIXTURE_GALLERY_HTML })
    } else if (CSS_URL_RE.test(url)) {
      route.fulfill({ contentType: 'text/css', body: FIXTURE_CSS })
    } else if (TAGDB_URL_RE.test(url)) {
      route.fulfill({ contentType: 'application/json', body: FIXTURE_TAGDB })
    } else if (TAG_WIKI_URL_RE.test(url)) {
      route.fulfill({ contentType: 'application/gzip', body: FIXTURE_TAG_WIKI_GZ })
    } else if (TAG_COUNT_URL_RE.test(url)) {
      route.fulfill({ contentType: 'application/gzip', body: FIXTURE_TAG_COUNT_GZ })
    } else if (EHG_INDEX_URL_RE.test(url)) {
      route.fulfill({ contentType: 'application/javascript', body: 'function build_rangebar() {}' })
    } else if (route.request().resourceType() !== 'document') {
      // fixture 不測 EH 自身的廣告、圖片或其他外部腳本；用空回應避免 abort
      // 在 page console 製造 ERR_FAILED，未知 navigation 仍維持 abort 以免藏掉錯誤。
      route.fulfill({ status: 204, body: '' })
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

// goto 之前的共用前置：GM shim + EH mock route。addInitScript 必須在 goto 之前掛，
// shim 才會出現在 userscript 之前。list / gallery 兩個入口共用這一步，改 shim 或
// route 註冊只需動這裡一處。
async function setupEhPage(page: Page): Promise<void> {
  await page.addInitScript(gmShimCode())
  await mockEh(page)
}

// userscript 走 path 不走 content：750KB string 透過 CDP serialize 進 Chromium
// 每個 test 都要做，用 path 讓 Playwright 直接由檔案 serve、Chrome 可 cache script resource
//
// initialSearch 模擬「直接訪問帶 f_search 的搜尋結果頁」——EH server-side render 後
// #f_search.value 就是 query 內容。fixture 路徑不變（pathname 仍是 /），改的是 input
// value，userscript 注入後 App.vue onMounted 讀到的 searchInput.value 就是目標 term
export async function injectUserscript(page: Page, initialSearch?: string): Promise<void> {
  await setupEhPage(page)
  await page.goto('https://e-hentai.org/')
  if (initialSearch !== undefined) {
    await page.evaluate((q) => {
      const inp = document.querySelector<HTMLInputElement>('#f_search')
      if (inp) inp.value = q
    }, initialSearch)
  }
  await page.addScriptTag({ path: USERSCRIPT_PATH })
}

// gallery 詳情頁版本：goto 到 gallery fixture 再注入 userscript。
// externalCss 模擬「別的腳本已注入的 style」在 EhQuickTag 之前就位——用來重現
// 外部腳本對 #gd5 / #gmid 的版面擾動（如 exhentai-enhancer 的 `div#gd5{...}`）。
export async function injectGalleryUserscript(
  page: Page,
  opts: { externalCss?: string } = {},
): Promise<void> {
  await setupEhPage(page)
  await page.goto(GALLERY_URL)
  if (opts.externalCss) await page.addStyleTag({ content: opts.externalCss })
  await page.addScriptTag({ path: USERSCRIPT_PATH })
}

// reload 後的重新注入：addInitScript / route 已掛在 context、跨 navigation 持續，
// 只需要再灌一次 userscript bundle。reload 測試（如 history 持久化）用這個避免重複
// 設定 route 觸發 'route already registered' warning
export async function reinjectUserscript(page: Page): Promise<void> {
  await page.addScriptTag({ path: USERSCRIPT_PATH })
}
