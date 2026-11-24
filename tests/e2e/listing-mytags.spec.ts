import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { injectUserscript } from './helpers'

const MYTAGS_HTML = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/eh-mytags.html'), 'utf-8')
const TAGS = ['male:positive-sample', 'other:fresh-sample', 'female:negative-sample']

test('dock 的 My Tags 翻成編輯列：列表標籤單選、新增後上色、改既有標籤，離開時還回原本的選取', async ({ page }) => {
  await page.addInitScript((tags) => {
    // 列表強化只在 EhViewRefined 在場時掛上；標籤 chip 也只認它畫出來的 [data-evr-tag]
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.setAttribute('data-evr-version', 'test')
      for (const cell of [...document.querySelectorAll('.itg td.glname')].slice(0, 2)) {
        const holder = document.createElement('div')
        for (const tag of tags) {
          const chip = document.createElement('div')
          chip.className = 'gt'
          chip.dataset.evrTag = tag
          chip.textContent = tag.slice(tag.indexOf(':') + 1)
          holder.append(chip)
        }
        cell.append(holder)
      }
    })
  }, TAGS)
  await injectUserscript(page)

  // 列表頁沒有 apiuid / apikey 全域變數：憑證只能從抓回來的 /mytags 的 inline script 讀
  const credentials = '<script>var apiuid = 4242;\nvar apikey = "0a1b2c3d";\nvar api_url = "https://e-hentai.org/api.php";</script>'
  const withCredentials = (html: string) => html.replace('</head>', `${credentials}</head>`)
  const posts: URLSearchParams[] = []
  await page.route(/\/mytags(\?.*)?$/, (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fulfill({ contentType: 'text/html', body: withCredentials(MYTAGS_HTML) })
    const body = new URLSearchParams(request.postData() ?? '')
    posts.push(body)
    const row = [
      '<div id="usertag_99">',
      `<span id="tagpreview_99" title="${body.get('tagname_new')}"></span>`,
      `<input id="tagweight_99" type="text" value="${body.get('tagweight_new')}">`,
      '<input id="tagcolor_99" type="text" value="#123456">',
      '<input id="tagwatch_99" type="checkbox"><input id="taghide_99" type="checkbox">',
      '</div>',
    ].join('')
    const html = MYTAGS_HTML.replace(/(<div id="usertag_4">[\s\S]*?<\/div>)/, `$1${row}`)
    return route.fulfill({ contentType: 'text/html', body: withCredentials(html) })
  })
  const writes: Record<string, unknown>[] = []
  await page.route('https://e-hentai.org/api.php', (route) => {
    writes.push(route.request().postDataJSON() as Record<string, unknown>)
    return route.fulfill({ contentType: 'application/json', body: '{}' })
  })

  const chip = (tag: string) => page.locator(`.eqt-listing-chip[data-evr-tag="${tag}"]`).first()
  const selected = page.locator('.eqt-listing-chip--selected')
  await chip(TAGS[0]).click()
  await chip(TAGS[2]).click({ button: 'right' })
  await expect(page.locator('.eqt-listing-rules__selection-count')).toContainText('2')

  await page.locator('.eqt-listing-rules__mytags').click()
  const editor = page.locator('.eqt-listing-rules__mytags-editor')
  await expect(page.locator('.eqt-listing-rules__dock')).toHaveCount(0)
  const name = editor.locator('.eqt-tag-draft__name')
  await expect(name).toHaveValue(TAGS[2])

  // 單選：點一顆只剩它（同名的每一顆一起亮）；按住刷過去停在最後一顆；右鍵不動
  await chip(TAGS[0]).click()
  await expect(name).toHaveValue(TAGS[0])
  const center = async (tag: string) => {
    const box = (await chip(tag).boundingBox())!
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const from = await center(TAGS[0])
  const to = await center(TAGS[1])
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
  await expect(name).toHaveValue(TAGS[1])
  await expect(selected).toHaveCount(2)
  await chip(TAGS[0]).click({ button: 'right' })
  await expect(name).toHaveValue(TAGS[1])

  const create = editor.locator('.eqt-tag-draft__create')
  await expect(create).toHaveText('新增標籤')
  await create.click()
  await expect(create).toHaveText('移動標籤')
  expect(posts.map(body => body.get('tagname_new'))).toEqual([TAGS[1]])
  await expect(chip(TAGS[1])).toHaveClass(/eqt-listing-chip--mytags-colored/)

  // 加完就是既有標籤：改權重之後存回去，走 setusertag，憑證來自 /mytags 文件
  const weight = editor.locator('.eqt-number-field__input')
  await weight.fill('5')
  await weight.press('Enter')
  await editor.locator('.eqt-mytags-quick__save').click()
  await expect(editor.locator('.eqt-mytags-quick__save')).toHaveCount(0)
  expect(writes).toEqual([expect.objectContaining({
    method: 'setusertag', apiuid: 4242, apikey: '0a1b2c3d', tagid: 99, tagweight: '5',
  })])

  await page.keyboard.press('Escape')
  await expect(editor).toHaveCount(0)
  await expect(page.locator('.eqt-listing-rules__selection-count')).toContainText('2')
  await expect(chip(TAGS[2])).toHaveClass(/eqt-listing-chip--selected/)
})
