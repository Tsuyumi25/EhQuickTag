// 標籤的選取狀態：數線上的 -1 排除、0 沒選、1 包含，加上不在數線上的 OR，
// 對應搜尋語法的 -X／（無）／X／~X。tagbar、搜尋面板、搜尋 popup 與 tagging list 共用同一套按法：
//   - 數線照加減走：左鍵 +1、右鍵 −1，夾在 [-1, 1]
//   - 中鍵從任何地方進 OR
//   - 離開 OR 的路線查 FROM_OR：左鍵回到包含、右鍵清掉

export type TagPick = -1 | 0 | 1 | 'or'

/** 按下去的鍵，也是非零狀態的名字：左鍵 positive、右鍵 negative、中鍵 or */
export type Selection = 'positive' | 'negative' | 'or'

const FROM_OR: Record<Selection, TagPick> = { positive: 1, negative: 0, or: 'or' }

/** allowed：這個標籤能停的狀態；落點不在裡面時原地不動 */
export function stepPick(pick: TagPick, press: Selection, allowed?: ReadonlySet<TagPick>): TagPick {
  const next = rawStep(pick, press)
  return allowed && !allowed.has(next) ? pick : next
}

function rawStep(pick: TagPick, press: Selection): TagPick {
  if (pick === 'or') return FROM_OR[press]
  if (press === 'or') return 'or'
  if (press === 'positive') return pick === -1 ? 0 : 1
  return pick === 1 ? 0 : -1
}

const PICK_OF: Record<Selection, TagPick> = { positive: 1, negative: -1, or: 'or' }

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
