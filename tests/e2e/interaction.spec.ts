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

// === Tier 1.5 / 新行為：「直接從 URL 進到帶 f_search 的頁面」mount initial 視同 submit ===
// 使用者點某個 EH tag link 直接跳到 ?f_search=foo、不需 off 也不需點搜尋按鈕。
// loadHistory 完那刻 recordSubmit 把當前 A 推進 H。回主頁（reload 但 f_search 變空）
// 後 visibleHistory 應該顯示 foo——舊行為（I2 + reclaim）會把 foo 從 H 排除 ⇒ 看不到
test('mount 初始已有 f_search、未 off、回主頁後 visible history 仍顯示該 term', async ({ page }) => {
  // artist:e2einitial 不在 default profile button 牆，visibleHistory 不會被
  // buttonIdentities 過濾掉
  await injectUserscript(page, 'artist:e2einitial')

  // chip 出現 + 是 Include 態（mount initial path）
  const chip = page.locator('.eqt-search-panel__button').filter({ hasText: 'e2einitial' }).first()
  await expect(chip).toBeVisible()
  await expect(chip).toHaveClass(/eqt-search-panel__button--include/)

  // loadHistory async → recordSubmit → schedulePersist 100ms debounce
  // storage 內出現 term 才代表新 push H 路徑跑了
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('eqt-test:eqt-search-history')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' && parsed.includes('artist:e2einitial')
  })

  // 「回主頁」= 新 page load、#f_search 預設空。reload 同 URL 是用同 path 再 mount，
  // 不會帶過去頁的 f_search value（fixture HTML 內 #f_search.value=""）
  await page.reload()
  await reinjectUserscript(page)

  await expect(page.locator('.eqt-tag-bar')).toBeVisible()
  await expect(page.locator('#f_search')).toHaveValue('')

  // sessionTerms 空 ⇒ visibleHistory 投影出 e2einitial 為 ghost chip
  await expect(page.locator('.eqt-search-panel__label', { hasText: '歷史' })).toBeVisible()
  await expect(
    page.locator('.eqt-search-panel__button--ghost').filter({ hasText: 'e2einitial' })
  ).toBeVisible()
})

// === Tier 1.5 / 新行為：逐字 typing 不污染 history（trade-off 守門）===
// 新 model 把 H push 觸發點收成「mount initial + submit + dismiss」三條，
// syncFromSearch 不再順便 push。pressSequentially delay 5ms + Vue watcher batched
// 在 microtask 內 ⇒ syncFromSearch 可能直接 sync 最終態、中間態根本沒進過
// sessionTerms。分段 fill + await chip 文字同步是「中間態確實存在過」的證據；
// 每段檢查 storage 仍是 null 才能證明「entry 從 sessionTerms 被 syncFromSearch
// 丟掉時沒被誤 push 進 H」這條 trade-off 真的守住
test('逐字 typing 完整 token 不污染 history（中間態 a:e2t / a:e2te 不進 H）', async ({ page }) => {
  await injectUserscript(page)

  const input = page.locator('#f_search')
  const firstChip = page.locator('.eqt-search-panel__button').first()
  const storageState = () =>
    page.evaluate(() => localStorage.getItem('eqt-test:eqt-search-history'))

  // 中間態 a:e2t → syncFromSearch 出 entry [a:e2t, active]
  await input.fill('a:e2t')
  await expect(firstChip).toContainText('e2t')
  expect(await storageState()).toBeNull()  // syncFromSearch 不該誤 push

  // 中間態 a:e2te → 前 entry 不在 T 被丟、新 entry [a:e2te] append
  // 若 syncFromSearch 在「丟舊 entry」路徑上誤 push H，這裡會看到 a:e2t 進 storage
  await input.fill('a:e2te')
  await expect(firstChip).toContainText('e2te')
  expect(await storageState()).toBeNull()

  // 中間態 a:e2tes
  await input.fill('a:e2tes')
  await expect(firstChip).toContainText('e2tes')
  expect(await storageState()).toBeNull()

  // 完整 token a:e2test
  await input.fill('a:e2test')
  await expect(firstChip).toContainText('e2test')
  expect(await storageState()).toBeNull()

  // 再 append 第二個 token，中間態 a:e2test a:e2b
  await input.fill('a:e2test a:e2b')
  const chips = page.locator('.eqt-search-panel__button')
  await expect(chips).toHaveCount(2)
  await expect(chips.nth(1)).toContainText('e2b')
  expect(await storageState()).toBeNull()

  // 完整態 a:e2test a:e2bar
  await input.fill('a:e2test a:e2bar')
  await expect(chips.nth(1)).toContainText('e2bar')
  expect(await storageState()).toBeNull()

  // 等過 schedulePersist debounce 視窗（100ms）確認真的沒人觸發 persist
  // ——只是補強，syncFromSearch 內 mutated=false 不會排 persist，這條 wait
  // 是 belt-and-suspenders
  await page.waitForTimeout(200)
  expect(await storageState()).toBeNull()

  // 歷史 row 不顯示（historyDisplays.length === 0）
  await expect(page.locator('.eqt-search-panel__label', { hasText: '歷史' })).not.toBeVisible()
})

