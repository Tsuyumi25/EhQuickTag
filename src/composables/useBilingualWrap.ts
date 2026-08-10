import { ref, watch, onMounted, type Ref, type WatchSource } from 'vue'
import { useResizeObserver, useEventListener } from '@vueuse/core'
import { useTextMeasure } from '@/composables/useTextMeasure'

// === 中英 wrap 對齊：JS chunk 模擬 flex-wrap ===
//
// 設計：每個 item 量「兩語言版本」的渲染寬度 cache 起來，分組時用
// max(w_zh, w_en) 累加模擬 flex-wrap，JS 切出 row 分組，外部按該分組 render
// （每 row flex-nowrap）。同 item 在中英切換時必定落在同一相對位置。
//
// 量測底層走 useTextMeasure（clone 一顆真 chip 當 ruler，讀 layout engine 的實際
// 寬度）。本檔只負責 chunk 邏輯，以及 chunk 需要的兩個排版輸入——容器可用寬度跟
// item 間距，兩者都從 DOM 讀實際值，不接受 caller 傳入或寫死

export interface UseBilingualWrapOptions {
  containerRef: Ref<HTMLElement | null>
  /** containerRef 內取 metrics 用的 item element selector（其字型/padding/border 套用全列） */
  itemSelector: string
  /** containerRef 內取容器寬度用的 row element selector（決定 row 寬度） */
  rowSelector: string
  /**
   * containerRef 內「視覺一行」的 selector——chunk 拿它的 column-gap 當 item 間距。
   * 不從 rowSelector 那層讀：那是 flex-direction: column 容器，它的 column-gap 語意
   * 是行與行的橫向間距，跟 item 間距只是碰巧同值（gap 簡寫同時設了兩個方向）
   */
  itemRowSelector: string
  /** 任何能 signal「items 列表變動」的 reactive 來源——term 從無到有時觸發 metrics 重抓 */
  itemsSignal: WatchSource | WatchSource[]
}

// clientWidth 是四捨五入過的整數且含 padding。chunk 要拿它跟浮點的 item 寬度比
// 大小，所以自己從 border box 扣掉 padding / border 還原成浮點的 content 寬
function contentWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  return el.getBoundingClientRect().width
    - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
    - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0)
}

// 子像素容忍：寬度全是浮點，累加後可能比容器多出捨入級的量而誤判成要換行。
// 0.005px 取自 Chromium / Gecko 排版自己用的 line-fit 容忍值
const FIT_EPSILON = 0.005

export function useBilingualWrap(opts: UseBilingualWrapOptions) {
  const containerWidth = ref(0)
  // 首次量測前還沒有 row 可讀，用 SCSS 現值當種子。那一輪 containerWidth 也還是 0、
  // chunk 走單行 fallback，所以種子值不會影響任何實際輸出
  const gap = ref(4)

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
      const next = rowWidth === 0 ? w : rowWidth + gap.value + w
      if (next > containerWidth.value + FIT_EPSILON && rowWidth > 0) {
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

  // 兩個輸入都從實際排版讀回來，不寫死也不從別的元素推論——SCSS 改了這裡自動跟上
  function refreshMetrics(): void {
    const root = opts.containerRef.value
    if (!root) return
    const widthEl = root.querySelector(opts.rowSelector) as HTMLElement | null
    if (widthEl) containerWidth.value = contentWidth(widthEl)
    const itemRow = root.querySelector(opts.itemRowSelector) as HTMLElement | null
    if (itemRow) gap.value = parseFloat(getComputedStyle(itemRow).columnGap) || 0
  }

  // containerRef 可能是 display: contents 元素（SearchTermRows flat 模式）——
  // ResizeObserver 對沒 layout box 的元素不 fire，所以額外掛 window resize 當
  // fallback。對普通 box container（SearchPopup 內的獨立 grid）也無害、頂多兩條
  // 路徑都觸發 refresh，refreshMetrics 是 idempotent
  useResizeObserver(opts.containerRef, refreshMetrics)
  useEventListener(window, 'resize', refreshMetrics)
  onMounted(refreshMetrics)
  watch(opts.itemsSignal, refreshMetrics, { flush: 'post' })

  return {
    chunkBilingual,
  }
}
