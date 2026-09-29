import { describe, it, expect } from 'vitest'
import type { MyTagRow } from '@/composables/useEhMyTagsHost'
import {
  acknowledgeWrite, carryEdits, effective, stage, stageMany, unstage,
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

describe('acknowledgeWrite', () => {
  it('成功回應只清除已送出的值，保留等待期間的後續修改與其他標籤草稿', () => {
    const saved = row()
    const sent = effective(saved, stage({}, saved, { weight: -20 }))
    const edits = stage({ 2: { color: '#123456' } }, saved, { weight: -35, watch: true })
    expect(acknowledgeWrite(edits, saved.id, sent, effective(saved, edits))).toEqual({
      1: { weight: -35, watch: true },
      2: { color: '#123456' },
    })
  })

  it('等待期間改回原值仍是相對於已送出值的待套用修改', () => {
    const saved = row()
    const sent = effective(saved, { 1: { weight: -20 } })
    expect(acknowledgeWrite({}, saved.id, sent, effective(saved, {}))).toEqual({
      1: { weight: 10 },
    })
  })

  it('目前想要的狀態已全部送出時清除該列草稿', () => {
    const saved = row()
    const edits = stage({}, saved, { hidden: true })
    const sent = effective(saved, edits)
    expect(acknowledgeWrite(edits, saved.id, sent, sent)).toEqual({})
  })
})

describe('carryEdits', () => {
  it('搬移後欄位修改接到同名的新列，不管 tagid 有沒有換', () => {
    const before = row({ id: 1, tagSet: '1' })
    const after = row({ id: 9, tagSet: '2' })
    expect(carryEdits({}, { 1: { weight: 41 } }, [before], [after])).toEqual({ 9: { weight: 41 } })
  })

  it('新列已經是那個值就不留草稿；目標組讀不到就放掉', () => {
    const before = row({ id: 1 })
    expect(carryEdits({}, { 1: { weight: 41 } }, [before], [row({ id: 9, weight: 41 })])).toEqual({})
    expect(carryEdits({}, { 1: { weight: 41 } }, [before], [])).toEqual({})
  })
})
