import { test, expect, type Page } from '@playwright/test'
import { injectMyTagsUserscript } from './helpers'

async function visibleTags(page: Page): Promise<string[]> {
  return page.locator('.eqt-panel__side .eqt-taglist__chip').evaluateAll((chips) =>
    chips.map((chip) => chip.getAttribute('title') ?? ''))
}

test.beforeEach(async ({ page }) => {
  await injectMyTagsUserscript(page)
  await expect(page.locator('.eqt-panel__side > .eqt-taglist')).toBeVisible()
})

test('全域控制列在工作區上方，標籤清單保留兩行自己的控制', async ({ page }) => {
  const topbar = page.locator('.eqt-panel__topbar')
  const actions = topbar.locator(':scope > .eqt-panel__btn')
  await expect(actions).toHaveCount(3)
  await expect(actions.nth(0)).toHaveAccessibleName('設定')
  await expect(actions.nth(1)).toHaveAccessibleName('E站頂部欄')
  await expect(actions.nth(2)).toHaveAccessibleName('新增標籤 >')
  const [ehBorder, createBorder, standardBorder] = await topbar.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--eqt-border)'
    document.body.appendChild(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    const buttons = element.querySelectorAll('.eqt-panel__eh-toggle, .eqt-panel__create-toggle')
    return [
      getComputedStyle(buttons[0]).borderTopColor,
      getComputedStyle(buttons[1]).borderTopColor,
      resolved,
    ]
  })
  expect(ehBorder).toBe(standardBorder)
  expect(createBorder).toBe(standardBorder)
  const addBox = await actions.nth(2).boundingBox()
  const thresholdBox = await topbar.locator('.eqt-panel__field').boundingBox()
  expect(addBox).not.toBeNull()
  expect(thresholdBox).not.toBeNull()
  expect(thresholdBox!.x).toBeGreaterThanOrEqual(addBox!.x + addBox!.width)
  expect(thresholdBox!.x).toBeLessThan((await topbar.boundingBox())!.width / 2)
  await expect(topbar.locator('.eqt-panel__field')).toContainText('軟過濾閾值')

  await expect(page.locator('.eqt-taglist__head > div')).toHaveCount(2)
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

