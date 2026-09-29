// 還沒送出去的欄位修改。
//
// EH rows 是已儲存狀態的唯一來源；這裡只保留使用者改過的欄位，讓修改跨整頁刷新。
// 套用時再把 patch 疊到最新讀到的 row，未碰過的欄位會自然沿用 EH 現況。

import type { MyTagRow } from '@/composables/useEhMyTagsHost'

export interface TagState {
  weight: number
  hidden: boolean
  watch: boolean
  color: string
}

export type TagPatch = Partial<TagState>

export type PendingEdit = TagPatch & {
  destination?: { full: string; tagSet: string }
}

export type EditMap = Record<number, PendingEdit>

export function stateOf(row: MyTagRow): TagState {
  return { weight: row.weight, hidden: row.hidden, watch: row.watch, color: row.color }
}

/** EH 已儲存狀態疊上還沒送出的欄位修改 */
export function effective(row: MyTagRow, edits: EditMap): TagState {
  const patch = edits[row.id]
  return {
    weight: patch?.weight ?? row.weight,
    hidden: patch?.hidden ?? row.hidden,
    watch: patch?.watch ?? row.watch,
    color: patch?.color ?? row.color,
  }
}

function difference(saved: TagState, want: TagState): TagPatch | null {
  const patch: TagPatch = {}
  if (want.weight !== saved.weight) patch.weight = want.weight
  if (want.hidden !== saved.hidden) patch.hidden = want.hidden
  if (want.watch !== saved.watch) patch.watch = want.watch
  if (want.color !== saved.color) patch.color = want.color
  return Object.keys(patch).length ? patch : null
}

/**
 * 記下使用者改過的欄位。
 *
 * watch 和 hidden 互斥——EH 自己的 onchange 就會互相取消，我們照做，避免面板
 * 產生原生頁面表達不出的狀態。
 */
export function stage(edits: EditMap, row: MyTagRow, change: TagPatch): EditMap {
  const saved = stateOf(row)
  const want: TagState = { ...saved, ...edits[row.id], ...change }
  if (change.hidden === true) want.watch = false
  if (change.watch === true) want.hidden = false

  const next = { ...edits }
  const patch = difference(saved, want)
  const destination = edits[row.id]?.destination
  if (destination) next[row.id] = { ...patch, destination }
  else if (patch) next[row.id] = patch
  else delete next[row.id]
  return next
}

/** 批次操作。一筆一筆疊上去，回到 EH 現值的欄位自然會被丟掉 */
export function stageMany(
  edits: EditMap,
  rows: MyTagRow[],
  change: TagPatch,
): EditMap {
  return rows.reduce((acc, row) => stage(acc, row, change), edits)
}

export function unstage(edits: EditMap, ids: number[]): EditMap {
  const next = { ...edits }
  for (const id of ids) delete next[id]
  return next
}

export function acknowledgeWrite(
  edits: EditMap,
  id: number,
  written: TagState,
  wanted: TagState,
): EditMap {
  const next = { ...edits }
  const patch = difference(written, wanted)
  if (patch) next[id] = patch
  else delete next[id]
  return next
}

export function markMovingEdits(
  edits: EditMap,
  rows: readonly MyTagRow[],
  tagSet: string,
): EditMap {
  const next = { ...edits }
  for (const row of rows) {
    if (next[row.id]) next[row.id] = { ...next[row.id], destination: { full: row.full, tagSet } }
  }
  return next
}

export function reconcileMovedEdits(edits: EditMap, rows: readonly MyTagRow[]): EditMap {
  let next = edits
  for (const [key, patch] of Object.entries(edits)) {
    const destination = patch.destination
    if (!destination) continue
    const id = Number(key)
    const target = rows.find(row => row.id === id && row.tagSet !== destination.tagSet)
      ?? rows.find(row => row.full === destination.full && row.tagSet === destination.tagSet)
    if (target) next = stage(unstage(next, [id]), target, patch)
  }
  return next
}
