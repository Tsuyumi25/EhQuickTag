import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { itemsWithin, layoutList, stickyHead } from './tagListLayout'

const SIZES = { row: 84, head: 28 }
const groupOf = (row: string) => row.split(':')[0]

describe('layoutList', () => {
  it('分組時每組前面插一個帶筆數的標題，位置是前面高度的累加', () => {
    const { items, heads, total } = layoutList(['a:1', 'a:2', 'b:1'], SIZES, groupOf)
    expect(items.map((item) => [item.kind, item.top])).toEqual([
      ['head', 0], ['row', 28], ['row', 112], ['head', 196], ['row', 224],
    ])
    expect(heads.map((head) => [head.group, head.count])).toEqual([['a', 2], ['b', 1]])
    expect(total).toBe(308)
  })

  it('不分組時沒有標題', () => {
    const { items, heads, total } = layoutList(['a:1', 'b:1'], SIZES)
    expect(heads).toEqual([])
    expect(items.map((item) => item.top)).toEqual([0, 84])
    expect(total).toBe(168)
  })
})

describe('itemsWithin', () => {
  const rowsArb = fc.array(fc.constantFrom('a:x', 'b:x', 'c:x'), { maxLength: 40 })
    .map((rows) => [...rows].sort())

  test.prop([rowsArb, fc.integer({ min: -200, max: 4000 }), fc.integer({ min: 0, max: 1500 })])(
    '跟逐項檢查交集的結果一樣',
    (rows, from, span) => {
      const { items } = layoutList(rows, SIZES, groupOf)
      const brute = items.filter((item) => item.top + item.height > from && item.top < from + span)
      expect(itemsWithin(items, from, from + span)).toEqual(brute)
    },
  )
})

describe('stickyHead', () => {
  const { heads } = layoutList(['a:1', 'a:2', 'b:1'], SIZES, groupOf)

  it('捲在組中間時黏著那一組，不位移', () => {
    expect(stickyHead(heads, 100)).toEqual({ head: heads[0], offset: 0 })
  })

  it('下一組的標題頂上來時把目前的往上推，跨過去就換組', () => {
    expect(stickyHead(heads, 196 - 10)?.offset).toBe(-18)
    expect(stickyHead(heads, 196)).toEqual({ head: heads[1], offset: 0 })
  })

  it('沒有標題就不黏', () => {
    expect(stickyHead([], 0)).toBeNull()
  })
})
