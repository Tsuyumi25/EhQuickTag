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

export interface TagLine {
  tags: QuickTag[]
  color?: string
}

export function splitMultiTag(tag: string): string[] {
  return tag.split(',').map(s => s.trim()).filter(Boolean)
}