import { computed } from 'vue'
import { searchPanelLangMode, searchPanelShowZh, convertToTraditional } from '@/services/store'
import { isZhLocale, isTWLocale } from '@/composables/useI18n'
import { toTW } from '@/services/cjkDict'

// === SearchPanel / SuggestionList 中文顯示邏輯：解析 langMode + showZh + 簡轉繁 ===
//
// 兩個 consumer 原本各抱一份對稱的 effectiveConvertTW + zhDisplay/zhName 邏輯，
// 改 convertToTraditional 解析（譬如加 zh-HK）要兩處分頭改、漏一處就分裂。
// 統一抽出來後第三個 consumer 出現也是 free 接上來。
//
// resolvedMode + effectiveShowZh 是 SearchPanel 特有需求（SuggestionList 純 locale-
// based 顯示翻譯、沒 toggle 控制），但跟 effectiveConvertTW 同源於「resolve 顯示語言」
// 邏輯、放在一起讀著清楚——SuggestionList 不取就不取，TS 不會抱怨。

export function useDisplayConfig() {
  // 'auto' 跟著 UI locale 走：中文 locale → 'toggle'、其他 → 'english-only'。
  // 使用者切 UI 語言時自動跟著變，不需要再回 settings 手動調
  const resolvedMode = computed<'toggle' | 'english-only'>(() => {
    if (searchPanelLangMode.value === 'auto') return isZhLocale() ? 'toggle' : 'english-only'
    return searchPanelLangMode.value
  })

  // english-only 模式強制忽略 showZh 偏好；toggle 模式才看 showZh ref
  const effectiveShowZh = computed(() => resolvedMode.value === 'toggle' && searchPanelShowZh.value)

  // convertToTraditional 'auto' = zh-TW on、其他 off。'on' 才需要 toTW——
  // EhTagTranslation DB 原文是簡體中文
  const effectiveConvertTW = computed(() => {
    if (convertToTraditional.value === 'auto') return isTWLocale()
    return convertToTraditional.value === 'on'
  })

  // 中文名稱繁化 helper：effectiveConvertTW on 時跑 toTW、否則原文直通
  function zhDisplay(name: string): string {
    return effectiveConvertTW.value ? toTW(name) : name
  }

  return { resolvedMode, effectiveShowZh, effectiveConvertTW, zhDisplay }
}