// === Tier 1.5 / fix #1：mount async gap 期間 typing 中間態不進 H ===
// loadHistory 是 onMounted 觸發的 async path，await cacheGet 期間 watch 可能 fire
// 把 sessionTerms 同步成 typing 中間態。修法：setup top-level snapshot initialSubmittedIds，
// loadHistory 完後 recordSubmit(initialSubmittedIds) 限制只 push「mount 那一刻已存在」
// 的 id 子集。修前：mid-type term 會混進 H；修後：只有 initial term 進 H
test('mount 後立刻 typing 中間態不被 mount-initial recordSubmit 推進 H', async ({ page }) => {
  await injectUserscript(page, 'artist:e2init')
  // 立刻在 cacheGet 解析的 microtask gap 內改 #f_search
  // （不 await chip render，搶在 loadHistory recordSubmit 之前換 sessionTerms）
  await page.locator('#f_search').fill('artist:e2mid')

  // 等 chip 同步到 mid + storage 完成寫入（mount-initial recordSubmit 跑完）
  await expect(page.locator('.eqt-search-panel__button').filter({ hasText: 'e2mid' })).toBeVisible()
  await page.waitForFunction(() => localStorage.getItem('eqt-test:eqt-search-history') !== null)
  await page.waitForTimeout(150)  // 跨過 schedulePersist debounce 窗

  // storage 只該有 initial 那組 id（artist:e2init）；mid-type 'artist:e2mid'
  // 即使曾出現於 sessionTerms（async gap 後），recordSubmit 也被 initialSubmittedIds
  // 鎖住、不會 push
  //
  // GM mock 內 setValue 自己會 JSON.stringify、useSessionTerms 也 JSON.stringify
  // ⇒ localStorage 內是 double-stringified，要 parse 兩層才到 array
  const raw = await page.evaluate(() => localStorage.getItem('eqt-test:eqt-search-history'))
  expect(raw).not.toBeNull()
  const parsed = JSON.parse(raw!)
  const items: string[] = Array.isArray(parsed) ? parsed : JSON.parse(parsed)
  expect(items).toContain('artist:e2init')
  expect(items.some((p) => p.includes('e2mid'))).toBe(false)
})

// === Tier 1.5 / fix #2：clearHistory 後 backspace 掉 active token 不會冒出 ghost ===
// 舊版 clearHistory 保留 sessionTerms 對應條目（包括 A），導致使用者「我剛清歷史」
// 之後 backspace 掉 active token、那個 term 從 H 浮上 visible 變 ghost chip——
// 體感像「清掉怎麼又出來」。修法：clearHistory 改回只保留 O 對應條目
test('清歷史後 backspace 掉 active token 不會浮出 ghost chip', async ({ page }) => {
  await injectUserscript(page, 'artist:e2clr')
  await expect(page.locator('.eqt-search-panel__button').filter({ hasText: 'e2clr' })).toBeVisible()

  // 等 mount initial recordSubmit + persist 完成
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('eqt-test:eqt-search-history')
    return raw !== null && raw.includes('artist:e2clr')
  })

  // 點清歷史
  await page.getByTestId('clear-history').click()
  await page.waitForTimeout(150)

  // backspace 掉 active token
  await page.locator('#f_search').fill('')
  await expect(page.locator('#f_search')).toHaveValue('')

  // ghost chip 不該出現——舊版會冒出 artist:e2clr，新版 clearHistory 已把它清掉
  await expect(
    page.locator('.eqt-search-panel__button--ghost').filter({ hasText: 'e2clr' })
  ).not.toBeVisible()
  await expect(page.locator('.eqt-search-panel__label', { hasText: '歷史' })).not.toBeVisible()
})

// === Tier 1.5 / fix #3：submit 路徑 sync flush GM storage，不等 100ms debounce ===
// 修前 onSearchClick 走 schedulePersist 100ms 後才 cacheSet，form.submit() 同步
// navigate ⇒ unload 跟 cacheSet 競賽。修後 onSearchClick async + await
// recordSubmitAndFlush 確保 navigate 前 cacheSet 已 resolve。
// 這條 e2e mock form.submit 為 no-op 避開 navigation（mockEh 不接帶 query 的 URL），
// 驗 click 後不等 debounce、storage 立刻有值
test('search submit 後 history 同步寫入 GM storage（不等 debounce）', async ({ page }) => {
  await injectUserscript(page)
  // mock form.submit 為 no-op，避免帶 query 的 URL 觸發 mockEh abort
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('#f_search')?.form
    if (form) form.submit = () => {}
  })

  await page.locator('#f_search').fill('artist:e2nav')
  await expect(page.locator('.eqt-search-panel__button').filter({ hasText: 'e2nav' })).toBeVisible()

  // 點 submit；onSearchClick 是 async，await recordSubmitAndFlush 確保 cacheSet 已 resolve
  await page.getByTestId('search-submit').click()
  // 不 wait 100ms debounce 視窗，立刻查——修前 schedulePersist 還沒 fire、storage 空
  const raw = await page.evaluate(() => localStorage.getItem('eqt-test:eqt-search-history'))
  expect(raw).not.toBeNull()
  expect(raw!).toContain('artist:e2nav')
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
