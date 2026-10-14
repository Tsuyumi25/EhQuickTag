import { onBeforeUnmount, onMounted, shallowRef, type CSSProperties } from 'vue'

export interface PrototypeListingTag {
  name: string
  borderStyle: 'solid' | 'dashed' | 'dotted'
}

export interface PrototypeListingItem {
  id: number
  root: HTMLElement
  anchor: HTMLElement
  /** 只有縮圖模式（.gl1t）才有：規則的標示清單，插在原生標籤列 .gl6t 前面 */
  labelAnchor: HTMLElement | null
  /** 標題文字最前面：標題前綴 */
  titleAnchor: HTMLElement | null
  tags: PrototypeListingTag[]
  tagSet: ReadonlySet<string>
  complete: boolean
  /** 列表上的星等；讀不到或是自己評過分（selfRated）時是 null */
  rating: number | null
  /** 星星畫的是自己打的分，星等要另外向 API 要平均分 */
  selfRated: boolean
  /** 讀不到就是 null，判定維持未知 */
  pages: number | null
  title: string
  href: string
}

// 頁數沒有自己的 class：原生五種版型與 EhViewRefined 模擬的版型，都把它放在評分 .ir 後面的
// 兄弟 div，只有 Extended 中間隔著上傳者那格（含 /uploader/ 連結），Thumbnail 後面接著 .gldown。
// 翻譯腳本可能把 "pages" 換成別的字，所以只認開頭的數字
function pageCount(root: Element): number | null {
  for (const rating of root.querySelectorAll('.ir')) {
    for (let slot = rating.nextElementSibling; slot; slot = slot.nextElementSibling) {
      if (slot.querySelector('a') || slot.classList.contains('gldown')) continue
      const digits = /^\s*(\d[\d,]*)/.exec(slot.textContent ?? '')?.[1]
      if (digits) return Number(digits.replaceAll(',', ''))
    }
  }
  return null
}

// 評分只有星星雪碧圖：.ir 的 background-position 水平每 -16px 少一顆星，垂直 -21px 那一列是
// 半星，所以精度是 0.5。
// 自己評過分的圖庫，.ir 會多帶 irr / irg / irb，星星畫的是自己打的分
function starRating(root: Element): { rating: number | null; selfRated: boolean } {
  const stars = root.querySelector('.ir')
  if (!stars) return { rating: null, selfRated: false }
  if (['irr', 'irg', 'irb'].some(name => stars.classList.contains(name))) return { rating: null, selfRated: true }
  const style = stars.getAttribute('style') ?? ''
  const [x, y] = Array.from(style.matchAll(/(-?\d+)px/g), match => Math.abs(Number(match[1])))
  if (x === undefined || y === undefined) return { rating: null, selfRated: false }
  const rating = 5 - x / 16 - (y === 21 ? 0.5 : 0)
  return { rating: rating >= 0 && rating <= 5 ? rating : null, selfRated: false }
}

