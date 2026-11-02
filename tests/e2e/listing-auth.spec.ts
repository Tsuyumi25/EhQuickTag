import { test, expect } from '@playwright/test'
import { injectUserscript } from './helpers'

// 列表頁不論登入與否都沒有 apiuid，只能從 /mytags 的回應分辨：
// 未登入時 EH 以 302 把 /mytags 導去 /bounce_login.php。
for (const outcome of ['signed-out', 'unavailable'] as const) {
  test(`列表頁個人配色載入依 /mytags 回應處理（${outcome}）`, async ({ page }) => {
    await page.addInitScript((mode) => {
      // 列表強化只在 EhViewRefined 在場時掛上；init script 跑的時候 <html> 還沒被 parser 建出來
      document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-evr-version', 'test'))
      const originalFetch = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href)
        if (url.pathname !== '/mytags') return originalFetch(input, init)
        document.documentElement.dataset.myTagsRequested = 'true'
        if (mode === 'unavailable') return Promise.resolve(new Response('My Tags unavailable', { status: 503 }))
        // 合成的 Response 無法真的轉址，只好補上 fetch 跟完 302 後的最終網址
        const bounced = new Response('<title>E-Hentai.org Login</title>', { status: 200 })
        Object.defineProperty(bounced, 'url', { value: `${location.origin}/bounce_login.php?b=d&bt=1-14` })
        return Promise.resolve(bounced)
      }
    }, outcome)

    await injectUserscript(page)
    await expect(page.locator('html')).toHaveAttribute('data-my-tags-requested', 'true')
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    // GM shim 沒有 GM_addValueChangeListener，規則讀取也會報錯；與這裡無關，只看 My Tags 那則
    const failure = page.getByRole('alert').filter({ hasText: 'My Tags' })
    if (outcome === 'signed-out') await expect(failure).toHaveCount(0)
    else await expect(failure).toBeVisible()
  })
}
