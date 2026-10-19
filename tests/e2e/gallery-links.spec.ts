import { test, expect } from '@playwright/test'
import { injectGalleryUserscript } from './helpers'

test('搜尋是帶著選取詞的連結，中鍵在背景開新分頁後才清掉選取', async ({ page }) => {
  await injectGalleryUserscript(page)
  const chips = page.locator('.eqt-gallery-chip')
  await expect(chips.first()).toBeVisible()
  const search = page.locator('.eqt-gallery-actions__btn--search')
  await expect(search).toBeDisabled()

  await chips.nth(0).locator('.eqt-gallery-chip__body').click()
  await expect(search).toHaveAttribute('href', /\/\?f_search=./)
  const href = (await search.getAttribute('href'))!

  await page.context().route(/\/\?f_search=/, (route) => route.fulfill({ contentType: 'text/html', body: '' }))
  const opening = page.context().waitForEvent('page')
  await search.click({ button: 'middle' })
  const opened = await opening
  await opened.waitForURL(href)
  await expect(page.locator('.eqt-gallery-actions__btn--vote .eqt-gallery-actions__count')).toHaveText(['0', '0'])
  await expect(search).toBeDisabled()
})
