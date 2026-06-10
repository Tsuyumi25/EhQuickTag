import { test, expect } from '@playwright/test'
import { injectUserscript } from './helpers'

test('TagBar mount 出現在 EH form 內', async ({ page }) => {
  await injectUserscript(page)
  await expect(page.locator('.eqt-tag-bar')).toBeVisible()
})

test('預設標籤組顯示在 profile carousel', async ({ page }) => {
  await injectUserscript(page)
  await expect(page.locator('.eqt-tag-bar__profile-split-name'))
    .toContainText('預設標籤組')
})

test('在 EH input 打字後 SearchPanel 出現對應 chip', async ({ page }) => {
  await injectUserscript(page)
  await page.locator('#f_search').fill('language:chinese')
  await expect(page.locator('.eqt-search-panel__button').first()).toBeVisible()
})

test('進編輯模式後出現新增行 / 分隔線 split', async ({ page }) => {
  await injectUserscript(page)
  await page.locator('.eqt-tag-bar__ctrl--toggle').click()
  await expect(page.locator('.eqt-tag-bar__line-add')).toBeVisible()
})

test('原生 search row 跟 TagBar __lines 左右切齊', async ({ page }) => {
  await injectUserscript(page)

  // .eqt-tag-bar__lines 跟 .eqt-native-search-row 是 ehFormHost 注入後的兩列。
  // 兩個 boundingBox.x 一致 = 視覺左切齊；x + width 一致 = 右切齊。
  // 差 1px 容忍 sub-pixel 量測誤差
  const native = page.locator('.eqt-native-search-row')
  const lines = page.locator('.eqt-tag-bar__lines')
  await expect(native).toBeVisible()
  await expect(lines).toBeVisible()

  const nativeBox = await native.boundingBox()
  const linesBox = await lines.boundingBox()
  expect(nativeBox).not.toBeNull()
  expect(linesBox).not.toBeNull()
  expect(Math.abs(nativeBox!.x - linesBox!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((nativeBox!.x + nativeBox!.width) - (linesBox!.x + linesBox!.width))).toBeLessThanOrEqual(1)
})
