import { describe, it, expect } from 'vitest'
import { unexpectedChanges } from '@/services/ehConfig'

describe('unexpectedChanges', () => {
  it('只有打算改的那格變了 → 沒有意外', () => {
    expect(unexpectedChanges({ ft: ['-2'], dm: ['2'] }, { ft: ['-5'], dm: ['2'] }, ['ft']))
      .toEqual([])
  })

  it('別的格子跟著變 → 報出來', () => {
    expect(unexpectedChanges({ ft: ['-2'], ts: ['1'] }, { ft: ['-5'], ts: ['0'] }, ['ft']))
      .toEqual(['ts'])
  })

  // 沒勾的 checkbox 根本不會出現在送出的欄位裡，所以「被清掉」的表現是整個 key 消失
  it('⭐ 欄位整個消失也算——只比對共同的 key 會看不到 checkbox 被清掉', () => {
    expect(unexpectedChanges({ ft: ['-2'], pf: ['on'] }, { ft: ['-2'] }, ['ft'])).toEqual(['pf'])
  })

  it('冒出本來沒有的欄位一樣算', () => {
    expect(unexpectedChanges({ ft: ['-2'] }, { ft: ['-2'], xx: ['on'] }, ['ft'])).toEqual(['xx'])
  })

  // 同名多控制項（checkbox group / select multiple）少掉一個值，是最容易靜默漏掉的
  // 那種——欄位還在、第一個值也還在，只有數量少了
  it('⭐ 同名欄位少了一個值也算', () => {
    expect(unexpectedChanges({ xl: ['a', 'b', 'c'] }, { xl: ['a', 'b'] }, [])).toEqual(['xl'])
  })

  it('同名欄位順序不同也算——那代表送回去的東西跟原本不一樣', () => {
    expect(unexpectedChanges({ xl: ['a', 'b'] }, { xl: ['b', 'a'] }, [])).toEqual(['xl'])
  })

  it('同名欄位完全一致就不報', () => {
    expect(unexpectedChanges({ xl: ['a', 'b'] }, { xl: ['a', 'b'] }, [])).toEqual([])
  })

  it('多個意外照名字排序，報告才穩定', () => {
    expect(unexpectedChanges({ a: ['1'], b: ['1'], c: ['1'] }, { a: ['2'], b: ['2'], c: ['2'] }, []))
      .toEqual(['a', 'b', 'c'])
  })
})
