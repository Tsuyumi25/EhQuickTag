// 還沒送出去的編輯。
//
// 原生 UI 被蓋住之後就沒有人會動那些輸入框，所以它們的值等同「EH 上現在是什麼」。
// 使用者的編輯住在這裡，兩者比對就是 dirty。
//
// ⭐ 每一筆都記著「編的時候 EH 上是什麼」（basedOn）。套用前拿它跟現況比對，不一樣
// 就代表這個標籤在別的地方被改過了——那時候硬套會把別人的修改吃掉，所以要先問。
// 這一格是延後送出的代價：改完立刻送就不需要它。

import type { MyTagRow } from '@/composables/useEhMyTagsHost'

export interface TagState {
  weight: number
  hidden: boolean
  watch: boolean
  color: string
}

export interface TagEdit {
  want: TagState
  basedOn: TagState
}

/** key 是 tagid */
export type EditMap = Record<number, TagEdit>

export function stateOf(row: MyTagRow): TagState {
  return { weight: row.weight, hidden: row.hidden, watch: row.watch, color: row.color }
}

export function sameState(a: TagState, b: TagState): boolean {
  return a.weight === b.weight && a.hidden === b.hidden
    && a.watch === b.watch && a.color === b.color
}

/** 這個標籤現在應該長什麼樣：已存值疊上還沒送出的編輯 */
export function effective(row: MyTagRow, edits: EditMap): TagState {
  return edits[row.id]?.want ?? stateOf(row)
}

/**
 * 記一筆編輯。
 *
 * ⚠️ watch 和 hidden 互斥——EH 自己的 onchange 就會互相取消，我們照做，否則面板
 * 上會出現一個原生頁面表達不出來的狀態。
 *
 * 改回跟已存值一樣就把整筆丟掉：留著會讓「還有 N 個沒套用」數到根本沒變的東西。
 */
export function stage(edits: EditMap, row: MyTagRow, patch: Partial<TagState>): EditMap {
  const saved = stateOf(row)
  const want: TagState = { ...effective(row, edits), ...patch }
  if (patch.hidden === true) want.watch = false
  if (patch.watch === true) want.hidden = false

  const next = { ...edits }
  if (sameState(want, saved)) delete next[row.id]
  else next[row.id] = { want, basedOn: saved }
  return next
}

/** 批次操作。一筆一筆疊上去，回到已存值的那些自然會被丟掉 */
export function stageMany(
  edits: EditMap,
  rows: MyTagRow[],
  patch: Partial<TagState>,
): EditMap {
  return rows.reduce((acc, row) => stage(acc, row, patch), edits)
}

export function unstage(edits: EditMap, ids: number[]): EditMap {
  const next = { ...edits }
  for (const id of ids) delete next[id]
  return next
}

export interface PendingSplit {
  /** basedOn 跟現況一致，可以直接送 */
  ready: MyTagRow[]
  /** 這個標籤在別的地方被改過了，硬套會吃掉那份修改 */
  conflicted: MyTagRow[]
  /** 編輯的對象已經不在清單裡（被刪掉了） */
  orphaned: number[]
}

export function splitPending(rows: MyTagRow[], edits: EditMap): PendingSplit {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out: PendingSplit = { ready: [], conflicted: [], orphaned: [] }

  for (const key of Object.keys(edits)) {
    const id = Number(key)
    const row = byId.get(id)
    if (!row) { out.orphaned.push(id); continue }
    if (sameState(edits[id].basedOn, stateOf(row))) out.ready.push(row)
    else out.conflicted.push(row)
  }
  return out
}

/** 衝突的那些放棄自己的版本，改以現況為準重新開始 */
export function rebase(edits: EditMap, rows: MyTagRow[]): EditMap {
  const next = { ...edits }
  for (const row of rows) {
    const edit = next[row.id]
    if (!edit) continue
    const saved = stateOf(row)
    if (sameState(edit.want, saved)) delete next[row.id]
    else next[row.id] = { want: edit.want, basedOn: saved }
  }
  return next
}
