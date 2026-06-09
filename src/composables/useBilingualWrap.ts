import { ref, watch, onMounted, nextTick, type Ref, type WatchSource } from 'vue'
import { useResizeObserver } from '@vueuse/core'

// === 中英 wrap 對齊：量測 + JS chunk ===
//
// 設計：每個 item 量「兩語言版本」的渲染寬度 cache 起來，分組時用
// max(w_zh, w_en) 累加模擬 flex-wrap，JS 切出 row 分組，外部按該分組 render
// （每 row flex-nowrap）。同 item 在中英切換時必定落在同一相對位置。
//
// Cache key 只用 text：canvas measureText 不受 state class 影響，padding/border
// 從 metrics 加上去（state class 變體目前不改 width-affecting 屬性）
//
// 量測策略：Canvas measureText。字型字串由我們從 visible item 一次性 compose
// 出來，不依賴 DOM 繼承——徹底繞掉 sandbox 元素的 CSS 變數 / font 繼承坑
// （sandbox 路線在 body 拿不到 SearchPanel 內 CSS var、在 container 內又會
// 量得偏小 3px 導致 row 邊界 overflow，canvas 直接從 ground truth 算 0 誤差）

interface ItemMetrics { font: string; padding: number; border: number }

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
  const measureVersion = ref(0)  // 字型載入完 invalidate cache 用

  const canvasCtx: CanvasRenderingContext2D | null = (() => {
    if (typeof document === 'undefined') return null
    return document.createElement('canvas').getContext('2d')
  })()

  const itemMetrics = ref<ItemMetrics | null>(null)
  const widthCache = new Map<string, number>()

  // 從一個 visible item 讀 ground truth：font 字串（含 size/family）、horizontal
  // padding、horizontal border。state class 變體不改 padding/border-width，這些
  // 值對所有 item 通用。讀不到時 metrics 留 null、量測返回 0、
  // chunk fallback 到「全塞一行」直到 metrics ready
  function refreshItemMetrics(): void {
    if (!opts.containerRef.value) return
    const item = opts.containerRef.value.querySelector(opts.itemSelector) as HTMLElement | null
    if (!item) return
    const cs = getComputedStyle(item)
    itemMetrics.value = {
      font: cs.font,
      padding: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
      border: parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth),
    }
  }

  function measureWidth(text: string): number {
    const m = itemMetrics.value
    if (!canvasCtx || !m) return 0
    canvasCtx.font = m.font
    const textW = canvasCtx.measureText(text).width
    // Math.ceil：subpixel 寬度 round up 避免累加誤差讓最後一個 item 推出容器
    return Math.ceil(textW + m.padding + m.border)
  }

  function getWidth(text: string): number {
    const cached = widthCache.get(text)
    if (cached !== undefined && cached > 0) return cached
    const w = measureWidth(text)
    if (w > 0) widthCache.set(text, w)
    return w
  }

  // 量測 reactive trigger 集中在這個 helper：所有 chunk callback 走這條路，
  // metrics / fonts.ready 重設後自動讓上游 computed 重算。
  // 新 callsite 漏掉 `void measureVersion.value` 不會默默 stale
  function bilingualMaxWidth(zh: string, en: string): number {
    void measureVersion.value
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

  useResizeObserver(opts.containerRef, refreshContainerWidth)

  onMounted(() => {
    refreshContainerWidth()

    // First render 時 visible item 已經出現（containerWidth=0 走 fallback 全塞一行），
    // 從中讀 metrics ground truth。讀完 bump 觸發 chunk 用精準寬度重算
    refreshItemMetrics()
    measureVersion.value++

    // 字型載入完 invalidate width cache：載入前讀到的 metrics font 可能還是
    // fallback font，等 real font ready 再讀一次 + 清 cache
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        refreshItemMetrics()
        widthCache.clear()
        measureVersion.value++
        void nextTick(refreshContainerWidth)
      })
    }
  })

  // item 從無到有時 onMounted 跑的 refreshItemMetrics 找不到 item 元素，itemMetrics
  // 留 null 鎖死。watch itemsSignal 在 list 變動後重抓——flush:'post' 確保 DOM
  // commit 後跑、有 item 元素可讀。讀到就 bump 觸發 chunk 重算
  watch(opts.itemsSignal, () => {
    if (itemMetrics.value) return
    refreshItemMetrics()
    if (itemMetrics.value) measureVersion.value++
  }, { flush: 'post' })

  return {
    chunkBilingual,
  }
}
