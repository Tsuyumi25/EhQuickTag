import { test, expect } from '@playwright/test'
import { injectGalleryUserscript, injectMyTagsUserscript, reinjectUserscript } from './helpers'

test('圖庫選中的標籤存成以 gid 為 key 的一筆，並以 gid 打開 My Tags', async ({ page }) => {
  await injectGalleryUserscript(page)
  const chips = page.locator('.eqt-gallery-chip')
  await expect(chips.first()).toBeVisible()
  const wanted = [
    await chips.nth(0).getAttribute('data-ns-raw'),
    await chips.nth(1).getAttribute('data-ns-raw'),
  ]
  await chips.nth(0).locator('.eqt-gallery-chip__body').click()
  await chips.nth(1).locator('.eqt-gallery-chip__body').click()

  // 新分頁不在 page 的 mock 範圍裡，攔在 context 上免得它真的連到 EH
  await page.context().route(/\/mytags\?eqt_gid=/, (route) => route.fulfill({ contentType: 'text/html', body: '' }))
  const popup = page.waitForEvent('popup')
  await page.locator('.eqt-gallery-actions__btn--mytags').click()
  const opened = await popup
  await opened.waitForLoadState()
  expect(opened.url()).toBe('https://e-hentai.org/mytags?eqt_gid=757')

  const saved = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('eqt-test:eqt_mytags_pick:757') ?? 'null')
    return JSON.parse(raw).tags
  })
  expect(saved).toEqual(wanted)
})

test('帶 eqt_gid 開 My Tags 時「選中」篩選預設打開，既有與新標籤都能從候選進編輯區', async ({ page }) => {
  await injectMyTagsUserscript(page)
  const pick = JSON.stringify({ schema: 1, tags: ['male:positive-sample', 'other:unlisted pick'], savedAt: 1 })
  await page.addInitScript((value) => {
    localStorage.setItem('eqt-test:eqt_mytags_pick:757', JSON.stringify(value))
  }, pick)
  await page.goto('https://e-hentai.org/mytags?eqt_gid=757')
  await reinjectUserscript(page)

  const picked = page.locator('.eqt-tag-catalog .eqt-namespace-filter__button').first()
  await expect(picked).toHaveText('選中 2')
  await expect(picked).toHaveClass(/--active/)
  const results = page.locator('.eqt-tag-catalog__results .eqt-popup__suggestion')
  await expect(results).toHaveCount(2)

  const create = page.locator('.eqt-tag-catalog__create')
  await results.filter({ hasText: 'unlisted pick' }).click()
  await expect(page.locator('.eqt-tag-catalog__name')).toHaveValue('other:unlisted pick')
  await expect(create).toHaveText('新增標籤')

  await results.nth(0).click()
  await expect(page.locator('.eqt-tag-catalog__name')).toHaveValue('male:positive-sample')
  await expect(create).toHaveText('移動標籤')

  await page.locator('.eqt-tag-catalog .eqt-namespace-filter__button').nth(1).click()
  await expect(picked).not.toHaveClass(/--active/)
})
