import type { MyTagRow } from '@/composables/useEhMyTagsHost'
import {
  stateOf, effective, stageMany, unstage,
  type EditMap, type TagPatch, type TagState,
} from '@/services/mytagsEdits'

export interface BulkDraft {
  ids: number[]
  patch: TagPatch
  action: { kind: 'move'; tagSet: string } | { kind: 'delete' } | null
}

export function emptyBulkDraft(): BulkDraft {
  return { ids: [], patch: {}, action: null }
}

export interface TagChange {
  row: MyTagRow
  state: TagState
  write: boolean
  moveTo: string | null
  remove: boolean
}

export interface TagPlan {
  edits: EditMap
  changes: TagChange[]
  deletedIds: Set<number>
}

function differs(saved: TagState, want: TagState): boolean {
  return want.weight !== saved.weight
    || want.hidden !== saved.hidden
    || want.watch !== saved.watch
    || want.color !== saved.color
}

export function planTagChanges(rows: MyTagRow[], edits: EditMap, bulk: BulkDraft): TagPlan {
  const selected = new Set(bulk.ids)
  const picked = rows.filter((row) => selected.has(row.id))
  const dropping = bulk.action?.kind === 'delete'
  const target = bulk.action?.kind === 'move' ? bulk.action.tagSet : null

  const deletedIds = new Set(dropping ? picked.map((row) => row.id) : [])
  const staged = Object.keys(bulk.patch).length && picked.length
    ? stageMany(edits, picked, bulk.patch)
    : edits
  const merged = deletedIds.size ? unstage(staged, [...deletedIds]) : staged

  const changes: TagChange[] = []
  for (const row of rows) {
    const remove = deletedIds.has(row.id)
    const state = effective(row, merged)
    const moveTo = !remove && target !== null && target !== row.tagSet && selected.has(row.id)
      ? target
      : null
    const write = !remove && differs(stateOf(row), state)
    if (write || moveTo || remove) changes.push({ row, state, write, moveTo, remove })
  }
  return { edits: merged, changes, deletedIds }
}
