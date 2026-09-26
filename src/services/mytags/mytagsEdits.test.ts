import { describe, it, expect } from 'vitest'
import type { MyTagRow } from '@/composables/useEhMyTagsHost'
import {
  effective, stage, stageMany, unstage,
  type EditMap,
} from '@/services/mytags/mytagsEdits'

function row(over: Partial<MyTagRow> = {}): MyTagRow {
  return {
    id: 1, full: 'male:example', weight: 10, hidden: false, watch: false,
    color: '', tagSet: '1', ...over,
  }
}

describe('stage', () => {
  it('只保存使用者改過的欄位', () => {
    expect(stage({}, row(), { weight: -20 })).toEqual({ 1: { weight: -20 } })
  })

  it('連續編輯疊在同一份 patch，改回 EH 現值的欄位會移除', () => {
    const saved = row()
    let edits = stage({}, saved, { weight: -20 })
    edits = stage(edits, saved, { color: '#FF0000' })
    expect(edits[1]).toEqual({ weight: -20, color: '#FF0000' })

    edits = stage(edits, saved, { weight: 10 })
    expect(edits[1]).toEqual({ color: '#FF0000' })
    edits = stage(edits, saved, { color: '' })
    expect(edits).toEqual({})
  })

  it('EH row 更新後，未編輯欄位沿用最新值', () => {
    const edits = stage({}, row(), { weight: -20 })
    expect(effective(row({ color: '#FF0000' }), edits)).toEqual({
      weight: -20,
      hidden: false,
      watch: false,
      color: '#FF0000',
    })
  })

  it('EH row 已經等於 pending 欄位時，下一次編輯會清掉冗餘 patch', () => {
    const edits: EditMap = { 1: { weight: -20 } }
    expect(stage(edits, row({ weight: -20 }), { color: '#FF0000' })).toEqual({
      1: { color: '#FF0000' },
    })
  })

  it('開啟 hidden 會關閉 watch', () => {
    expect(stage({}, row({ watch: true }), { hidden: true })[1]).toEqual({
      hidden: true,
      watch: false,
    })
  })

  it('開啟 watch 會關閉 hidden', () => {
    expect(stage({}, row({ hidden: true }), { watch: true })[1]).toEqual({
      hidden: false,
      watch: true,
    })
  })
})

describe('effective', () => {
  it('沒有 pending 時直接使用 EH row', () => {
    const saved = row()
    expect(effective(saved, {})).toEqual({
      weight: 10,
      hidden: false,
      watch: false,
      color: '',
    })
  })
})

describe('stageMany', () => {
  it('批次操作只為每一列保存改過的欄位', () => {
    const rows = [row({ id: 1 }), row({ id: 2, full: 'male:other' })]
    expect(stageMany({}, rows, { hidden: true })).toEqual({
      1: { hidden: true },
      2: { hidden: true },
    })
  })
})

describe('unstage', () => {
  it('套用成功的那些從 pending 移除，失敗的留著', () => {
    const edits: EditMap = {
      1: { weight: -1 },
      2: { weight: -2 },
    }
    expect(unstage(edits, [1])).toEqual({ 2: { weight: -2 } })
  })
})
