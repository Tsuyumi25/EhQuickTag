import { test, expect } from '@playwright/test'
import { injectUserscript, reinjectUserscript } from './helpers'

// === Tier 1 / ①：左鍵 tag button → Include 切 Off、#f_search 雙向同步 ===
test('左鍵 tag button 切 Include / Off 並同步 #f_search', async ({ page }) => {
  await injectUserscript(page)

  // 預設 profile 第一行第一顆按鈕「中文」對應 l:chinese$
  const btn = page.locator('.eqt-tag-bar__btn').filter({ hasText: /^中文$/ }).first()
  await expect(btn).toBeVisible()
  await expect(btn).not.toHaveClass(/eqt-tag-bar__btn--include/)

  await btn.click()
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--include/)
  await expect(page.locator('#f_search')).toHaveValue(/l:chinese\$/)

  await btn.click()
  await expect(btn).not.toHaveClass(/eqt-tag-bar__btn--include/)
  await expect(page.locator('#f_search')).toHaveValue('')
})

// === Tier 1 / ②：右鍵 tag button cycle Include → Or → Exclude → Off ===
test('右鍵 tag button cycle 三態跟 token prefix 對齊', async ({ page }) => {
  await injectUserscript(page)

  const btn = page.locator('.eqt-tag-bar__btn').filter({ hasText: /^中文$/ }).first()
  await btn.click()  // Off → Include
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--include/)

  await btn.click({ button: 'right' })
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--or/)
  await expect(page.locator('#f_search')).toHaveValue(/~l:chinese\$/)

  await btn.click({ button: 'right' })
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--exclude/)
  await expect(page.locator('#f_search')).toHaveValue(/-l:chinese\$/)

  await btn.click({ button: 'right' })
  await expect(btn).not.toHaveClass(/eqt-tag-bar__btn--(include|or|exclude)/)
  await expect(page.locator('#f_search')).toHaveValue('')
})

// === Tier 1 / ③：clearSearch 順序競爭 — Off chip 留殘、history 推入 ===
test('clearSearch 後 SearchPanel chip 殘留為 Off、history 接住 term', async ({ page }) => {
  await injectUserscript(page)

  await page.locator('#f_search').fill('language:chinese')
  const chip = page.locator('.eqt-search-panel__button').filter({ hasText: /中文|chinese/ }).first()
  await expect(chip).toBeVisible()
  await expect(chip).toHaveClass(/eqt-search-panel__button--include/)

  // SearchPanel 的「清空搜尋框」按鈕（不是「清除歷史」也不是「搜尋」）
  await page.locator('.eqt-search-panel__text-btn', { hasText: '清空搜尋框' }).click()

  await expect(page.locator('#f_search')).toHaveValue('')
  // 順序若顛倒、syncFromSearch 會把 active entry 全丟、chip 直接消失。
  // chip 還在 + 狀態變 Off 才證明 markEntriesOff 先跑、emit 後 syncFromSearch 走
  // 「!active 保留」分支。注意：history 此刻被 hide（同 identity 還在 sessionTerms、
  // visibleHistory 過濾掉），不在這層斷言；history 持久化在下一個 test 覆蓋
  await expect(chip).toBeVisible()
  await expect(chip).not.toHaveClass(/eqt-search-panel__button--(include|or|exclude)/)
})

// === Tier 1 / ④：編輯模式 + 新增 tag button → TagBar 多出一顆 ===
test('編輯 → + 標籤 → 填寫 → 儲存 → TagBar 多一顆按鈕', async ({ page }) => {
  await injectUserscript(page)

  const allBtns = page.locator('.eqt-tag-bar__btn')
  const countBefore = await allBtns.count()

  await page.locator('.eqt-tag-bar__ctrl--toggle').click()
  await expect(page.locator('.eqt-tag-bar__line-add')).toBeVisible()

  // 「+ 標籤」是 ctrl-split 內第一顆，URL 是第二顆
  await page.locator('.eqt-tag-bar__ctrl-split-btn').first().click()
  await expect(page.locator('.eqt-popup-overlay')).toBeVisible()

  // 填 tag input（會自動 serializeTerm 寫進 rawText）
  await page.locator('.eqt-row__tag-input').first().fill('yuri')

  // primary 按鈕 = 儲存
  await page.locator('.eqt-popup__btn--primary').click()
  await expect(page.locator('.eqt-popup-overlay')).toBeHidden()

  await expect(allBtns).toHaveCount(countBefore + 1)
})

