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

test('色票沿用標籤集顏色，無設定色時隨權重與隱藏狀態使用 E 站預設色', async ({ page }) => {
  const draft = page.locator('.eqt-tag-catalog__draft')
  const swatch = draft.locator('.eqt-taglist__color-swatch')
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(68, 85, 102)')

  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const color = document.querySelector<HTMLInputElement>('#tagcolor')
      if (color) color.value = ''
    })
  })
  await injectMyTagsUserscript(page)
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(51, 119, 255)')
  await expect(swatch).toHaveCSS('background-color', 'rgb(19, 87, 223)')

  const weight = draft.locator('.eqt-number-field__input')
  await weight.fill('-1')
  await weight.press('Enter')
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(255, 102, 102)')
  await expect(swatch).toHaveCSS('background-color', 'rgb(223, 70, 70)')

  await weight.fill('1')
  await weight.press('Enter')
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(51, 119, 255)')
  await draft.locator('.eqt-taglist__flag input').nth(1).check()
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(255, 102, 102)')
  await expect(swatch).toHaveCSS('background-color', 'rgb(223, 70, 70)')

  await draft.locator('.eqt-taglist__color').fill('#EEEEEE')
  await expect(swatch).toHaveCSS('border-top-color', 'rgb(206, 206, 206)')
  await expect(swatch).toHaveCSS('background-color', 'rgb(238, 238, 238)')
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
  await expect(page.locator('.eqt-panel__resize-handle--editor')).toBeVisible()
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


