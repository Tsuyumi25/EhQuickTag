export enum TagState {
  Off = 0,
  Include = 1,
  Or = 2,
  Exclude = 3,
}

export type TagMode = 'or' | 'exclude'

export interface QuickTag {
  tag: string
  label?: string
  url?: string
  disabledModes?: readonly TagMode[]
  color?: string
}

export type SeparatorStyle = 'solid' | 'dashed' | 'none'
export type SeparatorPreset = 'divider' | 'header'
export type SeparatorTextAlign = 'left' | 'center'

export interface LineSeparator {
  label?: string
  style: SeparatorStyle           // 'none' = 沒有線
  preset?: SeparatorPreset        // default 'divider'
  textAlign?: SeparatorTextAlign  // default 'center'
  textSize?: number               // px, default 12
  lineThickness?: number          // px, default 2
}

export interface TagLine {
  tags: QuickTag[]
  color?: string
  separator?: LineSeparator
}

export function splitMultiTag(tag: string): string[] {
  return tag.split(',').map(s => s.trim()).filter(Boolean)
}