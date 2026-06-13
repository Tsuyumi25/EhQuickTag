import { ref, onMounted, type Ref, type WatchSource } from 'vue'
import { useResizeObserver, useEventListener } from '@vueuse/core'
import { useTextMeasure } from '@/composables/useTextMeasure'

// === 中英 wrap 對齊：JS chunk 模擬 flex-wrap ===
//
// 設計：每個 item 量「兩語言版本」的渲染寬度 cache 起來，分組時用
// max(w_zh, w_en) 累加模擬 flex-wrap，JS 切出 row 分組，外部按該分組 render
// （每 row flex-nowrap）。同 item 在中英切換時必定落在同一相對位置。
//
// 量測底層走 useTextMeasure（canvas measureText + visible item metrics）。本檔
// 只負責 chunk 邏輯跟 container width 量測

export interface UseBilingualWrapOptions {
  containerRef: Ref<HTMLElement | null>
  /** containerRef 內取 metrics 用的 item element selector（其字型/padding/border 套用全列） */
  itemSelector: string
  /** containerRef 內取容器寬度用的 row element selector（決定 row 寬度） */
  rowSelector: string
  /** 任何能 signal「items 列表變動」的 reactive 來源——term 從無到有時觸發 metrics 重抓 */
  itemsSignal: WatchSource | WatchSource[]
  /** flex gap，預設 4（跟舊版 CELLS_GAP 同步） */
  gap?: number
}

export function useBilingualWrap(opts: UseBilingualWrapOptions) {
  const gap = opts.gap ?? 4
  const containerWidth = ref(0)

  const { getWidth, version } = useTextMeasure({
    containerRef: opts.containerRef,
    itemSelector: opts.itemSelector,
    itemsSignal: opts.itemsSignal,
  })

  // 量測 reactive trigger 集中在這個 helper：所有 chunk callback 走這條路，
  // metrics / fonts.ready 重設後自動讓上游 computed 重算
  function bilingualMaxWidth(zh: string, en: string): number {
    void version.value
    return Math.max(getWidth(zh), getWidth(en))
  }

  function chunk<T>(items: T[], getMaxWidth: (item: T) => number): T[][] {
    if (items.length === 0) return []
    // 容器寬度未知時不分組（單行 fallback，CSS 會處理 overflow 為 1 幀過渡態）
    if (containerWidth.value <= 0) return [items]
    const rows: T[][] = [[]]
    let rowWidth = 0
    for (const item of items) {
      const w = getMaxWidth(item)
      const next = rowWidth === 0 ? w : rowWidth + gap + w
      if (next > containerWidth.value && rowWidth > 0) {
        rows.push([item])
        rowWidth = w
      } else {
        rows[rows.length - 1].push(item)
        rowWidth = next
      }
    }
    return rows
  }

  function chunkBilingual<T>(
    items: T[],
    getZh: (item: T) => string,
    getEn: (item: T) => string,
  ): T[][] {
    return chunk(items, item => bilingualMaxWidth(getZh(item), getEn(item)))
  }

  function refreshContainerWidth(): void {
    if (!opts.containerRef.value) return
    const firstRow = opts.containerRef.value.querySelector(opts.rowSelector) as HTMLElement | null
    if (firstRow) containerWidth.value = firstRow.clientWidth
  }

  // containerRef 可能是 display: contents 元素（SearchTermRows flat 模式）——
  // ResizeObserver 對沒 layout box 的元素不 fire，所以額外掛 window resize 當
  // fallback。對普通 box container（SearchPopup 內的獨立 grid）也無害、頂多兩條
  // 路徑都觸發 refresh，refreshContainerWidth 是 idempotent
  useResizeObserver(opts.containerRef, refreshContainerWidth)
  useEventListener(window, 'resize', refreshContainerWidth)
  onMounted(refreshContainerWidth)

  return {
    chunkBilingual,
  }
}