test('編輯區可拖曳收合並保留草稿與預覽', async ({ page }) => {
  const search = page.locator('.eqt-tag-catalog__search-input')
  await expect(search).toBeEnabled()
  const initialDraft = page.locator('.eqt-tag-catalog__draft')
  await expect(initialDraft.locator('.eqt-taglist__body')).toBeVisible()
  await expect(initialDraft.locator('.eqt-tag-catalog__name')).toBeEditable()
  await expect(initialDraft.locator('.eqt-taglist__bar')).toBeVisible()
  await expect(initialDraft.locator('.eqt-taglist__impact-count')).toHaveText(['0', '0'])
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
  await expect(draftBody.locator('.eqt-tag-catalog__name')).toHaveValue('female:sample tag')
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
  await expect(initialDraft.locator('.eqt-tag-catalog__name')).toHaveValue('male:positive-sample')
  await expect(initialDraft.locator('.eqt-number-field__input')).toHaveValue('40')
  await expect(initialDraft.locator('.eqt-taglist__color')).toHaveValue('#00cc00')
  await expect(initialDraft.locator('.eqt-taglist__flag input').nth(0)).toBeChecked()
  await initialDraft.locator('.eqt-taglist__color').fill('#EEEEEE')
  const chipBorder = await positiveRow.locator('.eqt-taglist__chip').evaluate((element) =>
    getComputedStyle(element).borderTopColor)
  await expect(initialDraft.locator('.eqt-taglist__color-swatch')).toHaveCSS('border-top-color', chipBorder)
  await expect(positiveRow.locator('.eqt-taglist__color-swatch')).toHaveCSS('border-top-color', chipBorder)
  await expect(initialDraft.locator('.eqt-taglist__color-swatch')).toHaveCSS('background-color', 'rgb(238, 238, 238)')
  await initialDraft.locator('.eqt-taglist__color').fill('#00cc00')
  const moveButton = initialDraft.locator('.eqt-tag-catalog__create')
  await expect(moveButton).toHaveText('移動標籤')
  await expect(moveButton).toBeDisabled()
  await initialDraft.locator('select').selectOption('2')
  await expect(moveButton).toBeEnabled()

  await page.locator('.eqt-popup__suggestion').filter({ hasText: 'female:sample tag' }).click()
  await expect(initialDraft.locator('.eqt-tag-catalog__name')).toHaveValue('female:sample tag')
  await expect(initialDraft.locator('.eqt-tag-catalog__create')).toHaveText('新增標籤')
  await expect(initialDraft).toHaveClass(/eqt-tag-catalog__draft--previewed/)
  await expect(page.locator('.eqt-preview__col--left .eqt-preview__tile')).toHaveCount(1)
  await expect(page.locator('.eqt-preview__col--right .eqt-preview__tile')).toHaveCount(1)
  await expect(initialDraft.locator('.eqt-taglist__impact-count')).toHaveText(['1', '1'])
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
  await expect(initialDraft.locator('.eqt-taglist__impact-count')).toHaveText(['2', '0'])

  await initialDraft.locator('.eqt-number-field__input').fill('25')
  await initialDraft.locator('.eqt-number-field__input').press('Enter')
  const handle = page.locator('.eqt-panel__resize-handle--editor')
  const editor = page.locator('.eqt-panel__editor-panel')
  const preview = page.locator('.eqt-panel__preview-stack')
  const sidebar = page.locator('.eqt-panel__side')
  const grid = page.locator('.eqt-preview__col--left .eqt-preview__grid')
  const columnsBefore = await grid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length)
  const groupBox = (await page.locator('.eqt-panel__splitter').boundingBox())!
  const sidebarBefore = (await sidebar.boundingBox())!
  const previewBefore = (await preview.boundingBox())!
  const handleBefore = (await handle.boundingBox())!
  const dragY = handleBefore.y + handleBefore.height / 2
  await page.mouse.move(handleBefore.x + handleBefore.width / 2, dragY)
  await page.mouse.down()
  await page.mouse.move(groupBox.x + groupBox.width * 0.2, dragY, { steps: 8 })
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(groupBox.width * 0.15)
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeLessThan(groupBox.width * 0.25)
  expect((await page.locator('.eqt-tag-catalog').boundingBox())!.width).toBe((await editor.boundingBox())!.width)
  await page.mouse.move(groupBox.x + groupBox.width * 0.05, dragY, { steps: 8 })
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(0)
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeLessThan(groupBox.width * 0.1)
  expect((await page.locator('.eqt-tag-catalog').boundingBox())!.width).toBe((await editor.boundingBox())!.width)
  const visibleEditor = (await editor.boundingBox())!
  expect(await page.locator('.eqt-tag-catalog').evaluate((element, point) =>
    element.contains(document.elementFromPoint(point.x, point.y)), {
    x: visibleEditor.x + visibleEditor.width + handleBefore.width + 2,
    y: dragY,
  })).toBe(false)
  await page.mouse.move(groupBox.x, dragY, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await editor.boundingBox())!.width).toBe(0)
  await expect(handle).toBeVisible()
  await expect(page.locator('.eqt-tag-catalog')).toHaveAttribute('inert', '')
  await initialDraft.locator('.eqt-tag-catalog__name').evaluate((element) => (element as HTMLElement).focus())
  await expect(initialDraft.locator('.eqt-tag-catalog__name')).not.toBeFocused()
  expect((await sidebar.boundingBox())!.width).toBe(sidebarBefore.width)
  expect((await preview.boundingBox())!.width).toBeGreaterThan(previewBefore.width)
  await expect.poll(() => grid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBeGreaterThan(columnsBefore)
  await expect(page.locator('.eqt-preview__titlerow .eqt-taglist__chip')).toHaveAttribute('title', 'female:sample tag')

  const coverSize = page.getByRole('slider', { name: '封面大小' })
  await coverSize.press('Home')
  const smallColumns = await grid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length)
  await coverSize.press('End')
  await expect.poll(() => grid.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBeLessThan(smallColumns)

  const collapsedHandle = (await handle.boundingBox())!
  await page.mouse.move(collapsedHandle.x + collapsedHandle.width / 2, dragY)
  await page.mouse.down()
  await page.mouse.move(groupBox.x + groupBox.width * 0.05, dragY, { steps: 8 })
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(0)
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeLessThan(groupBox.width * 0.1)
  await page.mouse.move(groupBox.x + groupBox.width * 0.45, dragY, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await editor.boundingBox())!.width).toBeGreaterThan(0)
  await expect(page.locator('.eqt-tag-catalog')).not.toHaveAttribute('inert', '')
  await expect(search).toHaveValue('sample tag')
  await expect(initialDraft.locator('.eqt-tag-catalog__name')).toHaveValue('female:sample tag')
  await expect(initialDraft.locator('.eqt-number-field__input')).toHaveValue('25')
  expect((await sidebar.boundingBox())!.width).toBe(sidebarBefore.width)
})

