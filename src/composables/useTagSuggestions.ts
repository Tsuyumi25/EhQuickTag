import { ref, watch, onMounted, onScopeDispose } from 'vue'
import { loadTagDb, searchTags, type TagEntry } from '@/services/tagDb'
import type { Qualifier } from '@/services/searchSyntax'

/**
 * tagDb 載入 + debounced 查詢的 composable。
 *
 * 兩個 caller 共用：
 *   - TagAutocomplete（dropdown 模式，empty query → 空清單）
 *   - SearchPopup（fzf 模式，empty query → 用 emptyFallback 給的清單，例如 nh top 500）
 *
 * 用 getter 收參數避免要求 caller 必須給 ref——caller 那邊 props 是 reactive 但
 * 不是 ref，這樣寫不用 toRef 包裝。
 */
export interface UseTagSuggestionsOptions {
  query: () => string
  qualifier?: () => Qualifier | null
  /** popup-local 篩選；SearchPopup 用此跟 namespace 篩選按鈕綁定 */
  namespaces?: () => readonly string[] | undefined
  emptyFallback?: () => TagEntry[]
  debounceMs?: number
}

export function useTagSuggestions(opts: UseTagSuggestionsOptions) {
  const dbReady = ref(false)
  const suggestions = ref<TagEntry[]>([])
  let timer = 0

  function triggerSearch(): void {
    clearTimeout(timer)
    if (!dbReady.value) return
    // qualifier 模式（title:、uploader: 等）不查 tag suggestion，autocomplete 沒意義
    if (opts.qualifier?.()) {
      suggestions.value = []
      return
    }
    const q = opts.query().trim()
    if (!q) {
      suggestions.value = opts.emptyFallback?.() ?? []
      return
    }
    timer = window.setTimeout(() => {
      suggestions.value = searchTags(q, {
        namespaces: opts.namespaces?.(),
      })
    }, opts.debounceMs ?? 80)
  }

  onMounted(async () => {
    await loadTagDb()
    dbReady.value = true
    triggerSearch()
  })

  onScopeDispose(() => clearTimeout(timer))

  // 主 watcher：scalar 跟小陣列（namespaces ≤13 個 string）才走 deep:true，便宜
  watch(
    () => [opts.query(), opts.qualifier?.() ?? null, opts.namespaces?.() ?? null],
    triggerSearch,
    { deep: true },
  )

  // fallback 單獨用 shallow watcher：caller 給的 fallback 通常是 `() => someRef.value`，
  // someRef 後到位（譬如 SearchPopup 的 topNh 在 onMounted 才填好）就 retrigger。
  // 不能塞進主 watcher 然後 deep:true，因為 topNh 是 500 筆 TagEntry 物件、每筆 7+ 個欄位，
  // deep walk 太貴；用 reference identity 比較就夠（topNh.value 重新 assign 後 ref 變了）。
  if (opts.emptyFallback) {
    watch(opts.emptyFallback, triggerSearch)
  }

  return { dbReady, suggestions }
}
