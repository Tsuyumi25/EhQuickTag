import { describe, it, expect } from 'vitest'
import type { MyTagRow } from '@/composables/useEhMyTagsHost'
import type { EditMap } from '@/services/mytags/mytagsEdits'
import {
  emptyBulkDraft, planTagChanges,
  type BulkDraft,
} from '@/services/mytags/mytagsBulk'

function row(over: Partial<MyTagRow> = {}): MyTagRow {
  return {
    id: 1, full: 'male:example', weight: 10, hidden: false, watch: false,
    color: '', tagSet: '1', ...over,
  }
}

function draft(over: Partial<BulkDraft> = {}): BulkDraft {
  return { ...emptyBulkDraft(), ...over }
}

const rows = [
  row({ id: 1 }),
  row({ id: 2, full: 'male:other' }),
  row({ id: 3, full: 'male:third', tagSet: '2' }),
]

describe('planTagChanges', () => {
  it('批次只疊在選取列上，未選取的保留個別編輯', () => {
    const base: EditMap = { 1: { weight: -20 }, 2: { color: '#FF0000' } }
    const plan = planTagChanges(rows, base, draft({ ids: [1], patch: { hidden: true } }))

    expect(plan.edits).toEqual({
      1: { weight: -20, hidden: true },
      2: { color: '#FF0000' },
    })
    expect(plan.changes.map((c) => [c.row.id, c.write, c.state])).toEqual([
      [1, true, { weight: -20, hidden: true, watch: false, color: '' }],
      [2, true, { weight: 10, hidden: false, watch: false, color: '#FF0000' }],
    ])
  })

  it('不動到傳進來的 edits', () => {
    const base: EditMap = { 1: { weight: -20 } }
    planTagChanges(rows, base, draft({ ids: [1, 2], patch: { watch: true }, action: { kind: 'delete' } }))
    expect(base).toEqual({ 1: { weight: -20 } })
  })

  it('批次開啟 watch 會關掉 hidden，不論 hidden 來自個別編輯或伺服器', () => {
    const staged = planTagChanges(rows, { 1: { hidden: true } }, draft({ ids: [1], patch: { watch: true } }))
    expect(staged.edits[1]).toEqual({ watch: true })
    expect(staged.changes[0]?.state).toMatchObject({ hidden: false, watch: true })

    const saved = [row({ id: 1, hidden: true })]
    const persisted = planTagChanges(saved, {}, draft({ ids: [1], patch: { watch: true } }))
    expect(persisted.edits[1]).toEqual({ hidden: false, watch: true })
    expect(persisted.changes[0]?.state).toMatchObject({ hidden: false, watch: true })
  })

  it('批次把欄位改回 EH 現值時整列不算改動', () => {
    const base: EditMap = { 1: { weight: -20 } }
    const plan = planTagChanges(rows, base, draft({ ids: [1], patch: { weight: 10 } }))
    expect(plan.edits).toEqual({})
    expect(plan.changes).toEqual([])
  })

  it('個別編輯已經等於伺服器值時不產生寫入', () => {
    const saved = [row({ id: 1, weight: -20 })]
    const plan = planTagChanges(saved, { 1: { weight: -20 } }, emptyBulkDraft())
    expect(plan.changes).toEqual([])
  })

  it('刪除蓋掉欄位寫入與搬移，並丟掉那些列的編輯', () => {
    const base: EditMap = { 1: { weight: -20 }, 2: { color: '#FF0000' } }
    const plan = planTagChanges(
      rows,
      base,
      draft({ ids: [1, 3], patch: { hidden: true }, action: { kind: 'delete' } }),
    )

    expect([...plan.deletedIds]).toEqual([1, 3])
    expect(plan.edits).toEqual({ 2: { color: '#FF0000' } })
    expect(plan.changes).toEqual([
      { row: rows[0], state: { weight: 10, hidden: false, watch: false, color: '' }, write: false, moveTo: null, remove: true },
      { row: rows[1], state: { weight: 10, hidden: false, watch: false, color: '#FF0000' }, write: true, moveTo: null, remove: false },
      { row: rows[2], state: { weight: 10, hidden: false, watch: false, color: '' }, write: false, moveTo: null, remove: true },
    ])
  })

  it('搬到原本那一組不算改動，換組的列只出現一次', () => {
    const plan = planTagChanges(
      rows,
      {},
      draft({ ids: [1, 3], patch: { weight: -20 }, action: { kind: 'move', tagSet: '2' } }),
    )

    expect(plan.changes.map((c) => [c.row.id, c.write, c.moveTo])).toEqual([
      [1, true, '2'],
      [3, true, null],
    ])
  })

  it('選取縮小之後，離開選取的列回到個別編輯', () => {
    const base: EditMap = { 2: { weight: -5 } }
    const patch = { hidden: true }
    const wide = planTagChanges(rows, base, draft({ ids: [1, 2], patch }))
    expect(wide.changes.map((c) => c.row.id)).toEqual([1, 2])

    const narrow = planTagChanges(rows, base, draft({ ids: [2], patch }))
    expect(narrow.edits).toEqual({ 2: { weight: -5, hidden: true } })
    expect(narrow.changes.map((c) => c.row.id)).toEqual([2])
  })

  it('清掉批次草稿就回到個別編輯的投影', () => {
    const base: EditMap = { 1: { weight: -20 } }
    const plan = planTagChanges(rows, base, emptyBulkDraft())
    expect(plan.edits).toEqual(base)
    expect(plan.deletedIds.size).toBe(0)
    expect(plan.changes.map((c) => [c.row.id, c.write, c.moveTo, c.remove])).toEqual([
      [1, true, null, false],
    ])
  })
})