test('標籤清單可獨立拖曳收合，恢復後保留目前編輯對象', async ({ page }) => {
  const name = page.locator('.eqt-tag-catalog__name')
  await name.fill('parody:unlisted tag')
  const handle = page.locator('.eqt-panel__resize-handle--side')
  const side = page.locator('.eqt-panel__side-panel')
  const main = page.locator('.eqt-panel__main-panel')
  const workspace = (await page.locator('.eqt-panel__workspace').boundingBox())!
  const start = (await handle.boundingBox())!
  const sideBefore = (await side.boundingBox())!.width
  const mainBefore = (await main.boundingBox())!.width
  const y = start.y + start.height / 2
  await page.mouse.move(start.x + start.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(workspace.x + workspace.width * 0.4, y, { steps: 8 })
  await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(sideBefore)
  expect((await main.boundingBox())!.width).toBeLessThan(mainBefore)
  await page.mouse.move(workspace.x + workspace.width * 0.05, y, { steps: 8 })
  await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(0)
  await expect.poll(async () => (await side.boundingBox())!.width).toBeLessThan(workspace.width * 0.1)
  expect((await page.locator('.eqt-panel__side').boundingBox())!.width).toBe((await side.boundingBox())!.width)
  await page.mouse.move(workspace.x, y, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await side.boundingBox())!.width).toBe(0)
  await expect(handle).toBeVisible()
  await expect(page.locator('.eqt-panel__side')).toHaveAttribute('inert', '')
  await expect(name).toHaveValue('parody:unlisted tag')

  const collapsed = (await handle.boundingBox())!
  await page.mouse.move(collapsed.x + collapsed.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(workspace.x + workspace.width * 0.28, y, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(0)
  await expect(page.locator('.eqt-panel__side')).not.toHaveAttribute('inert', '')
  await expect(name).toHaveValue('parody:unlisted tag')

  await page.setViewportSize({ width: 800, height: 800 })
  await expect(handle).toHaveAttribute('data-orientation', 'vertical')
  const verticalHandle = (await handle.boundingBox())!
  const heightBefore = (await side.boundingBox())!.height
  const x = verticalHandle.x + verticalHandle.width / 2
  await page.mouse.move(x, verticalHandle.y + verticalHandle.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, verticalHandle.y + 80, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await side.boundingBox())!.height).toBeGreaterThan(heightBefore)
  await expect(name).toHaveValue('parody:unlisted tag')
})

test('Gallery 操作列固定在捲動區外，標題緊接封面', async ({ page }) => {
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
  const search = page.locator('.eqt-tag-catalog__search-input')
  await search.fill('negative-sample')
  await page.locator('.eqt-popup__suggestion').filter({
    hasText: 'female:negative-sample',
  }).click()

  const catalog = page.locator('.eqt-tag-catalog__draft')
  const listRow = page.locator('.eqt-taglist__row').filter({
    has: page.locator('.eqt-taglist__chip[title="female:negative-sample"]'),
  })
  await expect(catalog.locator('.eqt-tag-catalog__name')).toHaveValue('female:negative-sample')
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

test('名稱 input 可新增候選清單外的 tag，送出前保留完整名稱與設定', async ({ page }) => {
  const catalog = page.locator('.eqt-tag-catalog__draft')
  const name = catalog.locator('.eqt-tag-catalog__name')
  const create = catalog.locator('.eqt-tag-catalog__create')
  await expect(name).toBeEditable()
  await name.fill('parody:unlisted')
  await name.press('End')
  await name.press('Space')
  await name.press('t')
  await name.press('a')
  await name.press('g')
  await expect(name).toHaveValue('parody:unlisted tag')
  await expect(create).toBeEnabled()
  await catalog.locator('select').selectOption('2')
  await catalog.locator('.eqt-number-field__input').fill('25')
  await catalog.locator('.eqt-number-field__input').press('Enter')
  const requestPromise = page.waitForRequest((request) => (
    request.url() === 'https://e-hentai.org/mytags?tagset=2'
    && request.method() === 'POST'
  ))
  await create.click()
  const form = new URLSearchParams((await requestPromise).postData() ?? '')
  expect(form.get('usertag_action')).toBe('add')
  expect(form.get('tagname_new')).toBe('parody:unlisted tag')
  expect(form.get('tagweight_0')).toBe('25')
})

test('名稱 input 在既有 tag 與草稿間切換，focus 接管預覽且輸入不寫回 EH', async ({ page }) => {
  const writes: string[] = []
  const samples: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/mytags') {
      writes.push(request.url())
    }
    if (new URL(request.url()).searchParams.has('f_search')) samples.push(request.url())
  })
  const catalog = page.locator('.eqt-tag-catalog__draft')
  const name = catalog.locator('.eqt-tag-catalog__name')
  const create = catalog.locator('.eqt-tag-catalog__create')
  const saved = page.locator('.eqt-taglist__row').filter({
    has: page.locator('.eqt-taglist__chip[title="female:negative-sample"]'),
  })
  await name.fill('female:negative-sample')
  await expect(name).toBeEditable()
  await expect(catalog.locator('.eqt-number-field__input')).toHaveValue('-20')
  await expect(create).toHaveText('移動標籤')
  await expect(create).toBeDisabled()
  await catalog.locator('select').selectOption('2')
  await expect(create).toBeEnabled()
  await name.fill('parody:unlisted tag')
  await expect(create).toHaveText('新增標籤')
  await expect(create).toBeEnabled()
  await expect(saved.locator('.eqt-number-field__input')).toHaveValue('-20')
  await expect(saved.locator('.eqt-taglist__chip')).toHaveAttribute('title', 'female:negative-sample')
  expect(samples).toEqual([])
  expect(writes).toEqual([])

  await name.fill('')
  await expect(create).toBeDisabled()
  await expect(catalog).not.toHaveClass(/eqt-tag-catalog__draft--previewed/)
  await name.fill('female:negative-sample')
  await saved.locator('.eqt-taglist__chip').click()
  await expect(catalog).not.toHaveClass(/eqt-tag-catalog__draft--previewed/)
  await name.focus()
  await expect(catalog).toHaveClass(/eqt-tag-catalog__draft--previewed/)
  const sampleRequest = page.waitForRequest((request) => (
    new URL(request.url()).searchParams.has('f_search')
  ))
  await name.press('Enter')
  await sampleRequest
  expect(writes).toEqual([])
})

test('splitter 頂端按鈕展開回預設比例，拖曳後仍可用滑鼠與鍵盤收合', async ({ page }) => {
  for (const area of ['side', 'editor']) {
    const panel = page.locator(`.eqt-panel__${area}-panel`)
    const handle = page.locator(`.eqt-panel__resize-handle--${area}`)
    const toggle = page.locator(`.eqt-panel__panel-toggle--${area}`)
    const defaultWidth = (await panel.boundingBox())!.width
    const handleBox = (await handle.boundingBox())!
    const x = handleBox.x + handleBox.width / 2
    const y = handleBox.y + handleBox.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 80, y, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(defaultWidth)

    await toggle.click()
    await expect.poll(async () => (await panel.boundingBox())!.width).toBe(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect.poll(async () => Math.abs((await panel.boundingBox())!.width - defaultWidth)).toBeLessThan(1)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await toggle.press('Enter')
    await expect.poll(async () => (await panel.boundingBox())!.width).toBe(0)
    await toggle.press('Space')
    await expect.poll(async () => Math.abs((await panel.boundingBox())!.width - defaultWidth)).toBeLessThan(1)
  }
})
