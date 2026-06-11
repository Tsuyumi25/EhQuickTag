import { test, expect, type Page } from '@playwright/test'
import { injectUserscript } from './helpers'

// === SearchPanel 寬度回歸：cells 1fr 不可被 min-content 撐爆 ===
//
// 觸發條件：term group row + history row 都用同一個 `.eqt-search-panel__cells`
// 容器、row 用 flex-wrap: nowrap。沒 `min-width: 0` 時 grid 1fr 預設
// `minmax(auto, 1fr)`，auto = min-content = row 所有 item 寬度總和。在
// useBilingualWrap chunk 算完前 / 算偏小時，cells 欄會被某條 row 撐到大於 1fr
// 應有寬度，從 panel 右邊溢出；useBilingualWrap 又取樣 cells.clientWidth 連環
// 誤判。
//
// fixture 同時涵蓋 history（seed 進 GM storage）+ namespace group
// (initialSearch 注入 f_search 產生 active term)：兩種 row 共用同一個
// `.eqt-search-panel__cells` 容器跟同一條 SCSS 規則，任何 scoped 覆寫只 break
// 一種 row 的情境靠這條暴露。
//
// 三語言混雜 ASCII / CJK / hiragana 還原 token literal 跟 ns:tag 譯名的真實
// 字寬分布——只 ASCII 不會踩到 measureText vs DOM 量測差異。
//
// 不切「中文 / EN」toggle：fixture 用的 token 全部不在 tagDb fixture 內，
// findEntryByNsTag 必然 undefined ⇒ historyEntryTexts 兩種模式都 fallback 到
// literal、toggle 點下去 chip 文字不會變、layout 也不會 re-chunk，純粹是 noise
const HISTORY_SEED = [
  'uploader:demo_uploader_x',
  'other:測試分類',
  'これはとても長いタイトル文字列',
  '"SAMPLE"',
  'group:あいうえお',
  'artist:demo$',
  'other:範例',
]

// active term 出來覆蓋 namespace group cells（跟 history cells 共用 1fr
// min-content invariant）
const INITIAL_SEARCH = 'artist:demo_active$'

interface CellReport {
  cellsRight: number
  rowOverflows: { rowClient: number; sum: number }[]
}
interface LayoutDiag {
  panelRight: number
  reports: CellReport[]
}

async function assertCellsFitsPanel(page: Page, label: string): Promise<void> {
  // 先 poll 等 layout settle —— bare waitForTimeout 在 slow CI 容易抓到 mid-reflow。
  // 沒 settle 也 catch 掉繼續下去，讓 assertion 給詳細 diag（比 waitForFunction
  // 自己的無上下文 timeout 訊息有用）
  await page
    .waitForFunction(
      () => {
        const panel = document.querySelector('.eqt-search-panel') as HTMLElement | null
        const cellsList = document.querySelectorAll('.eqt-search-panel__cells')
        if (!panel || cellsList.length === 0) return false
        const panelRight = panel.getBoundingClientRect().right
        return Array.from(cellsList).every(
          (c) => (c as HTMLElement).getBoundingClientRect().right <= panelRight + 0.5,
        )
      },
      { timeout: 1500 },
    )
    .catch(() => {})

  // 兩條獨立 invariants：
  //   (1) 每個 cells 右邊不可超過 panel 右邊 —— grid 1fr 不能被 min-content 撐爆。
  //   (2) 每條 cells-row 內子元素 + gap 累積寬度不可超過 row clientWidth ——
  //       chunk 切錯時 row content 會凸出 row box（即使 cells 沒被撐爆）。
  // querySelectorAll iterate 全部 cells（namespace group + history），不只第一個。
  // gap 走 getComputedStyle 動態讀，避免寫死數值跟 SCSS 不同步
  const diag: LayoutDiag = await page.evaluate(() => {
    const panel = document.querySelector('.eqt-search-panel') as HTMLElement
    const panelRect = panel.getBoundingClientRect()
    const cellsList = Array.from(
      document.querySelectorAll('.eqt-search-panel__cells'),
    ) as HTMLElement[]

    const reports = cellsList.map((cells) => {
      const cellsRect = cells.getBoundingClientRect()
      const rows = Array.from(
        cells.querySelectorAll('.eqt-search-panel__cells-row'),
      ) as HTMLElement[]
      const rowOverflows = rows
        .map((r) => {
          const children = Array.from(r.children) as HTMLElement[]
          const gap = parseFloat(getComputedStyle(r).gap) || 0
          const sum =
            children.reduce((acc, c) => acc + c.getBoundingClientRect().width, 0)
            + Math.max(0, children.length - 1) * gap
          return { rowClient: r.clientWidth, sum }
        })
        .filter((r) => r.sum > r.rowClient + 0.5)
      return { cellsRight: cellsRect.right, rowOverflows }
    })
    return { panelRight: panelRect.right, reports }
  })

  for (let i = 0; i < diag.reports.length; i++) {
    const r = diag.reports[i]
    expect(
      r.cellsRight - diag.panelRight,
      `${label}: cells[${i}] 右邊(${r.cellsRight}) 超過 panel 右邊(${diag.panelRight})`,
    ).toBeLessThanOrEqual(0.5)
    expect(
      r.rowOverflows,
      `${label}: cells[${i}] row 子元素累積寬度超過 row clientWidth: ${JSON.stringify(r.rowOverflows)}`,
    ).toEqual([])
  }
}

test('history + namespace group cells 不橫向溢出', async ({ page }) => {
  // seed history 走 GM shim 用的 localStorage key。helpers.ts gmShimCode 內
  // GM.setValue 額外 JSON.stringify 一層 ⇒ 預灌時要 double-encode 對齊
  await page.addInitScript((items) => {
    localStorage.setItem(
      'eqt-test:eqt-search-history',
      JSON.stringify(JSON.stringify(items)),
    )
  }, HISTORY_SEED)

  await injectUserscript(page, INITIAL_SEARCH)

  // history label 出現代表 loadHistory 完成、history row 已 mount
  await expect(page.locator('.eqt-search-panel__label', { hasText: '歷史' })).toBeVisible()
  await expect(page.locator('.eqt-search-panel__button--ghost')).toHaveCount(HISTORY_SEED.length)
  // active term chip mount 完才能保證 namespace group cells 在 DOM 內
  await expect(
    page.locator('.eqt-search-panel__button:not(.eqt-search-panel__button--ghost)'),
  ).toHaveCount(1)

  await assertCellsFitsPanel(page, 'initial')
})
