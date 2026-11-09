import { ref, computed, watch, effectScope, type ComputedRef, type Ref } from 'vue'
import { findEntryByNsTag, tagDbVersion, type TagEntry } from '@/services/tags/tagDb'
import { getTagWiki, tagWikiVersion, rawToSlug, type WikiEntry } from '@/services/tags/tagWiki'
import { sanitizeIntroHtml, sanitizeImageUrl } from '@/services/tags/introHtml'
import type { GalleryTag } from '@/composables/useEhGalleryHost'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { locale, isZhLocale } from '@/composables/useI18n'
import { introPanelPrimaryLang, wikiPreludeExpanded as wikiPreludeExpandedSetting } from '@/services/store'

export type DisplayedLang = 'zh' | 'en'
export type IntroTag = Pick<GalleryTag, 'ns' | 'raw' | 'nsRaw'>

// 'auto' 模式由 locale 決定 primary：中文 locale 預設中文、其他預設英文
function resolvePrimaryLang(): DisplayedLang {
  const setting = introPanelPrimaryLang.value
  if (setting === 'zh') return 'zh'
  if (setting === 'en') return 'en'
  return isZhLocale() ? 'zh' : 'en'
}

function translateHtml(html: string, translate: (s: string) => string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return html
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null = walker.currentNode === root ? walker.nextNode() : walker.currentNode
  while (node) {
    if (node.nodeValue) node.nodeValue = translate(node.nodeValue)
    node = walker.nextNode()
  }
  return root.innerHTML
}

/** 一份說明面板的狀態：顯示哪個 tag、哪個語言、prelude 展不展開 */
export interface IntroPanel {
  openTag: Ref<IntroTag | null>
  entry: ComputedRef<TagEntry | null>
  introHtml: ComputedRef<string | null>
  linksHtml: ComputedRef<string | null>
  iconUrl: ComputedRef<string | null>
  wikiEntry: ComputedRef<WikiEntry | null>
  wikiUrl: ComputedRef<string | null>
  extraImages: ComputedRef<string[]>
  displayedLang: Ref<DisplayedLang>
  preludeExpanded: Ref<boolean>
  zhDisplay: (name: string) => string
  toggleLang: () => void
  togglePrelude: () => void
  setPanelTag: (tag: IntroTag) => void
  close: () => void
}

export function createIntroPanel(): IntroPanel {
  const { zhDisplay } = useDisplayConfig()
  const openTag = ref<IntroTag | null>(null)

  const displayedLang = ref<DisplayedLang>(resolvePrimaryLang())
  // reset 到 primary 的情境：① 切換新 chip ② 使用者改 introPanelPrimaryLang 設定
  // ③ UI locale 變動。前者是 per-panel session 預設、後兩者是設定改動的即時反映
  // (避免「改了設定看不到效果」的疑慮)
  watch(
    [openTag, introPanelPrimaryLang, locale],
    () => {
      if (openTag.value) displayedLang.value = resolvePrimaryLang()
    },
  )

  // Wiki prelude 展開狀態——同 displayedLang 的 per-panel session pattern：
  // 切 chip / 改設定 / 切 UI locale 都 reset 回 wikiPreludeExpanded 設定值。
  // 使用者點展開只影響當下 panel session
  const preludeExpanded = ref<boolean>(wikiPreludeExpandedSetting.value)
  watch(
    [openTag, wikiPreludeExpandedSetting, locale],
    () => {
      preludeExpanded.value = wikiPreludeExpandedSetting.value
    },
  )

  const entry = computed(() => {
    void tagDbVersion.value
    if (!openTag.value) return null
    return findEntryByNsTag(openTag.value.ns, openTag.value.raw) ?? null
  })

  // 中文側 (trans db introHtml)：只在 displayedLang=zh 時顯示
  const introHtml = computed<string | null>(() => {
    if (displayedLang.value !== 'zh') return null
    const raw = entry.value?.introHtml
    return raw ? sanitizeIntroHtml(translateHtml(raw, zhDisplay)) : null
  })
  const linksHtml = computed<string | null>(() => {
    if (displayedLang.value !== 'zh') return null
    const raw = entry.value?.linksHtml
    return raw ? sanitizeIntroHtml(translateHtml(raw, zhDisplay)) : null
  })

  const iconUrl = computed<string | null>(() => sanitizeImageUrl(entry.value?.iconUrl))

  // 英文側 (wiki block)：只在 displayedLang=en 時顯示
  const wikiEntry = computed<WikiEntry | null>(() => {
    void tagWikiVersion.value
    if (displayedLang.value !== 'en') return null
    if (!openTag.value) return null
    const variants = getTagWiki(openTag.value.ns, openTag.value.raw)
    return variants?.map((variant) => ({
      prelude: sanitizeIntroHtml(variant.prelude),
      blocks: variant.blocks.map(sanitizeIntroHtml),
    })) ?? null
  })

  // 該 tag 對應的 wiki page URL (永遠存在不管 wikiEntry 有沒有, 但 panel 只在
  // 有 wikiEntry 時顯示 via link)。slug 算法跟 tagWiki.rawToSlug 共用避免 drift
  const wikiUrl = computed<string | null>(() => {
    if (!openTag.value) return null
    return `https://ehwiki.org/wiki/${encodeURIComponent(rawToSlug(openTag.value.raw))}`
  })

  // 英文側顯示時把 trans db 圖片 dump 在 wiki 內容後面 (中文側時圖片 inline 在 introHtml)
  const extraImages = computed<string[]>(() => {
    if (displayedLang.value !== 'en') return []
    const raw = entry.value?.introHtml
    if (!raw) return []
    const doc = new DOMParser().parseFromString(sanitizeIntroHtml(raw), 'text/html')
    return Array.from(doc.querySelectorAll('img'))
      .map((img) => sanitizeImageUrl(img.getAttribute('src')))
      .filter((s): s is string => !!s)
  })

  function toggleLang(): void {
    displayedLang.value = displayedLang.value === 'zh' ? 'en' : 'zh'
  }

  function setPanelTag(tag: IntroTag): void {
    openTag.value = tag
  }

  function close(): void {
    openTag.value = null
  }

  function togglePrelude(): void {
    preludeExpanded.value = !preludeExpanded.value
  }

  return {
    openTag, entry, introHtml, linksHtml, iconUrl, wikiEntry, wikiUrl, extraImages,
    displayedLang, toggleLang, setPanelTag, close, zhDisplay,
    preludeExpanded, togglePrelude,
  }
}

// 圖庫頁的面板 teleport 進 #gd5，整頁只有一個：taglist 與面板元件共用同一份。
// 放在 detached scope 裡，watcher 不跟著第一個呼叫它的元件一起被收掉
let galleryPanel: IntroPanel | undefined
export function useGalleryIntroPanel(): IntroPanel {
  if (!galleryPanel) {
    const panel = effectScope(true).run(createIntroPanel)!
    galleryPanel = {
      ...panel,
      setPanelTag: tag => {
        if (document.querySelector('#gd5')) panel.setPanelTag(tag)
      },
    }
  }
  return galleryPanel
}
