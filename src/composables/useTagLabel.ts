// 把 `ns:raw` 變成畫得出來的東西：翻譯後的名稱 + 圖示 + 命名空間標籤。
//
// GalleryTagList 內嵌了同一套邏輯（buildChipView）。這裡抽出來給 /mytags 面板
// 用——那頁的標籤跨所有命名空間，沒有 row label 可掛，每個 chip 得自帶 ns。

import { computed } from 'vue'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tagDb'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { isZhLocale, t } from '@/composables/useI18n'

const KNOWN_NS = new Set<string>(DEFAULT_NS_ORDER)

export interface TagLabel {
  ns: string
  raw: string
  /** 已翻譯（中文 locale 下）並套過繁簡設定的顯示名 */
  display: string
  /** 命名空間的在地化名稱；EhTagTranslation 沒收錄的 ns 直接用原文 */
  nsLabel: string
  iconUrl?: string
}

export function useTagLabel() {
  const { zhDisplay } = useDisplayConfig()

  // tagDb 是 async 載入的，載完只 bump tagDbVersion——不建立這條依賴的話，
  // 消費端的 computed 不會重算，chip 會一直停在英文原文
  const label = computed(() => {
    void tagDbVersion.value
    const zh = isZhLocale()

    return (full: string): TagLabel => {
      const colon = full.indexOf(':')
      const ns = colon > 0 ? full.slice(0, colon) : ''
      const raw = colon > 0 ? full.slice(colon + 1) : full
      const entry = findEntryByNsTag(ns, raw)
      return {
        ns,
        raw,
        display: zh && entry ? zhDisplay(entry.name) : raw,
        nsLabel: KNOWN_NS.has(ns) ? t(`ns.${ns}`) : ns,
        iconUrl: entry?.iconUrl,
      }
    }
  })

  return { label }
}
