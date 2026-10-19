import { test, expect, type Page } from '@playwright/test'
import { injectGalleryUserscript } from './helpers'

async function setClipboard(page: Page, text: string): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => value } })
  }, text)
}

test('導入標籤按命名空間分列、去重，候選不預先選取且只能投正向票', async ({ page }) => {
  await injectGalleryUserscript(page)
  const taglist = page.locator('.eqt-gallery-taglist')
  const chips = taglist.locator('.eqt-gallery-chip')
  // fixture 裡 parody 是實線，female / male 是虛線
  const solid = 'parody:neon genesis evangelion'
  const female = 'female:sole female'
  const male = 'male:sole male'
  // EH 對有別名的標籤，chip 上的字是「原名 | 別名」，原名只在 onclick 裡
  const chip = (tier: string, id: number, nsRaw: string, text = nsRaw.slice(nsRaw.indexOf(':') + 1)): string => (
    `<div class="${tier}"><a onclick="return toggle_tagmenu(${id},'${nsRaw}',this)">${text}</a></div>`
  )
  const other = [
    '<h1 id="gn">Other gallery</h1>',
    '<div id="taglist"><table><tr><td>',
    chip('gt', 1, solid, 'neon genesis evangelion | some alias'),
    chip('gt', 2, female),
    chip('gtl', 3, male),
    chip('gtl', 4, 'other:imported only'),
    chip('gtw', 5, 'female:weak import'),
    chip('gt', 6, 'language:translated'),
    '</td></tr></table></div>',
  ].join('')
  await page.route('https://e-hentai.org/g/1002/bbbbbbbbbb/', (route) => (
    route.fulfill({ contentType: 'text/html', body: other })
  ))

  const importBtn = page.locator('.eqt-gallery-actions__btn--import')
  await setClipboard(page, 'https://e-hentai.org/g/1002/bbbbbbbbbb/')
  await importBtn.click()

  const tag = (nsRaw: string) => taglist.locator(`.eqt-gallery-chip[data-ns-raw="${nsRaw}"]`)
  const lead = (nsRaw: string) => tag(nsRaw).locator('.eqt-gallery-chip__lead svg')
  await expect(tag('other:imported only')).toBeVisible()
  await expect(importBtn).toBeEnabled()

  // 語言標籤不導入
  await expect(tag('language:translated')).toHaveCount(0)

  // 已有的標籤不重複列出，只看別本的線型在 chip 開頭掛記號；這本已經是實線的不掛
  for (const nsRaw of [solid, female, male]) await expect(tag(nsRaw)).toHaveCount(1)
  await expect(lead(solid)).toHaveCount(0)
  await expect(tag('other:imported only')).toHaveClass(/eqt-gallery-chip--gtl/)
  await expect(tag('female:weak import')).toHaveClass(/eqt-gallery-chip--gtw/)

  const labels = taglist.locator('.eqt-gallery-taglist__label')
  const cells = taglist.locator('.eqt-gallery-taglist__cells')
  const femaleAt = (await labels.allTextContents()).findIndex(text => text.trim() === '女:')
  await expect(labels.nth(femaleAt + 1)).toHaveText('')
  await expect(cells.nth(femaleAt + 1).locator(':scope > :first-child')).toHaveClass(/eqt-gallery-chip/)
  await expect(cells.nth(femaleAt + 1).locator('.eqt-gallery-chip[data-ns-raw="female:weak import"]')).toBeVisible()
  await expect(labels.last()).toHaveText('其他:')
  await expect(labels.last().locator('svg')).toHaveCount(0)
  await expect(cells.last().locator(':scope > :first-child')).toHaveClass(/eqt-gallery-chip/)

  await expect(chips.and(page.locator('[class*="--selected-"]'))).toHaveCount(0)
  await expect(page.locator('.eqt-gallery-actions__btn--vote .eqt-gallery-actions__count')).toHaveText(['0', '0'])

  // 候選最低只到不選，右鍵不會變成負向
  const candidate = tag('other:imported only').locator('.eqt-gallery-chip__body')
  await candidate.click({ button: 'right' })
  await expect(tag('other:imported only')).not.toHaveClass(/--selected-/)
  await candidate.click()
  await expect(tag('other:imported only')).toHaveClass(/--selected-positive/)
  await expect(page.locator('.eqt-gallery-actions__btn--vote .eqt-gallery-actions__count')).toHaveText(['1', '0'])
})

test('剪貼簿裡不是圖庫網址時，toast 回顯實際讀到的文字，不發出請求', async ({ page }) => {
  await injectGalleryUserscript(page)
  let fetched = false
  await page.route('https://e-hentai.org/g/**', (route) => {
    fetched = true
    return route.abort()
  })
  await setClipboard(page, '  not a gallery link  ')
  await page.locator('.eqt-gallery-actions__btn--import').click()
  await expect(page.locator('.Vue-Toastification__toast')).toContainText('剪貼簿裡的不是圖庫網址：not a gallery link')
  expect(fetched).toBe(false)
})

test('導入按鈕跟新增標籤同一列、均分寬度', async ({ page }) => {
  await injectGalleryUserscript(page)
  const importBox = (await page.locator('.eqt-gallery-actions__btn--import').boundingBox())!
  const add = (await page.locator('.eqt-gallery-actions__btn--add').boundingBox())!
  expect(importBox.width).toBeCloseTo(add.width, 0)
  expect(importBox.y).toBeCloseTo(add.y, 0)
})
