export enum TagState {
  Off = 0,
  Include = 1,
  Or = 2,
  Exclude = 3,
}

export type TagMode = 'or' | 'exclude'

// --- Button = TagButton | UrlButton ---
// 用 discriminated union 表達「tag 按鈕 vs URL 按鈕」xor，取代舊版以
// `tag === '' && url !== ''` 當 URL discriminant 的 hack。

export interface TagButton {
  kind: 'tag'
  tags: string[]                       // 一個按鈕可對應多個 tag（送出時一起加進搜尋）
  label?: string
  color?: string
  disabledModes?: readonly TagMode[]   // 限定右鍵 cycle 可用的 mode（or / exclude）
}

export interface UrlButton {
  kind: 'url'
  url: string
  label?: string
  color?: string
}

export type Button = TagButton | UrlButton

// --- Line = ButtonLine | SeparatorLine ---
// 用 discriminated union 表達「按鈕列 vs 分隔線」xor，取代舊版用
// `separator?` 的存在與否判斷的 runtime 約定。

export interface ButtonLine {
  kind: 'buttons'
  buttons: Button[]
  color?: string                       // 行主色（fallback 給沒指定色的 button）
}

export interface SeparatorLine {
  kind: 'separator'
  label?: string                       // 文字（顯示在線的位置之外，避免遮擋）
  style?: SeparatorStyle               // 視覺微調 namespace；未設欄位由 CSS class 給預設
  color?: string                       // 行主色（影響線色 + label 文字色）
}

export interface SeparatorStyle {
  line?: 'solid' | 'dashed' | 'none'
  linePosition?: 'top' | 'middle' | 'bottom'  // 線在 label 的上 / 中 / 下；middle 模式線會避開 label
  textAlign?: 'left' | 'center' | 'right'
  textSize?: number
  lineThickness?: number
  lineLength?: number  // 1-100 (%)，預設 100；依 textAlign 從對應端內縮
}

export type Line = ButtonLine | SeparatorLine
