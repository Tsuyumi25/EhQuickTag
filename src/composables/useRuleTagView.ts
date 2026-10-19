import { computed } from 'vue'
import { useMyTagsPalette } from '@/composables/useMyTagsPalette'
import { useTagLabel } from '@/composables/useTagLabel'
import { t } from '@/composables/useI18n'
import { listingMyTagsColorsEnabled } from '@/services/store'

/** 規則頁上的標籤（條件、素材、摘要）用同一套名稱與 mytags 配色 */
export function useRuleTagView(tag: () => string) {
  const { label } = useTagLabel()
  const palette = useMyTagsPalette()
  return computed(() => {
    const full = tag()
    // 舊版逐列編輯留下的空白條件也要看得見，不然只剩一顆空殼 chip
    if (!full) return { text: t('listingRules.emptyTag'), iconUrl: undefined, colors: undefined }
    const { nsLabel, display, iconUrl } = label.value(full)
    return {
      text: nsLabel ? `${nsLabel}:${display}` : display,
      iconUrl,
      colors: listingMyTagsColorsEnabled.value ? palette.value?.[full] : undefined,
    }
  })
}
