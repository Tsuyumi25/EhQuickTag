import { test, expect } from '@playwright/test'
import { injectUserscript, reinjectUserscript } from './helpers'

// === Tier 1 / ①：左鍵 tag button → Include 切 Off、#f_search 雙向同步 ===
test('左鍵 tag button 切 Include / Off 並同步 #f_search', async ({ page }) => {
  await injectUserscript(page)

  // 預設 profile 第一行第一顆按鈕「中文」對應 l:chinese$
  const btn = page.locator('.eqt-tag-bar__btn').filter({ hasText: /^中文$/ }).first()
  await expect(btn).toBeVisible()
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--off/)

  await btn.click()
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--include/)
  await expect(page.locator('#f_search')).toHaveValue(/l:chinese\$/)

  await btn.click()
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--off/)
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
  await expect(btn).toHaveClass(/eqt-tag-bar__btn--off/)
  await expect(page.locator('#f_search')).toHaveValue('')
})

// === Tier 1 / ③：clearSearch 順序競爭 — Off chip 留殘、history 確實 push（即使 UI 隱藏）===
test('clearSearch 後 SearchPanel chip 殘留為 Off、history 寫入 storage', async ({ page }) => {
  await injectUserscript(page)

  // language:chinese 同 identity 進 default profile 的「中文」button 牆 —— 用這個
  // term 才能驗到「button 牆內 term 仍會 push 進 history」這條原本沒人守的 invariant。
  // UI 上 history row 被 visibleHistory 過濾（sessionTerms 同 identity）、看不到，
  // 改用 storage assert 直接驗 markEntriesOff 內 history.value.unshift 真的跑了
  await page.locator('#f_search').fill('language:chinese')
  const chip = page.locator('.eqt-search-panel__button').filter({ hasText: /中文|chinese/ }).first()
  await expect(chip).toBeVisible()
  await expect(chip).toHaveClass(/eqt-search-panel__button--include/)

  await page.getByTestId('clear-search').click()

  await expect(page.locator('#f_search')).toHaveValue('')
  // 順序若顛倒、syncFromSearch 會把 active entry 全丟、chip 直接消失。
  // chip 還在 + state 變 Off 才證明 markEntriesOff 先跑、emit 後 syncFromSearch 走
  // 「!active 保留」分支
  await expect(chip).toBeVisible()
  await expect(chip).toHaveClass(/eqt-search-panel__button--off/)

  // history 必須真的有 term（debounce flush 後 storage 看得到）；
  // 即使 visibleHistory UI 過掉，invariant「button 牆內 term 進 history」仍要守
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('eqt-test:eqt-search-history')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' && parsed.includes('language:chinese')
  })
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

  // 等 tag input 不再 disabled（loadTagDb 走完 mockEh fulfill 路徑 + buildIndex 後 dbReady=true）
  const tagInput = page.locator('.eqt-row__tag-input').first()
  await expect(tagInput).toBeEnabled()
  await tagInput.fill('yuri')

  // primary 按鈕 = 儲存
  await page.locator('.eqt-popup__btn--primary').click()
  await expect(page.locator('.eqt-popup-overlay')).toBeHidden()

  await expect(allBtns).toHaveCount(countBefore + 1)
})

// === Tier 1 / ⑤：Search history 跨 reload 存活 ===
test('history 跨 reload 還留在 SearchPanel', async ({ page }) => {
  await injectUserscript(page)

  // artist:e2etest 不在 default profile button 牆，reload 後 visibleHistory 不會被
  // buttonIdentities 過濾掉（test ③ 已 cover button 牆內路徑 via storage assert）
  await page.locator('#f_search').fill('artist:e2etest')
  await page.locator('.eqt-search-panel__button').filter({ hasText: 'e2etest' }).first().waitFor()
  await page.getByTestId('clear-search').click()
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
  await expect(alphaChip).toHaveClass(/eqt-search-panel__button--off/)
  await expect(page.locator('#f_search')).toHaveValue(/artist:beta/)
  await expect(page.locator('#f_search')).not.toHaveValue(/artist:alpha/)

  // 位置不變：alpha 還在原 x、還在 beta 左邊
  const alphaX1 = (await alphaChip.boundingBox())!.x
  const betaX1 = (await betaChip.boundingBox())!.x
  expect(Math.abs(alphaX1 - alphaX0)).toBeLessThanOrEqual(1)
  expect(alphaX1).toBeLessThan(betaX1)
})
