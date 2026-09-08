import { test, expect, type Page } from '@playwright/test'
import { injectMyTagsUserscript } from './helpers'

async function visibleTags(page: Page): Promise<string[]> {
  return page.locator('.eqt-taglist__chip').evaluateAll((chips) =>
    chips.map((chip) => chip.getAttribute('title') ?? ''))
}

test.beforeEach(async ({ page }) => {
  await injectMyTagsUserscript(page)
  await expect(page.locator('.eqt-taglist')).toBeVisible()
})

test('MyTags 表頭分成 meta、主要控制與篩選三行', async ({ page }) => {
  await expect(page.locator('.eqt-taglist__head > div')).toHaveCount(3)
  await expect(page.locator('.eqt-taglist__head-main > *')).toHaveCount(3)
  await expect(page.locator('.eqt-taglist__head-main > *').nth(0)).toHaveClass(/eqt-taglist__check-all/)
  await expect(page.locator('.eqt-taglist__head-main > *').nth(1)).toHaveClass(/eqt-panel__setpick/)

  const add = page.locator('.eqt-taglist__add-tag')
  await expect(add).toHaveText('新增標籤')
  await expect(add).toBeDisabled()

  const filters = page.locator('.eqt-taglist__head-filters > *')
  await expect(filters).toHaveCount(4)
  await expect(filters.nth(0)).toHaveText('關注')
  await expect(filters.nth(1)).toHaveText('隱藏')
  await expect(filters.nth(2)).toHaveClass(/eqt-taglist__sortpick/)
  await expect(filters.nth(3)).toHaveClass(/eqt-taglist__statuspick/)
})

test('關注與隱藏 toggle 取聯集', async ({ page }) => {
  const toggles = page.locator('.eqt-taglist__flag-filter')

  await toggles.nth(0).click()
  await expect.poll(() => visibleTags(page)).toEqual(['male:positive-sample'])

  await toggles.nth(1).click()
  await expect.poll(() => visibleTags(page)).toEqual([
    'parody:hidden-sample',
    'male:positive-sample',
  ])

  await toggles.nth(0).click()
  await expect.poll(() => visibleTags(page)).toEqual(['parody:hidden-sample'])
})

test('排序選單切換負權重、正權重與有效顏色順序', async ({ page }) => {
  const sort = page.locator('.eqt-taglist__sortpick')

  await expect.poll(() => visibleTags(page)).toEqual([
    'female:negative-sample',
    'parody:hidden-sample',
    'character:plain-sample',
    'male:positive-sample',
  ])

  await sort.selectOption('positive')
  await expect.poll(() => visibleTags(page)).toEqual([
    'male:positive-sample',
    'character:plain-sample',
    'parody:hidden-sample',
    'female:negative-sample',
  ])

  await sort.selectOption('color')
  await expect.poll(() => visibleTags(page)).toEqual([
    'character:plain-sample',
    'male:positive-sample',
    'parody:hidden-sample',
    'female:negative-sample',
  ])
})

