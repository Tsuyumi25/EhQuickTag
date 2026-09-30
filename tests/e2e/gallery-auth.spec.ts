import { test, expect } from '@playwright/test'
import { injectGalleryUserscript, reinjectUserscript } from './helpers'

for (const apiuid of [-1, 1]) {
  test(`gallery 個人配色載入依登入狀態處理（apiuid=${apiuid}）`, async ({ page }) => {
    await page.addInitScript((uid) => {
      Object.assign(window, { apiuid: uid })
      const originalFetch = window.fetch.bind(window)
      window.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href)
        if (url.pathname === '/mytags') {
          document.documentElement.dataset.myTagsRequested = 'true'
          return Promise.resolve(new Response('My Tags unavailable', { status: 503 }))
        }
        return originalFetch(input, init)
      }
    }, apiuid)

    await injectGalleryUserscript(page)
    for (let visit = 0; visit < 2; visit++) {
      if (visit) {
        await page.goto('https://e-hentai.org/g/1001/aaaaaaaaaa/')
        await reinjectUserscript(page)
      }
      await expect(page.locator('.eqt-gallery-taglist')).toBeVisible()
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      const failure = page.getByRole('alert')
      if (apiuid === -1) {
        expect(await page.locator('html').getAttribute('data-my-tags-requested')).toBeNull()
        await expect(failure).toHaveCount(0)
      } else {
        await expect(failure).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-my-tags-requested', 'true')
      }
    }
  })
}
