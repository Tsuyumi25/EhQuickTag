import { test, expect } from '@playwright/test'
import { injectUserscript } from './helpers'

// === 換行判定必須用「中英各自累加」而非「逐項最大」===
//
// 不變式是「同一個分組在中文成立、且在英文也成立」。逐項取 max(w_zh, w_en) 累加
// 是它的充分條件但非必要條件——sum(max(aᵢ,bᵢ)) ≥ max(sum aᵢ, sum bᵢ)，只要同一行
// 內「哪個語言較寬」不一致，逐項最大就會為一個永遠不會被渲染的混合狀態排版，兩種
// 語言下都提早換行。
//
// 這條測試需要一組「較寬的語言不一致」的 term 才有鑑別力：
//   other:non-h     zh 譯名 6 個 CJK 字 > en literal 11 個 ASCII  ⇒ 中文較寬
//   other:e2eplain  無譯名 ⇒ zh 退回裸 tag、en 是完整 ns:tag      ⇒ 英文較寬
// 兩者同 namespace 才會落進同一次 chunk 呼叫。
//
// 容器寬度不寫死：先量出兩種語言各自的合計與逐項最大合計，取中間值注入，讓兩種
// 演算法對這個寬度必定給出不同答案。fixture 若哪天不再具鑑別力（例如譯名被改短），
// 前置斷言會直接失敗，而不是讓測試靜默退化成永遠通過。
const INITIAL_SEARCH = 'other:non-h other:e2eplain'

// row 內的 chip；不含 useTextMeasure 掛在 containerRef 上的 ruler clone
const CHIP = '.eqt-search-panel__cells-row .eqt-search-panel__button'

// 找到含指定文字的 chip 所屬的 cells，回報它被切成幾條 row 與每顆 chip 的寬度
const READ_GROUP = (needle: string) => {
  // 這個函式在瀏覽器內執行，拿不到模組層的 CHIP，字串自己再寫一次
  const CHIP = '.eqt-search-panel__cells-row .eqt-search-panel__button'
  // 一律收斂到 SearchPanel 這棵樹、且只認 row 內的 chip——useTextMeasure 的 ruler
  // 是 chip 的 cloneNode，class 一模一樣、textContent 停在最後量過的字串，
  // 掛在 containerRef 底下而不在任何 row 裡，不排除掉會混進查詢結果
  const panel = document.querySelector('.eqt-search-panel')
  if (!panel) return null
  const cellsList = Array.from(
    panel.querySelectorAll('.eqt-search-panel__cells'),
  ) as HTMLElement[]
  const cells = cellsList.find(c =>
    Array.from(c.querySelectorAll(CHIP)).some(b =>
      (b.textContent ?? '').includes(needle),
    ),
  )
  if (!cells) return null
  const itemRow = cells.querySelector('.eqt-search-panel__cells-row') as HTMLElement | null
  return {
    rowCount: cells.querySelectorAll('.eqt-search-panel__cells-row').length,
    // gap 跟著 SCSS 走，不在這裡寫死——寫死等於把這次剛從產品程式碼移除的漂移源
    // 原封不動搬進測試，SCSS 一改就會算出錯的注入寬度
    gap: itemRow ? parseFloat(getComputedStyle(itemRow).columnGap) || 0 : 0,
    widths: (
      Array.from(cells.querySelectorAll(CHIP)) as HTMLElement[]
    ).map(b => b.getBoundingClientRect().width),
  }
}

test('較寬的語言不一致時，整行不該提早換行', async ({ page }) => {
  await injectUserscript(page, INITIAL_SEARCH)
  // 譯名要等 tagDb 載入才會出現；用它當「chunk 已經吃到最終寬度」的訊號
  await expect(
    page.locator(`.eqt-search-panel ${CHIP}`, { hasText: '全年齡向作品' }),
  ).toBeVisible()

  const zh = await page.evaluate(READ_GROUP, '全年齡向作品')
  const toggle = page.locator('.eqt-search-controls__lang-toggle').first()
  await toggle.click()
  await expect(page.locator(`.eqt-search-panel ${CHIP}`, { hasText: 'other:non-h' })).toBeVisible()
  const en = await page.evaluate(READ_GROUP, 'other:non-h')

  expect(zh, 'other 群組必須存在').not.toBeNull()
  expect(en, 'other 群組必須存在').not.toBeNull()
  const zhW = zh!.widths
  const enW = en!.widths
  expect(zhW.length, '這條測試要兩顆 chip 才有意義').toBe(2)
  expect(enW.length).toBe(2)

  const gap = zh!.gap
  const sum = (ws: number[]): number => ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * gap
  const sumZh = sum(zhW)
  const sumEn = sum(enW)
  const sumMax = sum(zhW.map((w, i) => Math.max(w, enW[i])))
  const bothFit = Math.max(sumZh, sumEn)

  // 前置條件：fixture 真的造出「逐項最大 > 兩語言各自合計」的落差，否則本測試無鑑別力
  expect(
    sumMax - bothFit,
    `fixture 已失去鑑別力：逐項最大 ${sumMax.toFixed(1)} 沒有大於兩語言合計 ${bothFit.toFixed(1)}，`
      + `代表沒有任何一顆 chip 是中文較寬`,
  ).toBeGreaterThan(2)

  // 取中間值：兩語言各自都塞得下，但逐項最大塞不下
  const limit = Math.round((bothFit + sumMax) / 2)
  await page.evaluate((px) => {
    const s = document.createElement('style')
    s.textContent = `.eqt-search-panel .eqt-search-panel__cells{max-width:${px}px}`
    document.head.appendChild(s)
    window.dispatchEvent(new Event('resize'))
  }, limit)

  // 兩種語言都必須維持單行——逐項最大會在這個寬度拆成兩行
  await expect
    .poll(async () => (await page.evaluate(READ_GROUP, 'other:non-h'))?.rowCount, {
      message: `英文模式 @${limit}px 應維持單行（兩語言合計 ${bothFit.toFixed(1)}、逐項最大 ${sumMax.toFixed(1)}）`,
    })
    .toBe(1)

  await toggle.click()
  await expect
    .poll(async () => (await page.evaluate(READ_GROUP, '全年齡向作品'))?.rowCount, {
      message: `中文模式 @${limit}px 應維持單行`,
    })
    .toBe(1)
})
