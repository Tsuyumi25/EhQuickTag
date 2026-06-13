import { ref, watch, onMounted, onScopeDispose, type Ref, type WatchSource } from 'vue'

// === DOM-based text width measurement，layout-engine 精準 ===
//
// 設計：clone 一個 visible item element（sample），inline style 改成 absolute +
// hidden，appendChild 到 container。量測時把 textContent 換成目標字串、讀
// offsetWidth——layout engine 自己量、CSS 完全繼承（含 font-family fallback、
// letter-spacing、kerning、font-feature-settings 等所有屬性），跟實際渲染 100% match
//
// 為什麼不用 canvas measureText：在 CJK + 西文 fallback 場景，canvas 跟 DOM 走
// 不同的 font resolution path（Chromium 已知 quirk），量出來會差 0.5~1 字寬。
// DOM 量測代價是觸發 forced reflow，但 cache 後每個 text 只跑一次，可接受
//
// caller 要做兩件事：
//   1. 訪問 version 確保 reactive 連動（ruler 重建 / fonts.ready 變動時自動重算）
//   2. 提供 containerRef.querySelector(itemSelector) 能撈到一個樣本 element

export interface UseTextMeasureOptions {
  containerRef: Ref<HTMLElement | null>
  /** containerRef 內取 sample element 的 selector（其 class / CSS 完整 clone 給 ruler 用） */
  itemSelector: string
  /** 任何能 signal「items 列表變動」的 reactive 來源——item 從無到有時觸發 ruler 重建 */
  itemsSignal: WatchSource | WatchSource[]
}

export interface TextMeasureApi {
  /** 量文字渲染寬度（含 padding/border）。ruler 未 ready 時回 0，caller 自行處理 fallback */
  getWidth: (text: string) => number
  /**
   * Reactive trigger：ruler 重建或字型載入完會 bump。caller 在 computed 內訪問
   * （`void version.value`）才能正確連動。
   */
  version: Ref<number>
}

export function useTextMeasure(opts: UseTextMeasureOptions): TextMeasureApi {
  const version = ref(0)
  const widthCache = new Map<string, number>()
  let ruler: HTMLElement | null = null

  // 嘗試建立 ruler（clone visible sample），ready 後回 ref，否則 null。
  // sample 從無到有時 caller 可以用 itemsSignal watch 觸發 retry
  function ensureRuler(): HTMLElement | null {
    if (ruler && opts.containerRef.value?.contains(ruler)) return ruler
    if (!opts.containerRef.value) return null
    const sample = opts.containerRef.value.querySelector(opts.itemSelector) as HTMLElement | null
    if (!sample) return null

    ruler = sample.cloneNode(false) as HTMLElement
    // 脫離正常 layout、不影響 scroll / hover / 視覺。class chain 不動所以 CSS 100% 套用
    Object.assign(ruler.style, {
      position: 'absolute',
      top: '-9999px',
      left: '-9999px',
      visibility: 'hidden',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    })
    opts.containerRef.value.appendChild(ruler)
    return ruler
  }

  function measureWidth(text: string): number {
    const r = ensureRuler()
    if (!r) return 0
    r.textContent = text
    return r.offsetWidth
  }

  function getWidth(text: string): number {
    const cached = widthCache.get(text)
    if (cached !== undefined && cached > 0) return cached
    const w = measureWidth(text)
    if (w > 0) widthCache.set(text, w)
    return w
  }

  onMounted(() => {
    if (ensureRuler()) version.value++

    // 字型載入完 invalidate width cache：載入前讀到的可能還是 fallback font
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        widthCache.clear()
        version.value++
      })
    }
  })

  // item 從無到有時 onMounted 跑的 ensureRuler 找不到 sample，ruler 留 null。
  // watch itemsSignal 在 list 變動後重抓——flush:'post' 確保 DOM commit 後跑、有 sample 可讀
  watch(opts.itemsSignal, () => {
    if (ruler && opts.containerRef.value?.contains(ruler)) return
    if (ensureRuler()) version.value++
  }, { flush: 'post' })

  onScopeDispose(() => {
    if (ruler?.parentElement) ruler.parentElement.removeChild(ruler)
    ruler = null
  })

  return { getWidth, version }
}
