import { describe, it, expect } from 'vitest'
import type { MyTagRow } from '@/composables/useEhMyTagsHost'
import {
  stateOf, sameState, effective, stage, unstage, splitPending, rebase,
  type EditMap,
} from '@/services/mytagsEdits'

function row(over: Partial<MyTagRow> = {}): MyTagRow {
  return {
    id: 1, full: 'male:example', weight: 10, hidden: false, watch: false,
    color: '', tagSet: '1', ...over,
  }
}

describe('stage', () => {
  it('改回跟已存值一樣就整筆丟掉——留著會讓「還沒套用 N 個」數到沒變的東西', () => {
    const r = row()
    let edits: EditMap = stage({}, r, { weight: -20 })
    expect(Object.keys(edits)).toHaveLength(1)
    edits = stage(edits, r, { weight: 10 })
    expect(edits).toEqual({})
  })

  it('連續編輯疊在同一筆上，basedOn 始終是已存值', () => {
    const r = row()
    let edits = stage({}, r, { weight: -20 })
    edits = stage(edits, r, { color: '#FF0000' })
    expect(edits[1].want).toEqual({ weight: -20, hidden: false, watch: false, color: '#FF0000' })
    expect(edits[1].basedOn).toEqual(stateOf(r))
  })

  it('watch 和 hidden 互斥——EH 自己的 onchange 就會互相取消', () => {
    const r = row({ watch: true })
    const edits = stage({}, r, { hidden: true })
    expect(edits[1].want).toMatchObject({ hidden: true, watch: false })
  })

  it('effective 是已存值疊上編輯', () => {
    const r = row()
    expect(effective(r, {})).toEqual(stateOf(r))
    expect(effective(r, stage({}, r, { weight: -5 })).weight).toBe(-5)
  })
})

describe('splitPending', () => {
  const r = row()

  it('basedOn 跟現況一致就可以直接送', () => {
    const s = splitPending([r], stage({}, r, { weight: -20 }))
    expect(s.ready.map((x) => x.id)).toEqual([1])
    expect(s.conflicted).toEqual([])
  })

  it('已存值在別的地方被改過就是衝突，不能硬套', () => {
    const edits = stage({}, r, { weight: -20 })
    const moved = row({ weight: 50 })          // 別的分頁 / 別的裝置改過
    const s = splitPending([moved], edits)
    expect(s.ready).toEqual([])
    expect(s.conflicted.map((x) => x.id)).toEqual([1])
  })

  it('對象已經被刪掉的編輯是孤兒', () => {
    expect(splitPending([], stage({}, r, { weight: -20 })).orphaned).toEqual([1])
  })
})

describe('rebase', () => {
  it('以現況為準重新開始，想要的值留著', () => {
    const edits = stage({}, row(), { weight: -20 })
    const moved = row({ weight: 50 })
    const next = rebase(edits, [moved])
    expect(next[1].want.weight).toBe(-20)
    expect(next[1].basedOn.weight).toBe(50)
  })

  it('現況剛好變成想要的值，那筆就沒事做了', () => {
    const edits = stage({}, row(), { weight: -20 })
    expect(rebase(edits, [row({ weight: -20 })])).toEqual({})
  })
})

describe('unstage', () => {
  it('套用成功的那些從 pending 移除，失敗的留著', () => {
    const a = row({ id: 1 })
    const b = row({ id: 2, full: 'male:other' })
    let edits = stage({}, a, { weight: -1 })
    edits = stage(edits, b, { weight: -2 })
    expect(Object.keys(unstage(edits, [1]))).toEqual(['2'])
  })
})

describe('sameState', () => {
  it('四個欄位全部相等才算沒變', () => {
    expect(sameState(stateOf(row()), stateOf(row()))).toBe(true)
    expect(sameState(stateOf(row()), stateOf(row({ color: '#111111' })))).toBe(false)
  })
})
