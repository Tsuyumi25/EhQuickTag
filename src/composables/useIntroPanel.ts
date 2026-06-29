import { ref, computed } from 'vue'
import { findEntryByNsTag, tagDbVersion } from '@/services/tagDb'
import type { GalleryTag } from '@/composables/useEhGalleryHost'
import { useDisplayConfig } from '@/composables/useDisplayConfig'

// 全域 singleton：panel 只有一個，多個 chip 共用同一 panel state
const openTag = ref<GalleryTag | null>(null)

export function useIntroPanel() {
  const { cjkDisplay } = useDisplayConfig()

  const entry = computed(() => {
    void tagDbVersion.value
    if (!openTag.value) return null
    return findEntryByNsTag(openTag.value.ns, openTag.value.raw) ?? null
  })

  // 直接餵 cjkDisplay (toTW)——toTW 是 per-char 字典查詢、ASCII 原樣放回，
  // HTML tag 不會被破壞
  const introHtml = computed<string | null>(() => {
    const raw = entry.value?.introHtml
    return raw ? cjkDisplay(raw) : null
  })
  const linksHtml = computed<string | null>(() => {
    const raw = entry.value?.linksHtml
    return raw ? cjkDisplay(raw) : null
  })

  const iconUrl = computed<string | null>(() => entry.value?.iconUrl ?? null)

  // 永遠 set 而不 toggle：對「任何 chip 操作都繼續顯示定義」的語意，由 caller (GalleryTagList)
  // 用 watcher 監控自身 selection 全空時 call close() 關閉
  function setPanelTag(tag: GalleryTag): void {
    openTag.value = tag
  }

  function close(): void {
    openTag.value = null
  }

  return { openTag, entry, introHtml, linksHtml, iconUrl, setPanelTag, close, cjkDisplay }
}