test('E站頂部欄借入現場 #nb 與 #lb，插件控制與工作區維持原位', async ({ page }) => {
  const outer = page.locator('#outer')
  const workspace = page.locator('.eqt-panel__workspace')
  await expect(outer).toBeHidden()
  await expect(workspace).toBeVisible()
  const workspaceBefore = await workspace.boundingBox()
  expect(workspaceBefore).not.toBeNull()
  await expect(page.locator('body > #nb')).toHaveCount(1)
  await expect(page.locator('body > #lb')).toHaveCount(1)
  await page.evaluate(() => {
    ;(window as typeof window & { __eqtNavClicks: number }).__eqtNavClicks = 0
    document.querySelector('#nb')?.addEventListener('click', (event) => {
      event.preventDefault()
      ;(window as typeof window & { __eqtNavClicks: number }).__eqtNavClicks += 1
    })
  })

  const toggle = page.getByRole('button', { name: 'E站頂部欄', exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const ehTopbar = page.locator('.eqt-panel__eh-topbar')
  await expect(outer).toBeHidden()
  await expect(workspace).toBeVisible()
  await expect(ehTopbar.locator(':scope > #nb')).toHaveCount(1)
  await expect(ehTopbar.locator(':scope > #lb')).toHaveCount(1)
  const [borderColor, textColor] = await ehTopbar.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--eqt-text)'
    document.body.appendChild(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return [getComputedStyle(element).borderTopColor, resolved]
  })
  expect(borderColor).toBe(textColor)
  const workspaceAfter = await workspace.boundingBox()
  const overlay = await ehTopbar.boundingBox()
  expect(workspaceAfter).not.toBeNull()
  expect(overlay).not.toBeNull()
  expect(workspaceAfter!.y).toBe(workspaceBefore!.y)
  expect(overlay!.y + overlay!.height).toBeGreaterThan(workspaceAfter!.y)
  await expect(page.locator('.eqt-panel__btn--settings')).toBeVisible()
  await expect(page.locator('.eqt-panel__create-toggle')).toBeVisible()
  await expect(page.locator('.eqt-panel__topbar > .eqt-panel__field')).toBeVisible()
  await ehTopbar.locator('#nb a').first().click()
  expect(await page.evaluate(() => (
    window as typeof window & { __eqtNavClicks: number }
  ).__eqtNavClicks)).toBe(1)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(ehTopbar).toHaveCount(0)
  await expect(page.locator('body > #nb')).toHaveCount(1)
  await expect(page.locator('body > #lb')).toHaveCount(1)
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


test('新增欄從候選建立草稿，左右兩欄都能接管同一份預覽', async ({ page }) => {
  const openCreate = page.getByRole('button', { name: '新增標籤 >', exact: true })
  await openCreate.click()
  const createToggle = page.getByRole('button', { name: '新增標籤 v', exact: true })
  await expect(createToggle).toHaveAttribute('aria-expanded', 'true')
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
  await expect(initialDraft).toHaveClass(/eqt-tag-catalog__draft--previewed/)
  const draftColors = await initialDraft.evaluate((element) => {
    const probe = document.createElement('span')
    document.body.appendChild(probe)
    probe.style.color = 'var(--eqt-divider)'
    const divider = getComputedStyle(probe).color
    probe.style.color = 'var(--eqt-bg-active)'
    const active = getComputedStyle(probe).color
    probe.remove()
    const style = getComputedStyle(element)
    return { border: style.borderTopColor, background: style.backgroundColor, divider, active }
  })
  expect(draftColors.border).toBe(draftColors.divider)
  expect(draftColors.background).toBe(draftColors.active)
  const positiveRow = page.locator('.eqt-taglist__row').filter({
    has: page.locator('.eqt-taglist__chip[title="male:positive-sample"]'),
  })
  await positiveRow.locator('.eqt-taglist__chip').click()
  await expect(positiveRow).toHaveClass(/eqt-taglist__row--on/)
  await expect(page.locator('.eqt-tag-catalog')).toBeVisible()
  await expect(initialDraft).toHaveClass(/eqt-tag-catalog__draft--previewed/)
  await expect(initialDraft.locator('.eqt-taglist__chip')).toHaveAttribute(
    'title',
    'male:positive-sample',
  )
  await expect(initialDraft.locator('.eqt-number-field__input')).toHaveValue('40')
  await expect(initialDraft.locator('.eqt-taglist__color')).toHaveValue('#00cc00')
  await expect(initialDraft.locator('.eqt-taglist__flag input').nth(0)).toBeChecked()
  const moveButton = initialDraft.locator('.eqt-tag-catalog__create')
  await expect(moveButton).toHaveText('移動標籤')
  await expect(moveButton).toBeDisabled()
  await initialDraft.locator('select').selectOption('2')
  await expect(moveButton).toBeEnabled()

  await page.locator('.eqt-popup__suggestion').filter({ hasText: 'female:sample tag' }).click()
  await expect(initialDraft.locator('.eqt-taglist__chip')).toHaveAttribute('title', 'female:sample tag')
  await expect(initialDraft.locator('.eqt-tag-catalog__create')).toHaveText('新增標籤')
  await expect(initialDraft).toHaveClass(/eqt-tag-catalog__draft--previewed/)
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

  await positiveRow.locator('.eqt-number-field__input').fill('-30')
  await positiveRow.locator('.eqt-number-field__input').press('Enter')
  await expect(page.locator('.eqt-preview__col--left .eqt-preview__tile')).toHaveCount(2)
  await expect(page.locator('.eqt-preview__col--right .eqt-preview__tile')).toHaveCount(0)

  await createToggle.click()
  await expect(page.locator('.eqt-tag-catalog')).toBeHidden()
  await expect.poll(() => page.locator('.eqt-preview__col--left .eqt-preview__grid').evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )).toBe(4)
  const reopen = page.getByRole('button', { name: '新增標籤 >', exact: true })
  await reopen.click()
  await expect(page.locator('.eqt-tag-catalog')).toBeVisible()
  await expect(search).toBeFocused()
})

test('Gallery 操作列固定在捲動區外，標題緊接封面', async ({ page }) => {
  await page.getByRole('button', { name: '新增標籤 >', exact: true }).click()
  const search = page.locator('.eqt-tag-catalog__search-input')
  await search.fill('sample tag')
  await page.locator('.eqt-popup__suggestion').filter({ hasText: 'female:sample tag' }).click()
  await page.locator('.eqt-preview__cover').first().click()

  const gallery = page.locator('.eqt-gal')
  await expect(gallery).toBeVisible()
  const controls = gallery.locator(':scope > .eqt-gal__head > *')
  await expect(controls).toHaveCount(4)
  await expect(controls.nth(0)).toHaveText('該擋')
  await expect(controls.nth(1)).toHaveText('該留')
  await expect(controls.nth(2)).toHaveText('打開圖庫')
  await expect(controls.nth(2)).toHaveAttribute(
    'href',
    'https://e-hentai.org/g/1001/aaaaaaaaaa/',
  )
  await expect(controls.nth(3)).toHaveText('X')

  const scroll = gallery.locator(':scope > .eqt-gal__scroll')
  await expect(gallery).toHaveCSS('overflow', 'hidden')
  await expect(scroll).toHaveCSS('overflow-y', 'auto')
  const headY = (await gallery.locator(':scope > .eqt-gal__head').boundingBox())!.y
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight })
  expect((await gallery.locator(':scope > .eqt-gal__head').boundingBox())!.y).toBe(headY)

  const cover = gallery.locator('.eqt-gal__cover')
  expect(await cover.evaluate((element) => (
    element.nextElementSibling?.classList.contains('eqt-gal__titles') ?? false
  ))).toBe(true)
  await expect(gallery.locator('.eqt-gal__titles')).toContainText('Angel Interval')
})

