// 標籤的配色，照 EH 自己的規則算。
//
// ⭐ 為什麼要重算而不是抬 DOM 上現成的：`#tagpreview_*` 那組 inline style 是 EH 的
// JS 在頁面上算出來的，而別的標籤集是我們 fetch 回來用 DOMParser 解析的——那份
// document 不會執行 JS，所以別組的標籤根本沒有那組 style。自己算才能讓每一組長得
// 一樣，而且改了顏色可以當場反映，不必等套用。
//
// 演算法出自 ehg_mytags.c.js 的 update_tagpreview()。

export interface TagColors {
  /** 文字色。EH 只用黑或白兩種，看底色亮度決定 */
  text: string
  /** 邊框色，也是原生 radial-gradient 的中心色 */
  face: string
  /** 原生 radial-gradient 的外圈色 */
  edge: string
}

/** 沒設色也沒有標籤集預設色時，EH 用權重決定：能過線的藍色，會被擋的紅色 */
const NEUTRAL = '3377FF'
const NEGATIVE = 'FF6666'

/** 亮度分界。EH 用的是標準 luma 加權，這個門檻是它寫死的 */
const LUMA_SPLIT = 151
/** 深色變體的偏移量，同樣是 EH 寫死的 */
const DARKEN = 32

function clampByte(n: number): string {
  return Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0')
}

export interface TagColorInput {
  /** 標籤自己設的顏色，可帶或不帶 `#` */
  color: string
  /** 所屬標籤集的預設色。標籤沒設色時用它 */
  setColor: string
  weight: number
  hidden: boolean
}

export function tagColors({ color, setColor, weight, hidden }: TagColorInput): TagColors {
  let base = color.replace('#', '')
  if (!base) base = setColor.replace('#', '')
  if (!base) base = !hidden && weight >= 0 ? NEUTRAL : NEGATIVE

  const r = parseInt(base.slice(0, 2), 16)
  const g = parseInt(base.slice(2, 4), 16)
  const b = parseInt(base.slice(4, 6), 16)
  // 壞掉的色碼不要算出 NaN 再吐給 CSS——那會讓整顆 chip 沒有顏色
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return { text: '090909', face: NEUTRAL, edge: NEUTRAL }
  }

  const light = 0.299 * r + 0.587 * g + 0.114 * b > LUMA_SPLIT
  const darker = clampByte(r - DARKEN) + clampByte(g - DARKEN) + clampByte(b - DARKEN)

  return {
    text: light ? '090909' : 'f1f1f1',
    // 亮底時原色當面、深色當外圈；暗底時對調。這一步是 EH 的，照抄
    face: light ? base : darker,
    edge: light ? darker : base,
  }
}
