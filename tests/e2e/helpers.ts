import { Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE_HTML = readFileSync(resolve(__dirname, '../fixtures/eh-list.html'), 'utf-8')
const FIXTURE_CSS = readFileSync(resolve(__dirname, '../fixtures/eh-g.css'), 'utf-8')
const USERSCRIPT = readFileSync(resolve(__dirname, '../../dist/eh-quick-tag.user.js'), 'utf-8')

// 單一 catch-all 路由：白名單只放行 fixture（HTML + g.css），其餘全部 abort。
// 比起多條 page.route 疊起來（順序 + 副作用都不明顯），用 if/else 集中判斷意圖
// 直接寫在 source 上、不會漏掉某種副檔名（webp / avif / 外部廣告 JS）
//
// CSS 用 regex 接 /z/\d+/g.css 路徑：EH 把版本號從 0381 升到 0382 也通吃，fixture
// 不需要對齊真實版本（只是 placeholder 給 userscript 用）
const CSS_URL_RE = /^https:\/\/e-hentai\.org\/z\/\d+\/g\.css$/

export async function mockEh(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url === 'https://e-hentai.org/') {
      route.fulfill({ contentType: 'text/html', body: FIXTURE_HTML })
    } else if (CSS_URL_RE.test(url)) {
      route.fulfill({ contentType: 'text/css', body: FIXTURE_CSS })
    } else {
      route.abort()
    }
  })
}

// Tampermonkey runtime API shim：把 userscript 預期的 GM_* / GM.* 接到 localStorage
// 跟 window.open。真實 Tampermonkey 還有 cross-origin XHR、sandbox 隔離等保證，但
// e2e 跑 same-origin、不需要那些。GM_xmlhttpRequest 走 fetch 在 same-origin 下夠用。
// storage key 加 'eqt-test:' prefix 隔離測試殘留，testIsolation 預設 page 之間不共享
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
        .catch((e) => onerror?.(e))
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

    // 預塞 tagDb 空 cache + fresh timestamp：loadTagDb 看 TTL 內就用 cache、
    // 不發 jsdelivr fetch（會被 mockEh 的 catch-all abort 擋）。空 [] 不影響
    // SearchPanel chip 顯示（chip 走 raw token literal），讓 TagConfigPopup /
    // AddTagPopup 的 dbReady 立刻 true、tag input 不再 disabled
    if (!localStorage.getItem('eqt-test:eqt_tag_db')) {
      localStorage.setItem('eqt-test:eqt_tag_db', JSON.stringify('[]'))
      localStorage.setItem('eqt-test:eqt_tag_db_ts', JSON.stringify(String(Date.now())))
    }
  `
}

// 一鍵把整套（GM shim + EH mock + userscript）灌進 page。addInitScript 必須在 goto
// 之前掛——shim 才會出現在 userscript 之前。順序：shim → route → goto → 注入 script
export async function injectUserscript(page: Page): Promise<void> {
  await page.addInitScript(gmShimCode())
  await mockEh(page)
  await page.goto('https://e-hentai.org/')
  await page.addScriptTag({ content: USERSCRIPT })
}

// reload 後的重新注入：addInitScript / route 已經掛在 context、跨 navigation 持續，
// 只需要再灌一次 userscript bundle。reload 測試（如 history 持久化）用這個避免重複
// 設定 route 觸發 'route already registered' warning
export async function reinjectUserscript(page: Page): Promise<void> {
  await page.addScriptTag({ content: USERSCRIPT })
}
