import { ref, computed } from 'vue'
import { findEntryByNsTag, tagDbVersion } from '@/services/tagDb'
import type { GalleryTag } from '@/composables/useEhGalleryHost'
import { useDisplayConfig } from '@/composables/useDisplayConfig'

// 全域 singleton：panel 只有一個，多個 chip 共用同一 panel state
const openTag = ref<GalleryTag | null>(null)

// 只翻譯 textNode，不動 tag / attribute——避免污染 href / title / class 這類
// 容易被 char-level 替換破壞的屬性值（例如 abbr title 帶英文 cross-ref、
// href 帶 CJK 別名 URL）
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

  const introHtml = computed<string | null>(() => {
    const raw = entry.value?.introHtml
    return raw ? translateHtml(raw, cjkDisplay) : null
  })
  const linksHtml = computed<string | null>(() => {
    const raw = entry.value?.linksHtml
    return raw ? translateHtml(raw, cjkDisplay) : null
  })

  const iconUrl = computed<string | null>(() => entry.value?.iconUrl ?? null)

  // 永遠 set 而不 toggle：對「任何 chip 操作都繼續顯示定義」的語意，由 caller (GalleryTagList)
  // 用 watcher 監控自身 selection 全空時 call close() 關閉
  // host guard：沒有 #gd5（Teleport target）就不開，避免在 /mpv/ 等其他頁面誤觸
  function setPanelTag(tag: GalleryTag): void {
    if (!document.querySelector('#gd5')) return
    openTag.value = tag
  }

  function close(): void {
    openTag.value = null
  }

  return { openTag, entry, introHtml, linksHtml, iconUrl, setPanelTag, close, cjkDisplay }
}