// === Tier 1 / ⑤：Search history 跨 reload 存活 ===
test('history 跨 reload 還留在 SearchPanel', async ({ page }) => {
  await injectUserscript(page)

  // 用 artist:e2etest——不在 default profile button 牆裡，reload 後 visibleHistory
  // 才不會被 buttonIdentities 過濾掉。default profile 用了 language / male
  // namespace 的 term，避開那些
  await page.locator('#f_search').fill('artist:e2etest')
  await page.locator('.eqt-search-panel__button').filter({ hasText: 'e2etest' }).first().waitFor()
  await page.locator('.eqt-search-panel__text-btn', { hasText: '清空搜尋框' }).click()
  // reload 前：term 在 history 但 visibleHistory 被 sessionTerms 同 identity 過掉、
  // 看不到 history row。reload 後 sessionTerms 重建為空、history 從 storage 載回、
  // visibleHistory 才會 surface
  await expect(page.locator('#f_search')).toHaveValue('')

  // schedulePersist 是 100ms debounce、reload 會拋掉 JS context → onScopeDispose
  // 沒機會 flush。等 localStorage 真的寫了再 reload
  await page.waitForFunction(() => localStorage.getItem('eqt-test:eqt-search-history') !== null)

  await page.reload()
  await reinjectUserscript(page)

  await expect(page.locator('.eqt-tag-bar')).toBeVisible()
  // loadHistory async；row 出現代表 storage round-trip + reclaim 後仍有 term 殘留
  await expect(page.locator('.eqt-search-panel__label', { hasText: '歷史' })).toBeVisible()
  await expect(page.locator('.eqt-search-panel__button--ghost').filter({ hasText: 'e2etest' })).toBeVisible()
})

// === Tier 1 / ⑥：--eqt-controls-w 鏈完整性（ResizeObserver → emit → CSS var）===
test('__lines 寬度 = bar 寬 − 2 × line-controls 寬', async ({ page }) => {
  await injectUserscript(page)

  await expect(page.locator('.eqt-tag-bar')).toBeVisible()
  // 等 ResizeObserver 量到 controls 寬度、setProperty 寫進 EH form 父層
  await page.waitForFunction(() => {
    const parent = document.querySelector('#f_search')?.parentElement?.parentElement
    if (!parent) return false
    const v = (parent as HTMLElement).style.getPropertyValue('--eqt-controls-w')
    return v && parseFloat(v) > 0
  })

  const barBox = await page.locator('.eqt-tag-bar').boundingBox()
  const linesBox = await page.locator('.eqt-tag-bar__lines').boundingBox()
  const controlsBox = await page.locator('.eqt-tag-bar__line-controls').first().boundingBox()
  expect(barBox && linesBox && controlsBox).toBeTruthy()

  // lines = bar - 2 × controls（容忍 2px sub-pixel）
  const expected = barBox!.width - 2 * controlsBox!.width
  expect(Math.abs(linesBox!.width - expected)).toBeLessThanOrEqual(2)
})

// === Tier 1.5：兩個 active chip、把第一顆切 Off、位置不變 ===
// SearchPanel chip 順序由 sessionTerms 推導；markEntriesOff 應該只把 entry.active
// 設 false 不動 array 位置。若 refactor 不小心改成 splice + push at end、第一顆 Off
// 後會跑到末尾，這條測試會 catch 到
test('chip 切 Off 後在原位殘留、不跑到末尾', async ({ page }) => {
  await injectUserscript(page)

  // artist namespace 不在 default profile button 牆，兩顆 chip 都會留在
  // SearchPanel artist row。順序：先 alpha 後 beta
  await page.locator('#f_search').fill('artist:alpha artist:beta')

  const chips = page.locator('.eqt-search-panel__button')
  const alphaChip = chips.filter({ hasText: 'alpha' })
  const betaChip = chips.filter({ hasText: 'beta' })
  await expect(alphaChip).toHaveClass(/eqt-search-panel__button--include/)
  await expect(betaChip).toHaveClass(/eqt-search-panel__button--include/)

  // 紀錄初始位置：alpha 在 beta 左邊
  const alphaX0 = (await alphaChip.boundingBox())!.x
  const betaX0 = (await betaChip.boundingBox())!.x
  expect(alphaX0).toBeLessThan(betaX0)

  // 點 alpha 切 Off
  await alphaChip.click()
  await expect(alphaChip).not.toHaveClass(/eqt-search-panel__button--(include|or|exclude)/)
  await expect(page.locator('#f_search')).toHaveValue(/artist:beta/)
  await expect(page.locator('#f_search')).not.toHaveValue(/artist:alpha/)

  // 位置不變：alpha 還在原 x、還在 beta 左邊
  const alphaX1 = (await alphaChip.boundingBox())!.x
  const betaX1 = (await betaChip.boundingBox())!.x
  expect(Math.abs(alphaX1 - alphaX0)).toBeLessThanOrEqual(1)
  expect(alphaX1).toBeLessThan(betaX1)
})