export function useRulePrototypeHost() {
  const items = shallowRef<PrototypeListingItem[]>([])
  const chips = shallowRef<{
    id: number
    item: PrototypeListingItem
    name: string
    anchor: HTMLElement
    area: HTMLElement
    tier: 'gt' | 'gtl' | 'gtw'
    geometry: CSSProperties
  }[]>([])
  const records = new Map<HTMLElement, { item: PrototypeListingItem; signature: string }>()
  const bindings = new Map<HTMLElement, {
    chip: (typeof chips.value)[number]
    restore: () => void
  }>()
  let nextId = 1
  let observer: MutationObserver | null = null
  let scheduled = false
  let disposed = false

  function restore(record: { item: PrototypeListingItem }) {
    for (const [element, binding] of bindings) {
      if (binding.chip.item !== record.item) continue
      binding.restore()
      bindings.delete(element)
    }
    record.item.anchor.remove()
    record.item.labelAnchor?.remove()
    record.item.titleAnchor?.remove()
    const root = record.item.root
    for (const name of [...root.classList]) {
      if (name.startsWith('eqt-rule-prototype__gallery')) root.classList.remove(name)
    }
    root.style.removeProperty('--eqt-rule-prototype-background')
  }

  function scan() {
    scheduled = false
    if (disposed) return
    const next: PrototypeListingItem[] = []
    const nextChips: typeof chips.value = []
    const seen = new Set<HTMLElement>()
    const seenTags = new Set<HTMLElement>()
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.itg a[href*="/g/"]')) {
      if (link.closest('.eqt-rule-prototype')) continue
      const root = link.closest<HTMLElement>('tr, .gl1t')
      if (!root || seen.has(root)) continue
      seen.add(root)
      const nativeTags = [...root.querySelectorAll<HTMLElement>('.gt, .gtl, .gtw')]
      const metadata = root.getAttribute('data-evr-tags')
      let parsed: unknown
      try { parsed = metadata === null ? null : JSON.parse(metadata) } catch { parsed = null }
      const hasMetadata = Array.isArray(parsed) && parsed.every(tag => tag && typeof tag.name === 'string')
      const complete = hasMetadata || !!root.closest('table.glte')
      const source = hasMetadata ? parsed as PrototypeListingTag[] : nativeTags.map(tag => ({
        name: tag.title,
        borderStyle: tag.classList.contains('gtw') ? 'dotted' : tag.classList.contains('gtl') ? 'dashed' : 'solid',
      }))
      const tags: PrototypeListingTag[] = []
      const names = new Set<string>()
      for (const tag of source) {
        const name = tag.name.trim().toLowerCase()
        if (!name || names.has(name)) continue
        names.add(name)
        tags.push({ name, borderStyle: tag.borderStyle === 'dashed' || tag.borderStyle === 'dotted' ? tag.borderStyle : 'solid' })
      }
      const stars = starRating(root)
      const pages = pageCount(root)
      const signature = JSON.stringify([complete, stars, pages, tags])
      let record = records.get(root)
      const detached = (anchor: HTMLElement | null) => !!anchor && !root.contains(anchor)
      if (record && (detached(record.item.anchor) || detached(record.item.labelAnchor)
        || detached(record.item.titleAnchor) || record.signature !== signature)) {
        restore(record)
        records.delete(root)
        record = undefined
      }
      if (!record) {
        const target = root.querySelector<HTMLElement>('.gl4e, .glname')
        if (!target) continue
        const anchor = document.createElement('div')
        anchor.className = 'eqt-rule-prototype__mount'
        anchor.setAttribute('translate', 'no')
        const title = root.querySelector('.glink')?.textContent?.trim() ?? link.textContent?.trim() ?? ''
        const titleLink = target.closest('a')
        if (titleLink) titleLink.after(anchor)
        else target.append(anchor)
        root.classList.add('eqt-rule-prototype__gallery')
        // 縮圖卡片裡評分列上方是 margin: auto，評分列以下整塊貼著卡片底部，同一排卡片撐高時差距由那段 margin 吸收；
        // 標示插在這一塊裡，封面與標題就不會因為某幾張多一行而對不齊
        let labelAnchor: HTMLElement | null = null
        if (root.matches('.gl1t')) {
          labelAnchor = document.createElement('div')
          labelAnchor.className = 'eqt-rule-prototype__mount eqt-rule-prototype__labels'
          labelAnchor.setAttribute('translate', 'no')
          const nativeTags = root.querySelector('.gl6t')
          if (nativeTags) nativeTags.before(labelAnchor)
          else root.append(labelAnchor)
        }
        const titleText = root.querySelector<HTMLElement>('.glink')
        let titleAnchor: HTMLElement | null = null
        if (titleText) {
          titleAnchor = document.createElement('span')
          titleAnchor.className = 'eqt-rule-prototype__mount eqt-rule-prototype__prefixes'
          titleAnchor.setAttribute('translate', 'no')
          titleText.prepend(titleAnchor)
        }
        record = {
          signature,
          item: {
            id: nextId++, root, anchor, labelAnchor, titleAnchor,
            tags, tagSet: names, complete, ...stars, pages, title, href: link.href,
          },
        }
        records.set(root, record)
      }
      for (const element of nativeTags) {
        const name = element.title.trim().toLowerCase()
        if (!name) continue
        seenTags.add(element)
        let binding = bindings.get(element)
        if (!binding || !element.contains(binding.chip.anchor)) {
          binding?.restore()
          const nativeStyle = getComputedStyle(element)
          const geometry: CSSProperties = {
            margin: nativeStyle.margin,
            borderRadius: nativeStyle.borderRadius,
            borderWidth: nativeStyle.borderWidth,
            fontSize: nativeStyle.fontSize,
            fontWeight: nativeStyle.fontWeight,
            lineHeight: nativeStyle.lineHeight,
            '--eqt-gallery-chip-padding-block': nativeStyle.paddingTop,
            '--eqt-gallery-chip-padding-inline': nativeStyle.paddingLeft,
          }
          const original = document.createDocumentFragment()
          while (element.firstChild) original.append(element.firstChild)
          const content = document.createElement('span')
          content.className = 'eqt-rule-prototype__tag-content'
          element.append(content)
          const previousTranslate = element.getAttribute('translate')
          element.classList.add('eqt-rule-prototype__native-chip')
          element.setAttribute('translate', 'no')
          binding = {
            chip: {
              id: nextId++, item: record.item, name, anchor: content, area: element.parentElement!, geometry,
              tier: element.classList.contains('gtw') ? 'gtw' : element.classList.contains('gtl') ? 'gtl' : 'gt',
            },
            restore() {
              element.classList.remove('eqt-rule-prototype__native-chip')
              if (element.contains(content)) element.replaceChildren(original)
              if (previousTranslate === null) element.removeAttribute('translate')
              else element.setAttribute('translate', previousTranslate)
            },
          }
          bindings.set(element, binding)
        }
        nextChips.push(binding.chip)
      }
      next.push(record.item)
    }
    for (const [root, record] of records) {
      if (seen.has(root)) continue
      restore(record)
      records.delete(root)
    }
    for (const [element, binding] of bindings) {
      if (seenTags.has(element)) continue
      binding.restore()
      bindings.delete(element)
    }
    if (next.length !== items.value.length || next.some((item, i) => item !== items.value[i])) items.value = next
    if (nextChips.length !== chips.value.length || nextChips.some((chip, i) => chip !== chips.value[i])) chips.value = nextChips
  }

  function schedule(mutations: MutationRecord[]) {
    const relevant = mutations.some(mutation => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement
      if (target?.closest('.eqt-rule-prototype, .eqt-rule-prototype__mount, .eqt-rule-prototype__tag-content')) return false
      if (mutation.type === 'attributes') return true
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
        node instanceof Element && !node.matches('.eqt-rule-prototype, .eqt-rule-prototype__mount, .eqt-rule-prototype__tag-content'),
      )
    })
    if (!relevant || scheduled) return
    scheduled = true
    queueMicrotask(scan)
  }

  onMounted(() => {
    scan()
    observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-evr-tags'] })
  })
  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    for (const record of records.values()) restore(record)
    records.clear()
  })
  return { items, chips }
}
