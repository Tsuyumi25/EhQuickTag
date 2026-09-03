import { describe, it, expect } from 'vitest'
import {
  outcomeOf, compareItems, mismatchOf, snapshot, summarizeEffect,
  type FactsOf, type PreviewItem,
} from '@/services/mytagsScore'
import type { SampleGallery } from '@/services/mytagsSamples'

const FACTS: Record<string, { weight: number; hidden: boolean; watch: boolean }> = {
  'male:core': { weight: -20, hidden: false, watch: false },
  'male:mild': { weight: -2, hidden: false, watch: false },
  'male:save': { weight: 10, hidden: false, watch: false },
  'male:fav': { weight: 12, hidden: false, watch: true },
  'male:fav2': { weight: 6, hidden: false, watch: true },
  'male:zero': { weight: 0, hidden: false, watch: false },
  'male:hid': { weight: -40, hidden: true, watch: false },
}
const factsOf: FactsOf = (t) => FACTS[t] ?? null

function run(tags: string[], threshold = -2) {
  return outcomeOf(tags, factsOf, threshold)
}

describe('outcomeOf', () => {
  it('只列有貢獻的，權重 0 的只進 ignored——列出來會淹沒重點', () => {
    const o = run(['male:core', 'male:save', 'male:zero', 'z:noise'])
    expect(o.parts).toEqual([
      { tag: 'male:core', weight: -20 },
      { tag: 'male:save', weight: 10 },
    ])
    expect(o.ignored).toBe(1)          // z:noise 不在清單裡，連 known 都不是
  })

  it('剛好等於閾值算過線——EH 是「小於」才擋', () => {
    expect(run(['male:mild']).side).toBe('right')
    expect(run(['male:mild']).distance).toBe(0)
  })

  it('兩個增信疊起來會跨過去——這個系統說不出「單獨中性」', () => {
    const o = run(['male:mild', 'male:mild'])
    expect(o.score).toBe(-4)
    expect(o.side).toBe('left')
  })

  it('硬隱藏短路：加總是正的照樣被擋', () => {
    const o = run(['male:hid', 'male:save'])
    expect(o.hiddenBy).toEqual(['male:hid'])
    expect(o.score).toBe(10)
    expect(o.side).toBe('left')
  })

  // wiki：「the sum of all tag weights that appear in the gallery」
  it('⭐ watch 不參與計分，帶關注標籤的畫廊照它的權重算', () => {
    const o = run(['male:fav', 'male:save', 'male:core'])
    expect(o.parts.map((p) => p.tag)).toEqual(['male:core', 'male:save', 'male:fav'])
    expect(o.score).toBe(-20 + 10 + 12)
    expect(o.side).toBe('right')       // 2 >= -2，跟 watch 旗標無關
  })
})

function item(gid: number, tags: string[]): PreviewItem {
  const gallery: SampleGallery = { gid, token: 'x', title: 't', category: 'Manga', thumb: '', tags }
  return { gallery, outcome: outcomeOf(tags, factsOf, -2) }
}

describe('compareItems', () => {
  it('離門檻最近的排最前面——遠的怎麼調都不會越線', () => {
    const items = [
      item(1, ['male:core', 'male:core']),   // -40 → 距離 -38
      item(2, ['male:mild']),                //  -2 → 距離   0
      item(3, ['male:save']),                //  10 → 距離  12
    ].sort(compareItems)
    expect(items.map((i) => i.gallery.gid)).toEqual([2, 3, 1])
  })

  it('硬隱藏沉到底——調權重對它沒有意義', () => {
    const items = [item(1, ['male:hid']), item(2, ['male:core'])].sort(compareItems)
    expect(items.map((i) => i.gallery.gid)).toEqual([2, 1])
  })
})

describe('mismatchOf', () => {
  it('記號跟欄位不一致就是誤傷或漏網', () => {
    expect(mismatchOf('left', 'keep')).toBe('over')
    expect(mismatchOf('right', 'block')).toBe('leak')
    expect(mismatchOf('left', 'block')).toBe('correct')
    expect(mismatchOf('right', undefined)).toBeNull()
  })
})

describe('summarizeEffect', () => {
  const before = snapshot([item(1, ['male:core']), item(2, ['male:save'])], { 1: 'keep' })

  it('換邊的算進 moved', () => {
    const after = snapshot([item(1, ['male:save']), item(2, ['male:save'])], { 1: 'keep' })
    expect(summarizeEffect(before, after).moved).toEqual([1])
  })

  it('⭐ 修好和弄壞要分開數——混成一個數字就沒有用了', () => {
    // 1 本來被擋但判為該留（誤傷），改完之後放行 → 修好一本
    const after = snapshot([item(1, ['male:save']), item(2, ['male:save'])], { 1: 'keep' })
    const sum = summarizeEffect(before, after)
    expect(sum.fixed).toBe(1)
    expect(sum.introduced).toBe(0)
  })

  it('本來沒問題、現在對不上的算 introduced', () => {
    const start = snapshot([item(3, ['male:save'])], { 3: 'keep' })
    const end = snapshot([item(3, ['male:core'])], { 3: 'keep' })
    const sum = summarizeEffect(start, end)
    expect(sum.introduced).toBe(1)
    expect(sum.fixed).toBe(0)
  })

  it('新出現的畫廊不算換邊', () => {
    const after = snapshot([item(1, ['male:core']), item(9, ['male:core'])], {})
    expect(summarizeEffect(before, after).moved).toEqual([])
  })
})
