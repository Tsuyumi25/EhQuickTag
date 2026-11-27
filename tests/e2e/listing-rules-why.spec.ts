import { test, expect, type Page } from '@playwright/test'
import { injectUserscript } from './helpers'

// 一條「含 male:positive-sample 就在縮圖上顯示規則名稱」的規則，加上一張帶這個標籤的縮圖卡片
const RULES = '{"schema":1,"rules":[{"id":1,"name":"示範規則","enabled":true,"root":{"id":4,"kind":"group","mode":"all","negate":false,"conditions":[{"id":3,"kind":"tag","tag":"male:positive-sample","exclude":false}]},"actions":{"background":null,"dim":0,"blur":0,"blurMode":"blur","showName":true,"prefix":null,"prefixColor":null,"prefixBackground":null,"prefixRadius":3,"titleColor":null,"titleBackground":null,"titleRadius":3,"strike":false,"underline":false,"bold":false,"italic":false,"hide":false}}]}'

async function injectThumbnailWithRule(page: Page): Promise<void> {
  await page.addInitScript((rules) => {
    localStorage.setItem('eqt-test:eqt_gallery_rules', JSON.stringify(rules))
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.setAttribute('data-evr-version', 'test')
      const grid = document.createElement('div')
      grid.className = 'itg gld'
      grid.innerHTML = '<div class="gl1t" data-evr-tags=\'[{"name":"male:positive-sample"}]\'>'
        + '<a href="https://e-hentai.org/g/1001/aaaaaaaaaa/"><div class="glname"><span class="glink">Sample gallery</span></div></a>'
        + '<div class="gl6t"></div></div>'
      document.body.prepend(grid)
    })
  }, RULES)
  await injectUserscript(page)
}

for (const via of ['關閉按鈕', 'Escape'] as const) {
  test(`點規則名稱開規則頁、用${via}關掉後，說明不會自己浮著；滑鼠再移上去照常浮出`, async ({ page }) => {
    await injectThumbnailWithRule(page)
    const label = page.locator('.eqt-listing-rules__label').first()
    const why = page.locator('.eqt-listing-rules__why')
    await label.hover()
    await expect(why).toBeVisible()

    await label.locator('.eqt-gallery-chip__body').click()
    await expect(page.locator('.eqt-rule-page')).toBeVisible()
    if (via === 'Escape') {
      await page.mouse.move(5, 5)
      await page.keyboard.press('Escape')
    } else {
      await page.locator('.eqt-rule-page__close').click()
    }
    await expect(page.locator('.eqt-rule-page')).toHaveCount(0)
    // 規則頁把焦點還給規則名稱是對的，說明不該跟著浮出來
    await expect(label.locator('.eqt-gallery-chip__body')).toBeFocused()
    await expect(why).toHaveCount(0)

    await label.hover()
    await expect(why).toBeVisible()
  })
}
