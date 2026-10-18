// chip 上 My Tags 的分數與標記怎麼顯示。TagChip（Vue）與列表上原地改成 chip 的標籤（直接改 DOM）
// 各畫各的，規則只有這一份，兩邊才不會越改越不一樣

export interface ChipBadgeInput {
  weight?: number
  hidden: boolean
  watch: boolean
  showScore: boolean
  showMarks: boolean
}

export interface ChipBadges {
  watch: boolean
  /** 隱藏的標籤畫禁止圖示，取代分數 */
  hidden: boolean
  /** null 是不顯示；0 也要顯示，代表設過權重 */
  score: string | null
}

export function chipBadges(input: ChipBadgeInput): ChipBadges {
  const hidden = input.showMarks && input.hidden
  const scored = input.showScore && !input.hidden && input.weight !== undefined
  return {
    watch: input.showMarks && input.watch,
    hidden,
    score: scored ? (input.weight! > 0 ? `+${input.weight}` : String(input.weight)) : null,
  }
}

export function myTagsVars(style: { color: string; background: string; borderColor: string }): Record<string, string> {
  return {
    '--eqt-mytags-background': style.background,
    '--eqt-mytags-text': style.color,
    '--eqt-mytags-border': style.borderColor,
  }
}
