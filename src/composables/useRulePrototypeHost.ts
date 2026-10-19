import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { categoryFromClassList, type GalleryCategory } from '@/services/listing/galleryCategory'
import { CHIP_CLASS, decorate, undecorate } from '@/services/listing/listingChipDom'

export interface PrototypeListingTag {
  name: string
}

export interface PrototypeListingItem {
  id: number
  root: HTMLElement
  /** 只有縮圖模式（.gl1t）才有：規則的標示清單，插在原生標籤列 .gl6t 前面 */
  labelAnchor: HTMLElement | null
  /** 標題文字最前面：標題前綴 */
  titleAnchor: HTMLElement | null
  /** 標題文字包在這一層裡：標題的樣式只套在它身上，前綴是它的兄弟，不會被刪除線、背景之類波及 */
  titleText: HTMLElement | null
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

/** 列表上的一顆 chip：就是 EhViewRefined 畫出的那個標籤元素本身 */
export interface ListingChip {
  id: number
  item: PrototypeListingItem
  name: string
  element: HTMLElement
  /** 標籤排在一起的那塊；點在 chip 之間的空白也算在標籤區裡 */
  area: HTMLElement
  tier: 'gt' | 'gtl' | 'gtw'
  uploader: boolean
}

// EhViewRefined 畫的上傳者標籤也長得像 .gt，但它不是網站的標籤，不能算進規則的標籤裡
const SITE_TAGS = ':is(.gt, .gtl, .gtw):not(.evr-uploader-tag)'
const UPLOADER_NAMESPACE = 'uploader'
const TITLE_TEXT = 'eqt-rule-prototype__title-text'

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

// 評分由 EhViewRefined 從星星換算好：平均分在 data-evr-rating（半星一格）；自己評過分的圖庫，
// 星星畫的是自己打的分，看不到平均分，只會有 data-evr-my-rating
function starRating(root: Element): { rating: number | null; selfRated: boolean } {
  const value = Number(root.getAttribute('data-evr-rating') ?? Number.NaN)
  return {
    rating: Number.isFinite(value) && value >= 0 && value <= 5 ? value : null,
    selfRated: root.hasAttribute('data-evr-my-rating'),
  }
}

/**
 * tagsEnabled：要不要把標籤改成插件的 chip；關掉時標籤照樣讀進來給規則判定，只是不動原生的 DOM。
 * 標籤怎麼排（每個 namespace 一列、上傳者要不要顯示成標籤）是 EhViewRefined 的設定，這裡只認它畫出來的 [data-evr-tag]
 */
export function useRulePrototypeHost(options: { tagsEnabled: () => boolean }) {
  const items = shallowRef<PrototypeListingItem[]>([])
  const chips = shallowRef<ListingChip[]>([])
  const records = new Map<HTMLElement, { item: PrototypeListingItem; signature: string }>()
  const bindings = new Map<HTMLElement, ListingChip>()
  let nextId = 1
  let observer: MutationObserver | null = null
  let scheduled = false
  let disposed = false

  function release(element: HTMLElement) {
    undecorate(element)
    bindings.delete(element)
  }

  function restore(record: { item: PrototypeListingItem }) {
    for (const [element, chip] of bindings) {
      if (chip.item === record.item) release(element)
    }
    record.item.labelAnchor?.remove()
    record.item.titleAnchor?.remove()
    const wrap = record.item.titleText
    if (wrap?.parentNode) {
      wrap.replaceWith(...wrap.childNodes)
    }
    const root = record.item.root
    for (const name of [...root.classList]) {
      if (name.startsWith('eqt-rule-prototype__gallery')) root.classList.remove(name)
    }
    root.style.removeProperty('--eqt-rule-prototype-background')
  }

  function chipName(element: HTMLElement): string | null {
    const full = element.getAttribute('data-evr-tag')?.trim()
    if (!full) return null
    // 選取與搜尋用的 key 跟規則一樣：標籤一律小寫，上傳者名稱照原樣
    return element.getAttribute('data-evr-ns') === UPLOADER_NAMESPACE ? full : full.toLowerCase()
  }

  function scan() {
    scheduled = false
    if (disposed) return
    const next: PrototypeListingItem[] = []
    const nextChips: ListingChip[] = []
    const seen = new Set<HTMLElement>()
    const seenTags = new Set<HTMLElement>()
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.itg a[href*="/g/"]')) {
      if (link.closest('.eqt-rule-prototype')) continue
      const root = link.closest<HTMLElement>('tr, .gl1t')
      if (!root || seen.has(root)) continue
      seen.add(root)
      const metadata = root.getAttribute('data-evr-tags')
      let parsed: unknown
      try { parsed = metadata === null ? null : JSON.parse(metadata) } catch { parsed = null }
      const hasMetadata = Array.isArray(parsed) && parsed.every(tag => tag && typeof tag.name === 'string')
      const complete = hasMetadata || !!root.closest('table.glte')
      const source = hasMetadata
        ? parsed as PrototypeListingTag[]
        : [...root.querySelectorAll<HTMLElement>(SITE_TAGS)].map(tag => ({ name: tag.title }))
      const tags: PrototypeListingTag[] = []
      const names = new Set<string>()
      for (const tag of source) {
        const name = tag.name.trim().toLowerCase()
        if (!name || names.has(name)) continue
        names.add(name)
        tags.push({ name })
      }
      const stars = starRating(root)
      const pages = pageCount(root)
      // 分類標籤在精簡／極簡模式是 .cn、其他版面是 .cs；縮圖浮出的那張（.glthumb）裡也有一份，分類一樣
      const category = categoryFromClassList(root.querySelector('.cs, .cn')?.classList ?? [])
      const uploader = uploaderOf(root)
      const signature = JSON.stringify([complete, stars, pages, category, uploader, tags])
      let record = records.get(root)
      const detached = (anchor: HTMLElement | null) => !!anchor && !root.contains(anchor)
      if (record && (detached(record.item.labelAnchor) || detached(record.item.titleAnchor) || detached(record.item.titleText)
        || record.signature !== signature)) {
        restore(record)
        records.delete(root)
        record = undefined
      }
      if (!record) {
        if (!root.querySelector('.gl4e, .glname')) continue
        const title = root.querySelector('.glink')?.textContent?.trim() ?? link.textContent?.trim() ?? ''
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
        // 只包標題本身的文字；其他腳本插在標題裡的東西（例如序號）留在外面，不吃標題的樣式
        let titleWrap: HTMLElement | null = null
        const words = titleText ? [...titleText.childNodes].filter(node => node instanceof Text && node.data.trim()) : []
        if (words.length) {
          titleWrap = document.createElement('span')
          titleWrap.className = TITLE_TEXT
          words[0].before(titleWrap)
          titleWrap.append(...words)
        }
        record = {
          signature,
          item: {
            id: nextId++, root, labelAnchor, titleAnchor, titleText: titleWrap,
            tags, tagSet: names, complete, ...stars, pages, category, uploader, title, href: link.href,
          },
        }
        records.set(root, record)
      }
      for (const element of options.tagsEnabled() ? root.querySelectorAll<HTMLElement>('[data-evr-tag]') : []) {
        const name = chipName(element)
        if (!name) continue
        seenTags.add(element)
        let chip = bindings.get(element)
        if (!chip || chip.item !== record.item || chip.name !== name) {
          if (chip) release(element)
          decorate(element)
          chip = {
            id: nextId++, item: record.item, name, element, area: element.parentElement!,
            tier: element.classList.contains('gtw') ? 'gtw' : element.classList.contains('gtl') ? 'gtl' : 'gt',
            uploader: element.getAttribute('data-evr-ns') === UPLOADER_NAMESPACE,
          }
          bindings.set(element, chip)
        }
        nextChips.push(chip)
      }
      next.push(record.item)
    }
    for (const [root, record] of records) {
      if (seen.has(root)) continue
      restore(record)
      records.delete(root)
    }
    for (const element of [...bindings.keys()]) {
      if (!seenTags.has(element)) release(element)
    }
    if (next.length !== items.value.length || next.some((item, i) => item !== items.value[i])) items.value = next
    if (nextChips.length !== chips.value.length || nextChips.some((chip, i) => chip !== chips.value[i])) chips.value = nextChips
  }

  // chip 裡面的變動是插件自己畫的（文字、class），不必為它再掃一次
  const OWN_NODES = `.eqt-rule-prototype, .eqt-rule-prototype__mount, .${TITLE_TEXT}, .${CHIP_CLASS}`
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

  watch(options.tagsEnabled, () => scan())

  onMounted(() => {
    scan()
    observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-evr-tags', 'data-evr-uploader', 'data-evr-tag'],
    })
  })
  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    for (const record of records.values()) restore(record)
    records.clear()
  })
  return { items, chips }
}
