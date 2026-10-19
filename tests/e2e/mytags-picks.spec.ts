import { test, expect } from '@playwright/test'
import { injectGalleryUserscript, injectMyTagsUserscript, reinjectUserscript } from './helpers'
import { parseTerm } from '../../src/services/search/searchSyntax'

test('圖庫選中標籤存成獨立快照，以短 ID fragment 打開 My Tags', async ({ page }) => {
  await injectGalleryUserscript(page)
  const chips = page.locator('.eqt-gallery-chip')
  await expect(chips.first()).toBeVisible()
  const wanted = [
    await chips.nth(0).getAttribute('data-ns-raw'),
    await chips.nth(1).getAttribute('data-ns-raw'),
  ]
  await chips.nth(0).locator('.eqt-gallery-chip__body').click()
  await chips.nth(1).locator('.eqt-gallery-chip__body').click({ button: 'right' })

  // 新分頁不在 page 的 mock 範圍裡，攔在 context 上免得它真的連到 EH
  await page.context().route(/\/mytags$/, (route) => route.fulfill({ contentType: 'text/html', body: '' }))
  const link = page.locator('.eqt-gallery-actions__btn--mytags')
  await expect(link).toHaveAttribute('href', /\/mytags#eqt_hash=[A-Za-z0-9_-]{12}$/)
  const popup = page.waitForEvent('popup')
  await link.click()
  const opened = await popup
  await opened.waitForLoadState()
  // 開完才清選取，連結回到整本圖庫的 My Tags
  await expect(page.locator('.eqt-gallery-actions__btn--vote .eqt-gallery-actions__count')).toHaveText(['0', '0'])
  await expect(link).toHaveAttribute('href', /#eqt_gid=/)
  const url = new URL(opened.url())
  expect(url.origin + url.pathname).toBe('https://e-hentai.org/mytags')
  expect(url.search).toBe('')
  const id = new URLSearchParams(url.hash.slice(1)).get('eqt_hash')!
  expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/)

  const saved: string[] = await page.evaluate((hash) => {
    const raw = JSON.parse(localStorage.getItem(`eqt-test:eqt_pick:${hash}`) ?? 'null')
    return JSON.parse(raw).terms
  }, id)
  expect(saved.map(raw => {
    const term = parseTerm(raw)
    return `${term.namespace}:${term.tag}`
  })).toEqual(wanted)
  expect(saved.map(raw => parseTerm(raw).prefix)).toEqual([null, '-'])
})

test('帶 eqt_hash 開 My Tags 時「選中」篩選預設打開，既有與新標籤都能從候選進編輯區', async ({ page }) => {
  await injectMyTagsUserscript(page)
  const pick = JSON.stringify({ schema: 2, terms: ['-male:positive-sample$', '~other:"unlisted pick$"'], savedAt: 1 })
  await page.addInitScript((value) => {
    localStorage.setItem('eqt-test:eqt_pick:7kQ2mN9xR4vB', JSON.stringify(value))
  }, pick)
  // 已經在 /mytags 上，goto 只改 fragment 會是同一份文件內的跳轉：init script 不重跑、頁面也不重載，
  // 所以要再 reload 一次，才是使用者從圖庫開新分頁進來的情況
  await page.goto('https://e-hentai.org/mytags#eqt_hash=7kQ2mN9xR4vB')
  await page.reload()
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
