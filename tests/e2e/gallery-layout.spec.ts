import { test, expect } from '@playwright/test'
import { injectGalleryUserscript } from './helpers'

// 護的是「版面被外力擾動時我方 UI 不垮」，不是相容特定腳本——用泛用 CSS/DOM 擾動重現
// 失效模式，不 import 外部腳本原文。守兩條易被誤刪的 scss guard：anchor height:330、
// #gmid #gd5 float restore。

test('gallery taglist 接管並渲染 chip', async ({ page }) => {
  await injectGalleryUserscript(page)
  await expect(page.locator('.eqt-gallery-taglist')).toBeVisible()
  await expect(page.locator('.eqt-gallery-chip__body').first()).toBeVisible()
})

test('#gmid 失去固定高時 taglist 仍撐滿（ExResurrect）', async ({ page }) => {
  await injectGalleryUserscript(page)
  const taglist = page.locator('.eqt-gallery-taglist')
  await expect(taglist).toBeVisible()
  const before = (await taglist.boundingBox())!.height

  // #gmid 被設 height:unset 時，若 anchor 用 height:100% 會跟著塌；自釘 330 不受影響。
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#gmid')!.style.height = 'unset'
  })

  const after = (await taglist.boundingBox())!.height
  // 沒守衛時會塌回內容高（本 fixture ~127px）；守衛在時應接近原高
  expect(after).toBeGreaterThan(before - 5)
  expect(after).toBeGreaterThan(200)
})

test('#gd5 被拆成 full-width 時 chip 仍可點（exhentai-enhancer）', async ({ page }) => {
  // 外部把 #gd5 拆成滿版 block（float:unset;width:auto）；#gmid #gd5{float:left}（2 ids）
  // 把它縮回窄側欄，不再疊上 taglist。
  await injectGalleryUserscript(page, { externalCss: 'div#gd5{float:unset;width:auto}' })
  const chip = page.locator('.eqt-gallery-chip__body').first()
  await expect(chip).toBeVisible()

  const stack = await page.evaluate(() => {
    const el = document.querySelector('.eqt-gallery-chip__body')!
    const r = el.getBoundingClientRect()
    let node = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    let inGd5 = false
    let inAnchor = false
    while (node) {
      if (node.id === 'gd5') inGd5 = true
      if (node.id === 'eqt-gallery-anchor') inAnchor = true
      node = node.parentElement
    }
    return { inGd5, inAnchor }
  })
  expect(stack.inGd5).toBe(false)
  expect(stack.inAnchor).toBe(true)

  // 硬斷言：Playwright 實際點擊——被 gd5 攔截時 actionability 檢查會 timeout
  await chip.click({ timeout: 3000 })
})

test('#gd5 被設 position:relative + z-index:3 時 intro panel 仍在最上層（EhSyringe）', async ({ page }) => {
  // panel 是 #gd5 的子元素（Teleport 進去），活在 gd5 自己的 stacking context 裡——
  // 外部給 gd5 加 z-index 只改 gd5 在 #gmid 的層級，不影響 panel 蓋在 gd5 內容之上。
  await injectGalleryUserscript(page, { externalCss: '#gd5{position:relative;z-index:3}' })
  await page.locator('.eqt-gallery-chip__body').first().click()
  const panel = page.locator('.eqt-intro-panel')
  await expect(panel).toBeVisible()

  const onTop = await page.evaluate(() => {
    const el = document.querySelector('.eqt-intro-panel')!
    const r = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
  })
  expect(onTop).toBe(true)
})
