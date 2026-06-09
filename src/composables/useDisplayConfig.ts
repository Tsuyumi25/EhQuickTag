import { computed } from 'vue'
import { searchPanelLangMode, searchPanelShowCJK, convertToTraditional } from '@/services/store'
import { isCJKLocale, isTWLocale } from '@/composables/useI18n'
import { toTW } from '@/services/cjkDict'

// === SearchPanel / SuggestionList CJK 顯示邏輯：解析 langMode + showCJK + 簡轉繁 ===
//
// 兩個 consumer 原本各抱一份對稱的 effectiveConvertTW + cjkDisplay/cjkName 邏輯，
// 改 convertToTraditional 解析（譬如加 zh-HK）要兩處分頭改、漏一處就分裂。
// 統一抽出來後第三個 consumer 出現也是 free 接上來。
//
// resolvedMode + effectiveShowCJK 是 SearchPanel 特有需求（SuggestionList 純 locale-
// based 顯示翻譯、沒 toggle 控制），但跟 effectiveConvertTW 同源於「resolve 顯示語言」
// 邏輯、放在一起讀著清楚——SuggestionList 不取就不取，TS 不會抱怨。

export function useDisplayConfig() {
  // 'auto' 跟著 UI locale 走：CJK locale → 'toggle'、其他 → 'english-only'。
  // 使用者切 UI 語言時自動跟著變，不需要再回 settings 手動調
  const resolvedMode = computed<'toggle' | 'english-only'>(() => {
    if (searchPanelLangMode.value === 'auto') return isCJKLocale() ? 'toggle' : 'english-only'
    return searchPanelLangMode.value
  })

  // english-only 模式強制忽略 showCJK 偏好；toggle 模式才看 showCJK ref
  const effectiveShowCJK = computed(() => resolvedMode.value === 'toggle' && searchPanelShowCJK.value)

  // convertToTraditional 'auto' = zh-TW on、其他 off。'on' 才需要 toTW——
  // EhTagTranslation DB 原文是簡體中文
  const effectiveConvertTW = computed(() => {
    if (convertToTraditional.value === 'auto') return isTWLocale()
    return convertToTraditional.value === 'on'
  })

  // CJK 名稱繁化 helper：effectiveConvertTW on 時跑 toTW、否則原文直通
  function cjkDisplay(name: string): string {
    return effectiveConvertTW.value ? toTW(name) : name
  }

  return { resolvedMode, effectiveShowCJK, effectiveConvertTW, cjkDisplay }
}
