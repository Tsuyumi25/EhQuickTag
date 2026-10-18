// 列表上的標籤原地改成 chip：EhViewRefined 畫出的每個標籤都帶 data-evr-tag，元素本身就當 chip 用，
// 外框、尺寸照網站畫好的，這裡只加狀態用的 class、CSS 變數與 data-eqt-*。
// 一顆 chip 不多任何節點：改 class、style、attribute 與文字節點的 data 都不是 childList 變動，
// 監看 DOM 的腳本（翻譯腳本每收到一個新增節點就建一個 NodeIterator）不會被叫醒

export const CHIP_CLASS = 'eqt-listing-chip'
const COLORED = `${CHIP_CLASS}--mytags-colored`
const POSITIVE = `${CHIP_CLASS}--selected-positive`
const NEGATIVE = `${CHIP_CLASS}--selected-negative`
const SCORE = 'data-eqt-score'
const MARK = 'data-eqt-mark'
const VARS = ['--eqt-mytags-background', '--eqt-mytags-text', '--eqt-mytags-border'] as const

export interface ChipPaint {
  display: string
  selection?: 'positive' | 'negative'
  /** My Tags 配色的 CSS 變數；undefined 是不上色 */
  colors?: Record<string, string>
  score: string | null
  /** 禁止圖示畫在分數的位置，兩者只會有一個 */
  hidden: boolean
  watch: boolean
}

interface Original {
  children: Node[]
  /** paint 直接改原本那個文字節點的 data，拆掉時要改回來 */
  texts: (string | null)[]
  translate: string | null
  tabindex: string | null
  role: string | null
}

const originals = new WeakMap<HTMLElement, Original>()

function setAttribute(element: HTMLElement, name: string, value: string | null) {
  if (element.getAttribute(name) === value) return
  if (value === null) element.removeAttribute(name)
  else element.setAttribute(name, value)
}

/**
 * 標籤文字改由插件管：translate="no" 讓翻譯腳本與瀏覽器翻譯跳過它。
 * 加上 button 的語意，鍵盤可以移過去、用 Enter 選取（click 的 detail 是 0）
 */
export function decorate(element: HTMLElement): void {
  if (originals.has(element)) return
  originals.set(element, {
    children: [...element.childNodes],
    texts: [...element.childNodes].map(node => node instanceof Text ? node.data : null),
    translate: element.getAttribute('translate'),
    tabindex: element.getAttribute('tabindex'),
    role: element.getAttribute('role'),
  })
  element.classList.add(CHIP_CLASS)
  element.setAttribute('translate', 'no')
  element.setAttribute('tabindex', '0')
  element.setAttribute('role', 'button')
}

/** 只寫有變的部分，畫第二次一樣的結果不會產生任何 DOM 變動 */
export function paint(element: HTMLElement, chip: ChipPaint): void {
  const only = element.firstChild
  if (only instanceof Text && only === element.lastChild) {
    if (only.data !== chip.display) only.data = chip.display
  } else {
    // 翻譯腳本先一步把文字換成自己的節點時，只能整個換掉，之後就回到單一文字節點
    element.textContent = chip.display
  }
  element.classList.toggle(COLORED, !!chip.colors)
  element.classList.toggle(POSITIVE, chip.selection === 'positive')
  element.classList.toggle(NEGATIVE, chip.selection === 'negative')
  for (const name of VARS) {
    const value = chip.colors?.[name] ?? ''
    if (element.style.getPropertyValue(name) !== value) {
      if (value) element.style.setProperty(name, value)
      else element.style.removeProperty(name)
    }
  }
  setAttribute(element, SCORE, chip.hidden ? null : chip.score)
  setAttribute(element, MARK, [chip.watch && 'watch', chip.hidden && 'hidden'].filter(Boolean).join(' ') || null)
}

export function undecorate(element: HTMLElement): void {
  const original = originals.get(element)
  if (!original) return
  originals.delete(element)
  element.classList.remove(CHIP_CLASS, COLORED, POSITIVE, NEGATIVE)
  for (const name of VARS) element.style.removeProperty(name)
  if (!element.getAttribute('style')) element.removeAttribute('style')
  element.removeAttribute(SCORE)
  element.removeAttribute(MARK)
  setAttribute(element, 'translate', original.translate)
  setAttribute(element, 'tabindex', original.tabindex)
  setAttribute(element, 'role', original.role)
  const unchanged = original.children.length === element.childNodes.length
    && original.children.every((node, index) => node === element.childNodes[index])
  if (!unchanged) element.replaceChildren(...original.children)
  original.children.forEach((node, index) => {
    const text = original.texts[index]
    if (node instanceof Text && text !== null && node.data !== text) node.data = text
  })
}

/** 圖示從 lucide 的 Vue 元件畫一次轉成 mask，chip 用 CSS 變數取用，不必每顆都插一個 svg */
export function installChipIcons(icons: Record<string, string>): void {
  const id = 'eqt-listing-chip-icons'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `:root { ${Object.entries(icons)
    .map(([name, svg]) => `--eqt-listing-chip-${name}: url("data:image/svg+xml,${encodeURIComponent(svg)}");`)
    .join(' ')} }`
  document.head.append(style)
}
