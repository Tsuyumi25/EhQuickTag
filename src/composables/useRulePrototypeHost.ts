import { onBeforeUnmount, onMounted, shallowRef, watch, type CSSProperties } from 'vue'
import { categoryFromClassList, type GalleryCategory } from '@/services/listing/galleryCategory'
import { t } from '@/composables/useI18n'
import { groupByNamespace, namespaceOf } from '@/services/listing/tagGroups'
import type { ListingTagLayout } from '@/services/store'
import { DEFAULT_NS_ORDER } from '@/services/tags/tagDb'

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
  category: GalleryCategory | null
  /** 讀不到就是 null，判定維持未知 */
  uploader: string | null
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

const UPLOADER_PATH = /\/uploader\/([^/?#]+)/

// EhViewRefined 把上傳者放在 data-evr-uploader（它模擬的縮圖沒有上傳者那格，只能從這裡讀）；
// 其他版型的上傳者格裡有 /uploader/<名稱> 連結，路徑是表單編碼，空白寫成 +
function uploaderOf(root: Element): string | null {
  const published = root.getAttribute('data-evr-uploader')
  if (published) return published
  const encoded = UPLOADER_PATH.exec(root.querySelector('a[href*="/uploader/"]')?.getAttribute('href') ?? '')?.[1]
  if (!encoded) return null
  try {
    return decodeURIComponent(encoded.replace(/\+/g, ' '))
  } catch {
    return null
  }
}

// chip 照原生標籤的外框與字級畫，換上去之後版面不會跳
function geometryOf(nativeStyle: CSSStyleDeclaration): CSSProperties {
  return {
    margin: nativeStyle.margin,
    borderRadius: nativeStyle.borderRadius,
    borderWidth: nativeStyle.borderWidth,
    fontSize: nativeStyle.fontSize,
    fontWeight: nativeStyle.fontWeight,
    lineHeight: nativeStyle.lineHeight,
    '--eqt-gallery-chip-padding-block': nativeStyle.paddingTop,
    '--eqt-gallery-chip-padding-inline': nativeStyle.paddingLeft,
  }
}

const UPLOADER_MOUNT = 'eqt-rule-prototype__uploader'

/**
 * 上傳者 chip 跟原生標籤排在一起：Extended 的標籤是每個 namespace 一列的表格，照同樣的樣子多加一列；
 * 其他版型的標籤是一串並排的 div，接在最後面。EhViewRefined 的縮圖一律有 .gl6t，沒有標籤時也放得進去。
 * 一個標籤都沒顯示的列（Minimal 從不顯示標籤、Minimal+ 只顯示 My Tags 裡的）就自己開一排，
 * 位置照 Minimal+ 原生放標籤的地方：標題連結裡、.glink 的後面
 */
function mountUploader(root: Element, nativeTags: readonly HTMLElement[]): { mount: HTMLElement; area: HTMLElement; content: HTMLElement } | null {
  const chip = document.createElement('div')
  chip.className = 'eqt-rule-prototype__native-chip'
  chip.setAttribute('translate', 'no')
  const content = document.createElement('span')
  content.className = 'eqt-rule-prototype__tag-content'
  chip.append(content)

  const table = root.querySelector<HTMLTableElement>('.gl4e table')
  if (table) {
    const cell = document.createElement('td')
    cell.append(chip)
    const row = document.createElement('tr')
    row.className = UPLOADER_MOUNT
    row.setAttribute('translate', 'no')
    const label = document.createElement('td')
    label.className = 'tc'
    label.textContent = 'uploader:'
    row.append(label, cell)
    ;(table.tBodies[0] ?? table).append(row)
    return { mount: row, area: cell, content }
  }

  // 已經分成 namespace 列時接在格子外面，下一次掃描重排時再收進上傳者那一列
  const last = nativeTags.at(-1)
  const holder = last?.closest<HTMLElement>(`.${NS_GRID}`)?.parentElement ?? last?.parentElement ?? root.querySelector<HTMLElement>('.gl6t')
  if (holder) {
    chip.classList.add(UPLOADER_MOUNT)
    holder.append(chip)
    return { mount: chip, area: holder, content }
  }

  const title = root.querySelector<HTMLElement>('.glname')
  if (!title) return null
  const line = document.createElement('div')
  line.className = `${UPLOADER_MOUNT} eqt-rule-prototype__uploader-line`
  line.setAttribute('translate', 'no')
  line.append(chip)
  const titleLink = title.querySelector<HTMLElement>(':scope > a') ?? title
  titleLink.append(line)
  return { mount: line, area: line, content }
}

const NS_GRID = 'eqt-rule-prototype__ns-grid'

interface Grouping {
  container: HTMLElement
  grid: HTMLElement
  /** 搬進格子裡的節點，照原本的順序；拆掉時照這個順序放回 container */
  units: HTMLElement[]
}

function createNode(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * 跟圖庫頁一樣每個 namespace 一列、前面寫出 namespace。Extended 原生就是這樣排的表格，不動；
 * 其他版型把並排的標籤收進一張兩欄的格子，上傳者自己一列放最後。
 * 沒有標籤、只有自己開的那排上傳者時，格子就開在那一排裡
 */
function groupTags(root: Element, nativeTags: readonly HTMLElement[], labelOf: (namespace: string) => string): Grouping | null {
  if (root.querySelector('.gl4e table')) return null
  const mount = root.querySelector<HTMLElement>(`.${UPLOADER_MOUNT}`)
  const container = nativeTags[0]?.parentElement ?? mount
  if (!container) return null
  const tags = nativeTags.filter(tag => tag.parentElement === container)
  const uploader = mount === container ? mount.firstElementChild as HTMLElement | null : mount?.parentElement === container ? mount : null

  const grid = createNode('div', NS_GRID)
  grid.setAttribute('translate', 'no')
  const row = (label: string, members: readonly HTMLElement[]) => {
    const cells = createNode('div', 'eqt-rule-prototype__ns-cells')
    cells.append(...members)
    const line = createNode('div', 'eqt-rule-prototype__ns-row')
    line.append(createNode('div', 'eqt-rule-prototype__ns-label', label ? `${label}:` : ''), cells)
    grid.append(line)
  }
  for (const group of groupByNamespace(tags, tag => namespaceOf(tag.title))) row(labelOf(group.namespace), group.items)
  if (uploader) row(labelOf('uploader'), [uploader])
  container.append(grid)
  return { container, grid, units: uploader ? [...tags, uploader] : tags }
}

function ungroup(grouping: Grouping): void {
  for (const unit of grouping.units) grouping.container.insertBefore(unit, grouping.grid)
  grouping.grid.remove()
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

/**
 * tagsEnabled：要不要把原生標籤換成插件的 chip；關掉時標籤照樣讀進來給規則判定，只是不動原生的 DOM。
 * tagLayout：標籤照網站原樣，還是像圖庫頁那樣每個 namespace 一列；只在 tagsEnabled 時改
 */
export function useRulePrototypeHost(options: { tagsEnabled: () => boolean; tagLayout: () => ListingTagLayout }) {
  const items = shallowRef<PrototypeListingItem[]>([])
  const chips = shallowRef<{
    id: number
    item: PrototypeListingItem
    name: string
    anchor: HTMLElement
    area: HTMLElement
    tier: 'gt' | 'gtl' | 'gtw'
    /** 上傳者 chip 前面掛上傳者的圖示，跟標籤分得開 */
    uploader: boolean
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
  const groupings = new Map<HTMLElement, Grouping>()

  /** 格子裡的節點跟這次掃到的一樣就不動：搬動會觸發 MutationObserver 再掃一次，掃到一樣的才會停 */
  function layout(root: HTMLElement, nativeTags: readonly HTMLElement[], mode: ListingTagLayout) {
    const current = groupings.get(root)
    if (mode === 'namespace' && current?.grid.isConnected) {
      const mount = root.querySelector<HTMLElement>(`.${UPLOADER_MOUNT}`)
      const expected = new Set<Element>(nativeTags)
      if (mount) expected.add(mount === current.container ? mount.firstElementChild! : mount)
      if (current.units.length === expected.size && current.units.every(unit => expected.has(unit) && current.grid.contains(unit))) return
    }
    if (current) {
      ungroup(current)
      groupings.delete(root)
    }
    if (mode !== 'namespace') return
    const created = groupTags(root, nativeTags, namespace =>
      namespace === 'uploader' ? t('rulePagePrototype.uploader') : (DEFAULT_NS_ORDER as readonly string[]).includes(namespace) ? t(`ns.${namespace}`) : namespace)
    if (created) groupings.set(root, created)
  }

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
    const grouping = groupings.get(root)
    if (grouping) ungroup(grouping)
    groupings.delete(root)
    for (const name of [...root.classList]) {
      if (name.startsWith('eqt-rule-prototype__gallery')) root.classList.remove(name)
    }
    root.style.removeProperty('--eqt-rule-prototype-background')
  }

  function bindUploader(
    root: HTMLElement, item: PrototypeListingItem, uploader: string, nativeTags: readonly HTMLElement[], seen: Set<HTMLElement>,
  ) {
    const existing = root.querySelector<HTMLElement>(`.${UPLOADER_MOUNT}`)
    const current = existing ? bindings.get(existing) : undefined
    if (existing && current) {
      seen.add(existing)
      return current
    }
    existing?.remove()
    const created = mountUploader(root, nativeTags)
    if (!created) return null
    const binding = {
      chip: {
        id: nextId++, item, name: `uploader:${uploader}`, anchor: created.content, area: created.area,
        geometry: nativeTags[0] ? geometryOf(getComputedStyle(nativeTags[0])) : {}, tier: 'gt' as const, uploader: true,
      },
      restore: () => created.mount.remove(),
    }
    bindings.set(created.mount, binding)
    seen.add(created.mount)
    return binding
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
      // 分類標籤在精簡／極簡模式是 .cn、其他版面是 .cs；縮圖浮出的那張（.glthumb）裡也有一份，分類一樣
      const category = categoryFromClassList(root.querySelector('.cs, .cn')?.classList ?? [])
      const uploader = uploaderOf(root)
      const signature = JSON.stringify([complete, stars, pages, category, uploader, tags])
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
            tags, tagSet: names, complete, ...stars, pages, category, uploader, title, href: link.href,
          },
        }
        records.set(root, record)
      }
      for (const element of options.tagsEnabled() ? nativeTags : []) {
        const name = element.title.trim().toLowerCase()
        if (!name) continue
        seenTags.add(element)
        let binding = bindings.get(element)
        if (!binding || !element.contains(binding.chip.anchor)) {
          binding?.restore()
          const geometry = geometryOf(getComputedStyle(element))
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
              id: nextId++, item: record.item, name, anchor: content, area: element.parentElement!, geometry, uploader: false,
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
      const uploaderBinding = options.tagsEnabled() && uploader ? bindUploader(root, record.item, uploader, nativeTags, seenTags) : null
      if (uploaderBinding) nextChips.push(uploaderBinding.chip)
      layout(root, nativeTags, options.tagsEnabled() ? options.tagLayout() : 'native')
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

  const OWN_NODES = `.eqt-rule-prototype, .eqt-rule-prototype__mount, .eqt-rule-prototype__tag-content, .${UPLOADER_MOUNT}, .${NS_GRID}`
  function schedule(mutations: MutationRecord[]) {
    const relevant = mutations.some(mutation => {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement
      if (target?.closest(OWN_NODES)) return false
      if (mutation.type === 'attributes') return true
      return [...mutation.addedNodes, ...mutation.removedNodes].some(node => node instanceof Element && !node.matches(OWN_NODES))
    })
    if (!relevant || scheduled) return
    scheduled = true
    queueMicrotask(scan)
  }

  watch([options.tagsEnabled, options.tagLayout], () => scan())

  onMounted(() => {
    scan()
    observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-evr-tags', 'data-evr-uploader'] })
  })
  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    for (const record of records.values()) restore(record)
    records.clear()
  })
  return { items, chips }
}
