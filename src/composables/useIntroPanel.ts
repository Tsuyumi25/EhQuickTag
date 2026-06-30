import { ref, computed, watch } from 'vue'
import { findEntryByNsTag, tagDbVersion } from '@/services/tagDb'
import { getTagWiki, tagWikiVersion, rawToSlug, type WikiEntry } from '@/services/tagWiki'
import type { GalleryTag } from '@/composables/useEhGalleryHost'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { locale, isCJKLocale } from '@/composables/useI18n'
import { introPanelPrimaryLang } from '@/services/store'

export type DisplayedLang = 'zh' | 'en'

// 全域 singleton：panel 只有一個，多個 chip 共用同一 panel state
const openTag = ref<GalleryTag | null>(null)

// 'auto' 模式由 locale 決定 primary：CJK locale 預設中文、其他預設英文
function resolvePrimaryLang(): DisplayedLang {
  const setting = introPanelPrimaryLang.value
  if (setting === 'zh') return 'zh'
  if (setting === 'en') return 'en'
  return isCJKLocale() ? 'zh' : 'en'
}

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

export function useIntroPanel() {
  const { cjkDisplay } = useDisplayConfig()

  const entry = computed(() => {
    void tagDbVersion.value
    if (!openTag.value) return null
    return findEntryByNsTag(openTag.value.ns, openTag.value.raw) ?? null
  })

  // 中文側 (trans db introHtml)：只在 displayedLang=zh 時顯示
  const introHtml = computed<string | null>(() => {
    if (displayedLang.value !== 'zh') return null
    const raw = entry.value?.introHtml
    return raw ? translateHtml(raw, cjkDisplay) : null
  })
  const linksHtml = computed<string | null>(() => {
    if (displayedLang.value !== 'zh') return null
    const raw = entry.value?.linksHtml
    return raw ? translateHtml(raw, cjkDisplay) : null
  })

  const iconUrl = computed<string | null>(() => entry.value?.iconUrl ?? null)

  // 英文側 (wiki block)：只在 displayedLang=en 時顯示
  const wikiEntry = computed<WikiEntry | null>(() => {
    void tagWikiVersion.value
    if (displayedLang.value !== 'en') return null
    if (!openTag.value) return null
    return getTagWiki(openTag.value.ns, openTag.value.raw) ?? null
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
    const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
    return Array.from(doc.querySelectorAll('img'))
      .map((img) => img.getAttribute('src'))
      .filter((s): s is string => !!s)
  })

  function toggleLang(): void {
    displayedLang.value = displayedLang.value === 'zh' ? 'en' : 'zh'
  }

  function setPanelTag(tag: GalleryTag): void {
    if (!document.querySelector('#gd5')) return
    openTag.value = tag
  }

  function close(): void {
    openTag.value = null
  }

  return {
    openTag, entry, introHtml, linksHtml, iconUrl, wikiEntry, wikiUrl, extraImages,
    displayedLang, toggleLang, setPanelTag, close, cjkDisplay,
  }
}
