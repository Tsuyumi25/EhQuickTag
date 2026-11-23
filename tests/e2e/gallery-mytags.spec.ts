import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { injectGalleryUserscript } from './helpers'

const MYTAGS_HTML = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/eh-mytags.html'), 'utf-8')

test('My Tags 模式把動作列翻成編輯列：單選左鍵、設定留著、新增送到選定的組，離開時還回原本的選取', async ({ page }) => {
  await injectGalleryUserscript(page)

  // 新增的回應就是新的 /mytags：把送來的那一列接在 fixture 最後，跟 EH 收下時一樣
  const posts: { url: string; body: URLSearchParams }[] = []
  await page.route(/\/mytags(\?.*)?$/, (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fallback()
    const body = new URLSearchParams(request.postData() ?? '')
    posts.push({ url: request.url(), body })
    const row = [
      '<div id="usertag_99">',
      `<span id="tagpreview_99" title="${body.get('tagname_new')}"></span>`,
      `<input id="tagweight_99" type="text" value="${body.get('tagweight_0')}">`,
      '<input id="tagcolor_99" type="text" value="">',
      `<input id="tagwatch_99" type="checkbox"${body.has('tagwatch_0') ? ' checked' : ''}>`,
      '<input id="taghide_99" type="checkbox">',
      '</div>',
    ].join('')
    const html = MYTAGS_HTML.replace(/(<div id="usertag_4">[\s\S]*?<\/div>)/, `$1${row}`)
    return route.fulfill({ contentType: 'text/html', body: html })
  })

  const chips = page.locator('.eqt-gallery-taglist .eqt-gallery-chip')
  await expect(chips.first()).toBeVisible()
  const nsRaw = async (i: number) => (await chips.nth(i).getAttribute('data-ns-raw'))!
  const first = await nsRaw(0)
  const second = await nsRaw(1)
  const third = await nsRaw(2)
  const body = (i: number) => chips.nth(i).locator('.eqt-gallery-chip__body')
  const selected = page.locator('.eqt-gallery-taglist .eqt-gallery-chip--selected')
  const votes = page.locator('.eqt-gallery-actions__btn--vote .eqt-gallery-actions__count')

  // 進來之前先多選：最後碰的那顆還選著，進模式後就從它開始
  await body(0).click()
  await body(1).click({ button: 'right' })
  await expect(votes).toHaveText(['1', '1'])

  await page.locator('.eqt-gallery-actions__split-btn--panel').click()
  const panel = page.locator('.eqt-gallery-mytags')
  await expect(page.locator('.eqt-gallery-actions')).toHaveCount(0)
  const name = panel.locator('.eqt-tag-draft__name')
  await expect(name).toHaveValue(second)
  await expect(selected).toHaveCount(1)

  // 左鍵換一顆，選取永遠只有它；右鍵不動
  await body(0).click()
  await expect(name).toHaveValue(first)
  await expect(selected).toHaveCount(1)
  await expect(chips.nth(0)).toHaveClass(/eqt-gallery-chip--selected-positive/)
  await body(2).click({ button: 'right' })
  await expect(name).toHaveValue(first)

  // 按住左鍵刷過去：一路換，放開停在最後碰到的那顆，選取仍然只有一顆；單擊不畫軌跡，刷了才畫
  const trail = page.locator('#eqt-paint-trail')
  await expect(trail).toHaveCount(0)
  const center = async (i: number) => {
    const box = (await body(i).boundingBox())!
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const from = await center(2)
  const to = await center(1)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await expect(name).toHaveValue(third)
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  await expect(name).toHaveValue(second)
  await expect(selected).toHaveCount(1)
  await expect(trail).toHaveCount(1)

  const watch = panel.locator('.eqt-taglist__flag input').first()
  await watch.check()
  await body(2).click()
  await expect(name).toHaveValue(third)
  await expect(watch).toBeChecked()

  await panel.locator('select').selectOption('2')
  const create = panel.locator('.eqt-tag-draft__create')
  await expect(create).toHaveText('新增標籤')
  await create.click()
  await expect(create).toHaveText('移動標籤')

  expect(posts).toHaveLength(1)
  expect(new URL(posts[0].url).searchParams.get('tagset')).toBe('2')
  expect(posts[0].body.get('usertag_action')).toBe('add')
  expect(posts[0].body.get('tagname_new')).toBe(third)
  expect(posts[0].body.get('tagwatch_0')).toBe('on')
  expect(posts[0].body.get('tagweight_0')).toBe('0')
  await expect(chips.nth(2)).toHaveClass(/eqt-gallery-chip--mytags-colored/)

  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(votes).toHaveText(['1', '1'])
  await expect(chips.nth(1)).toHaveClass(/eqt-gallery-chip--selected-negative/)
})
