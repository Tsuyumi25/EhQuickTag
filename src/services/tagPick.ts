// 標籤的選取狀態：-1 排除、0 沒選、1 包含、OR，對應搜尋語法的 -X／（無）／X／~X。
// tagbar、搜尋面板、搜尋 popup 與 tagging list 共用同一套按法：三顆鍵各自擁有一個非零狀態
// （左鍵 1、右鍵 -1、中鍵 OR），按下去就切到那顆鍵的狀態；已經在那個狀態時同一顆鍵把它關回 0。
// 結果是誰最後激活，就得由誰關掉——左鍵激活後按右鍵會換成排除，要再按右鍵才回 0。

export type TagPick = -1 | 0 | 1 | 'or'

/** 按下去的鍵，也是非零狀態的名字：左鍵 positive、右鍵 negative、中鍵 or */
export type Selection = 'positive' | 'negative' | 'or'

const PICK_OF: Record<Selection, TagPick> = { positive: 1, negative: -1, or: 'or' }

/** allowed：這個標籤能停的狀態；落點不在裡面時原地不動 */
export function stepPick(pick: TagPick, press: Selection, allowed?: ReadonlySet<TagPick>): TagPick {
  const next = rawStep(pick, press)
  return allowed && !allowed.has(next) ? pick : next
}

function rawStep(pick: TagPick, press: Selection): TagPick {
  const owned = PICK_OF[press]
  return pick === owned ? 0 : owned
}

export function pickOf(selection: Selection | undefined): TagPick {
  return selection ? PICK_OF[selection] : 0
}

export function selectionOf(pick: TagPick): Selection | undefined {
  if (pick === 1) return 'positive'
  if (pick === -1) return 'negative'
  if (pick === 'or') return 'or'
  return undefined
}

/** 搜尋語法的前綴；0 不會出現在搜尋裡 */
export function prefixOf(selection: Selection): '' | '-' | '~' {
  if (selection === 'negative') return '-'
  if (selection === 'or') return '~'
  return ''
}
