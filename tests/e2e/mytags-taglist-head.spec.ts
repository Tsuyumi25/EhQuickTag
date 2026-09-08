import { test, expect, type Page } from '@playwright/test'
import { injectMyTagsUserscript } from './helpers'

async function visibleTags(page: Page): Promise<string[]> {
  return page.locator('.eqt-panel__side .eqt-taglist__chip').evaluateAll((chips) =>
    chips.map((chip) => chip.getAttribute('title') ?? ''))
}

test.beforeEach(async ({ page }) => {
  await injectMyTagsUserscript(page)
  await expect(page.locator('.eqt-taglist')).toBeVisible()
})

test('MyTags 表頭分成 meta、主要控制與篩選三行', async ({ page }) => {
  await expect(page.locator('.eqt-taglist__head > div')).toHaveCount(3)
  await expect(page.locator('.eqt-taglist__head-main > *')).toHaveCount(2)
  await expect(page.locator('.eqt-taglist__head-main > *').nth(0)).toHaveClass(/eqt-taglist__check-all/)
  await expect(page.locator('.eqt-taglist__head-main > *').nth(1)).toHaveClass(/eqt-panel__setpick/)
  await expect(page.locator('.eqt-taglist__add-tag')).toHaveCount(0)

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


test('標籤管理從候選建立草稿並即時套用所有權重', async ({ page }) => {
  await expect(page.locator('.eqt-panel__mode--on')).toHaveText('標籤管理')
  const search = page.locator('.eqt-tag-catalog__search-input')
  await expect(search).toBeEnabled()
  const initialDraft = page.locator('.eqt-tag-catalog__draft')
  await expect(initialDraft.locator('.eqt-taglist__body')).toBeVisible()
  await expect(initialDraft.locator('.eqt-taglist__chip')).toHaveText('新增標籤')
  await expect(initialDraft.locator('.eqt-taglist__bar')).toBeVisible()
  await expect(initialDraft.locator('.eqt-tag-catalog__create')).toBeDisabled()
  await expect(initialDraft.locator('.eqt-tag-catalog__create')).toHaveClass(/eqt-panel__btn--primary/)
  await expect(initialDraft.locator('select')).toHaveClass(/eqt-panel__setpick/)
  await expect(initialDraft.locator('.eqt-tag-catalog__section-head')).toHaveCount(0)
  const createRowHeights = await initialDraft.locator('.eqt-tag-catalog__create-row > *').evaluateAll(
    (elements) => elements.map((element) => element.getBoundingClientRect().height),
  )
  expect(createRowHeights[0]).toBe(createRowHeights[1])
  const femaleNamespace = page.getByRole('button', { name: '女', exact: true })
  await femaleNamespace.click()
  await expect(femaleNamespace).toHaveClass(/eqt-namespace-filter__button--active/)
  await search.fill('sample tag')
  await page.locator('.eqt-popup__suggestion').filter({ hasText: 'female:sample tag' }).click()

  const draftBody = page.locator('.eqt-tag-catalog__draft .eqt-taglist__body')
  await expect(draftBody).toBeVisible()
  await expect(draftBody.locator('.eqt-taglist__chip')).toHaveAttribute('title', 'female:sample tag')
  await expect(page.locator('.eqt-preview__col--left .eqt-preview__tile')).toHaveCount(1)
  await expect(page.locator('.eqt-preview__col--right .eqt-preview__tile')).toHaveCount(1)
  await expect.poll(() => page.locator('.eqt-preview__col--left .eqt-preview__grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )).toBe(2)
  await page.setViewportSize({ width: 960, height: 600 })
  const refresh = await page.locator('.eqt-preview__controls .eqt-panel__btn').boundingBox()
  expect(refresh).not.toBeNull()
  expect(refresh!.x + refresh!.width).toBeLessThanOrEqual(960)
  expect(refresh!.y + refresh!.height).toBeLessThanOrEqual(600)
  await page.setViewportSize({ width: 1440, height: 900 })

  const positiveRow = page.locator('.eqt-taglist__row').filter({
    has: page.locator('.eqt-taglist__chip[title="male:positive-sample"]'),
  })
  await positiveRow.locator('.eqt-number-field__input').fill('-30')
  await positiveRow.locator('.eqt-number-field__input').press('Enter')
  await expect(page.locator('.eqt-preview__col--left .eqt-preview__tile')).toHaveCount(2)
  await expect(page.locator('.eqt-preview__col--right .eqt-preview__tile')).toHaveCount(0)

  await page.getByRole('button', { name: '過濾預覽', exact: true }).click()
  await expect(page.locator('.eqt-tag-catalog')).toBeHidden()
  await expect.poll(() => page.locator('.eqt-preview__col--left .eqt-preview__grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )).toBe(4)
  await page.locator('.eqt-taglist__add-tag').click()
  await expect(page.locator('.eqt-tag-catalog')).toBeVisible()
  await expect(search).toBeFocused()
})

test('新增草稿會送到指定 tag set 並保留設定', async ({ page }) => {
  const search = page.locator('.eqt-tag-catalog__search-input')
  await expect(search).toBeEnabled()
  await search.fill('sample tag')
  await page.locator('.eqt-popup__suggestion').filter({ hasText: 'female:sample tag' }).click()

  await page.locator('.eqt-tag-catalog__create-row select').selectOption('2')
  await page.locator('.eqt-tag-catalog__draft .eqt-number-field__input').fill('25')
  await page.locator('.eqt-tag-catalog__draft .eqt-number-field__input').press('Enter')
  await page.locator('.eqt-tag-catalog__draft .eqt-taglist__color').fill('#123ABC')
  const flags = page.locator('.eqt-tag-catalog__draft .eqt-taglist__flag input')
  await flags.nth(0).check()

  const requestPromise = page.waitForRequest((request) => (
    request.url() === 'https://e-hentai.org/mytags?tagset=2'
    && request.method() === 'POST'
  ))
  await page.locator('.eqt-tag-catalog__create').click()
  const request = await requestPromise
  const form = new URLSearchParams(request.postData() ?? '')

  expect(form.get('usertag_action')).toBe('add')
  expect(form.get('tagname_new')).toBe('female:sample tag')
  expect(form.get('tagweight_0')).toBe('25')
  expect(form.get('tagcolor_0')).toBe('#123ABC')
  expect(form.get('tagwatch_0')).toBe('on')
  expect(form.has('taghide_0')).toBe(false)
})