test('Catalog 搜尋結果與左欄解析成同一個既有標籤實體', async ({ page }) => {
  await page.getByRole('button', { name: '新增標籤 >', exact: true }).click()
  const search = page.locator('.eqt-tag-catalog__search-input')
  await search.fill('negative-sample')
  await page.locator('.eqt-popup__suggestion').filter({
    hasText: 'female:negative-sample',
  }).click()

  const catalog = page.locator('.eqt-tag-catalog__draft')
  const listRow = page.locator('.eqt-taglist__row').filter({
    has: page.locator('.eqt-taglist__chip[title="female:negative-sample"]'),
  })
  await expect(catalog.locator('.eqt-taglist__chip')).toHaveAttribute('title', 'female:negative-sample')
  await expect(catalog.locator('.eqt-number-field__input')).toHaveValue('-20')
  await expect(catalog.locator('.eqt-taglist__color')).toHaveValue('#cc0000')
  await expect(catalog.locator('.eqt-tag-catalog__create')).toHaveText('移動標籤')
  await expect(catalog.locator('.eqt-tag-catalog__error')).toHaveCount(0)

  await catalog.locator('.eqt-number-field__input').fill('-25')
  await catalog.locator('.eqt-number-field__input').press('Enter')
  await expect(listRow.locator('.eqt-number-field__input')).toHaveValue('-25')
  await listRow.locator('.eqt-number-field__input').fill('-30')
  await listRow.locator('.eqt-number-field__input').press('Enter')
  await expect(catalog.locator('.eqt-number-field__input')).toHaveValue('-30')
})

test('既有標籤從 Catalog 送出移動動作', async ({ page }) => {
  await page.getByRole('button', { name: '新增標籤 >', exact: true }).click()
  const positiveRow = page.locator('.eqt-taglist__row').filter({
    has: page.locator('.eqt-taglist__chip[title="male:positive-sample"]'),
  })
  await positiveRow.locator('.eqt-taglist__chip').click()

  const catalog = page.locator('.eqt-tag-catalog__draft')
  await catalog.locator('select').selectOption('2')
  const requestPromise = page.waitForRequest((request) => (
    request.url() === 'https://e-hentai.org/mytags'
    && request.method() === 'POST'
  ))
  await catalog.locator('.eqt-tag-catalog__create').click()
  const request = await requestPromise
  const form = new URLSearchParams(request.postData() ?? '')

  expect(form.get('usertag_action')).toBe('mass')
  expect(form.get('usertag_target')).toBe('2')
  expect(form.getAll('modify_usertags[]')).toEqual(['2'])
})

test('新增草稿會送到指定 tag set 並保留設定', async ({ page }) => {
  const search = page.locator('.eqt-tag-catalog__search-input')
  await page.getByRole('button', { name: '新增標籤 >', exact: true }).click()
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
