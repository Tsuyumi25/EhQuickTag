// 命中的規則效果換成圖庫卡片上的 class 與 CSS 變數；樣式表照這些畫，元件只負責把它們套到卡片上

import type { PrefixMark, RuleEffects } from './galleryRules'

/** 強度 100 的樣子：模糊半徑、馬賽克格子邊長（px）與淡化後的不透明度 */
export const MAX_BLUR = 16
export const MAX_MOSAIC = 16
export const MIN_OPACITY = 0.35
/** 格子小於 2px 就跟原圖看不出差別，有開就從這裡起跳 */
const MIN_MOSAIC = 2
/**
 * 有背景色時色塊左右比字多出來的寬度。上下不能加：行內元素的背景本來就畫滿字的高度，
 * 縮圖標題（g.css 的 .gl4t）是 10pt 字配 16px 行高，字高已經佔掉 15px 多，上下再撐開就會
 * 疊到上一行與下一行，在 overflow: hidden 的標題框邊緣被裁掉，半透明的色塊重疊處還會變深
 */
const TEXT_BACKGROUND_PAD = '0.45em'

export const CARD_MODIFIERS = ['background', 'blur', 'dim', 'hidden'] as const
export type CardModifier = (typeof CARD_MODIFIERS)[number]

export const CARD_VARS = [
  '--eqt-listing-rules-background',
  '--eqt-listing-rules-opacity',
  '--eqt-listing-rules-cover-filter',
  '--eqt-listing-rules-title-color',
  '--eqt-listing-rules-title-background',
  '--eqt-listing-rules-title-radius',
  '--eqt-listing-rules-title-pad',
  '--eqt-listing-rules-title-decoration',
  '--eqt-listing-rules-title-weight',
  '--eqt-listing-rules-title-style',
] as const
export type CardVar = (typeof CARD_VARS)[number]

export interface CardStyle {
  modifiers: Record<CardModifier, boolean>
  /** null 是不設，樣式表用它自己的預設值 */
  vars: Record<CardVar, string | null>
}

export function mosaicCell(amount: number): number {
  return Math.max(MIN_MOSAIC, Math.round((amount / 100) * MAX_MOSAIC))
}

export function mosaicFilterId(cell: number): string {
  return `eqt-rule-mosaic-${cell}`
}

/**
 * 每種格子大小一個 SVG 濾鏡：每格取中間一點的顏色，再膨脹回整格。
 * 濾鏡的尺寸寫死在定義裡，CSS 改不了，所以把可能用到的大小都先定義好
 */
export function mosaicFiltersSvg(): string {
  const filters: string[] = []
  for (let cell = MIN_MOSAIC; cell <= MAX_MOSAIC; cell++) {
    const half = cell / 2
    filters.push(`<filter id="${mosaicFilterId(cell)}" x="0" y="0" width="100%" height="100%">`
      + `<feFlood x="${Math.floor(half)}" y="${Math.floor(half)}" width="1" height="1"/>`
      + `<feComposite width="${cell}" height="${cell}"/>`
      + '<feTile result="tiles"/>'
      + '<feComposite in="SourceGraphic" in2="tiles" operator="in"/>'
      + `<feMorphology operator="dilate" radius="${half}"/>`
      + '</filter>')
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">${filters.join('')}</svg>`
}

const MOSAIC_FILTERS_ID = 'eqt-rule-mosaic-filters'

/** CSS 的 filter: url(#…) 只認得文件裡的元素，列表與規則頁的預覽共用同一份，裝過就不再裝 */
export function installMosaicFilters(doc: Document): void {
  if (doc.getElementById(MOSAIC_FILTERS_ID)) return
  const holder = doc.createElement('div')
  holder.id = MOSAIC_FILTERS_ID
  holder.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden'
  holder.setAttribute('aria-hidden', 'true')
  holder.innerHTML = mosaicFiltersSvg()
  doc.body.append(holder)
}

function coverFilter(effects: RuleEffects): string | null {
  if (!effects.blur) return null
  if (effects.blurMode === 'mosaic') return `url(#${mosaicFilterId(mosaicCell(effects.blur))})`
  return `blur(${Math.round((effects.blur / 100) * MAX_BLUR * 10) / 10}px)`
}

export function cardStyle(effects: RuleEffects): CardStyle {
  const { title } = effects
  const decoration = [title.underline && 'underline', title.strike && 'line-through'].filter(Boolean).join(' ')
  return {
    modifiers: { background: !!effects.background, blur: effects.blur > 0, dim: effects.dim > 0, hidden: effects.hide },
    vars: {
      '--eqt-listing-rules-background': effects.background,
      '--eqt-listing-rules-opacity': effects.dim ? String(1 - (effects.dim / 100) * (1 - MIN_OPACITY)) : null,
      '--eqt-listing-rules-cover-filter': coverFilter(effects),
      '--eqt-listing-rules-title-color': title.color,
      '--eqt-listing-rules-title-background': title.background,
      '--eqt-listing-rules-title-radius': title.background ? `${title.radius}px` : null,
      '--eqt-listing-rules-title-pad': title.background ? TEXT_BACKGROUND_PAD : null,
      '--eqt-listing-rules-title-decoration': decoration || null,
      '--eqt-listing-rules-title-weight': title.bold ? 'bold' : null,
      '--eqt-listing-rules-title-style': title.italic ? 'italic' : null,
    },
  }
}

export function prefixStyle(prefix: PrefixMark): Record<string, string> {
  const style: Record<string, string> = {}
  if (prefix.tone) style['--eqt-listing-rules-tone'] = prefix.tone
  if (prefix.color) style['--eqt-listing-rules-prefix-color'] = prefix.color
  if (prefix.background) {
    style['--eqt-listing-rules-prefix-background'] = prefix.background
    style['--eqt-listing-rules-prefix-radius'] = `${prefix.radius}px`
    style['--eqt-listing-rules-prefix-pad'] = TEXT_BACKGROUND_PAD
  }
  return style
}
