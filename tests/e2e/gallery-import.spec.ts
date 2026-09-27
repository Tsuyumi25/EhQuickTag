import { test, expect } from '@playwright/test'
import { injectGalleryUserscript } from './helpers'

test('導入的標籤按 ns 分列：已有的掛佐證記號，沒有的排進同 ns 底下的候選列，一顆都不預先選', async ({ page }) => {
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

  const input = page.locator('.eqt-gallery-actions__import')
  const toggle = page.locator('.eqt-gallery-actions__btn--import')
  await expect(input).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('placeholder', 'https://e-hentai.org/g/123456/0123456789/')
  await input.fill('https://e-hentai.org/g/1002/bbbbbbbbbb/')

  const tag = (nsRaw: string) => taglist.locator(`.eqt-gallery-chip[data-ns-raw="${nsRaw}"]`)
  const lead = (nsRaw: string) => tag(nsRaw).locator('.eqt-gallery-chip__lead svg')
  await expect(tag('other:imported only')).toBeVisible()
  await expect(input).toHaveValue('')

  // 語言標籤不導入
  await expect(tag('language:translated')).toHaveCount(0)

  // 已有的標籤不重複列出，只看別本的線型在 chip 開頭掛記號；這本已經是實線的不掛
  for (const nsRaw of [solid, female, male]) await expect(tag(nsRaw)).toHaveCount(1)
  await expect(lead(solid)).toHaveCount(0)
  await expect(lead(female)).toHaveClass(/lucide-circle-check/)
  await expect(lead(male)).toHaveClass(/lucide-circle-dashed-check/)
  await expect(tag(female).locator('.eqt-gallery-chip__body > :first-child')).toHaveClass(/eqt-gallery-chip__lead/)

  // 沒有的標籤當候選，開頭掛導入記號；邊框照別本的線型畫，點線也一樣
  for (const nsRaw of ['other:imported only', 'female:weak import']) {
    await expect(lead(nsRaw)).toHaveClass(/lucide-square-arrow-right-enter/)
  }
  await expect(tag('other:imported only')).toHaveClass(/eqt-gallery-chip--gtl/)
  await expect(tag('female:weak import')).toHaveClass(/eqt-gallery-chip--gtw/)

  // 候選列緊接在同 ns 的真標籤列底下，ns 欄畫 corner-left-up、cells 裡只有 chip；
  // 這本沒有的 ns 才在 ns 欄寫名稱
  const labels = taglist.locator('.eqt-gallery-taglist__label')
  const cells = taglist.locator('.eqt-gallery-taglist__cells')
  const femaleAt = (await labels.allTextContents()).findIndex(text => text.trim() === '女:')
  await expect(labels.nth(femaleAt + 1)).toHaveText('')
  await expect(labels.nth(femaleAt + 1).locator('svg')).toHaveClass(/lucide-corner-left-up/)
  await expect(cells.nth(femaleAt + 1).locator(':scope > :first-child')).toHaveClass(/eqt-gallery-chip/)
  await expect(cells.nth(femaleAt + 1).locator('.eqt-gallery-chip[data-ns-raw="female:weak import"]')).toBeVisible()
  await expect(labels.last()).toHaveText('其他:')
  await expect(labels.last().locator('svg')).toHaveCount(0)
  await expect(cells.last().locator(':scope > :first-child')).toHaveClass(/eqt-gallery-chip/)

  await expect(chips.and(page.locator('[class*="--selected-"]'))).toHaveCount(0)
  await expect(page.locator('.eqt-gallery-actions__vote-counts')).toHaveText('↑0 ↓0')

  // 候選最低只到不選，右鍵不會變成負向
  const candidate = tag('other:imported only').locator('.eqt-gallery-chip__body')
  await candidate.click({ button: 'right' })
  await expect(tag('other:imported only')).not.toHaveClass(/--selected-/)
  await candidate.click()
  await expect(tag('other:imported only')).toHaveClass(/--selected-positive/)
  await expect(page.locator('.eqt-gallery-actions__vote-counts')).toHaveText('↑1 ↓0')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(input).toHaveCount(0)
  await expect(tag('other:imported only')).toBeVisible()
})

test('記號依來源區分：手動新增 tag-plus、導入 square-arrow-right-enter，已有標籤的點線佐證用自製的點線勾', async ({ page }) => {
  await injectGalleryUserscript(page)
  await page.route('https://e-hentai.org/g/1002/bbbbbbbbbb/', (route) => route.fulfill({
    contentType: 'text/html',
    body: [
      '<h1 id="gn">Other</h1><div id="taglist"><table><tr><td>',
      '<div class="gt"><a onclick="return toggle_tagmenu(1,\'female:imported one\',this)">imported one</a></div>',
      '<div class="gtw"><a onclick="return toggle_tagmenu(2,\'male:sole male\',this)">sole male</a></div>',
      '</td></tr></table></div>',
    ].join(''),
  }))
  await page.locator('.eqt-gallery-actions__btn--add').click()
  await page.locator('.eqt-gallery-add-inline__input').fill('sample tag')
  await page.locator('.eqt-gallery-add-inline .eqt-popup__suggestion').filter({ hasText: 'sample tag' }).first().click()
  await page.locator('.eqt-gallery-actions__btn--import').click()
  await page.locator('.eqt-gallery-actions__import').fill('https://e-hentai.org/g/1002/bbbbbbbbbb/')

  const taglist = page.locator('.eqt-gallery-taglist')
  const lead = (nsRaw: string) => taglist.locator(`.eqt-gallery-chip[data-ns-raw="${nsRaw}"] .eqt-gallery-chip__lead svg`)
  await expect(lead('female:imported one')).toHaveClass(/lucide-square-arrow-right-enter/)
  await expect(lead('female:sample tag')).toHaveClass(/lucide-tag-plus/)
  await expect(lead('male:sole male')).toHaveClass(/lucide-circle-dotted-check/)
  const row = taglist.locator('.eqt-gallery-taglist__cells--candidate')
  await expect(row).toHaveCount(1)
  await expect(row.locator(':scope > svg')).toHaveCount(0)
})

test('導入網址欄是操作區第一列、橫跨整個寬度，導入按鈕跟新增標籤均分寬度', async ({ page }) => {
  await injectGalleryUserscript(page)
  const toggle = page.locator('.eqt-gallery-actions__btn--import')
  await toggle.click()
  const input = (await page.locator('.eqt-gallery-actions__import').boundingBox())!
  const add = (await page.locator('.eqt-gallery-actions__btn--add').boundingBox())!
  const toggleBox = (await toggle.boundingBox())!
  const search = (await page.locator('.eqt-gallery-actions__btn--search').boundingBox())!
  const vote = (await page.locator('.eqt-gallery-actions__btn--vote').boundingBox())!
  expect(toggleBox.width).toBeCloseTo(add.width, 0)
  expect(toggleBox.y).toBeCloseTo(add.y, 0)
  expect(input.x).toBeCloseTo(search.x, 0)
  expect(input.x + input.width).toBeCloseTo(vote.x + vote.width, 0)
  expect(search.y).toBeGreaterThan(input.y + input.height)
  expect(vote.y).toBeGreaterThan(input.y + input.height)
})
