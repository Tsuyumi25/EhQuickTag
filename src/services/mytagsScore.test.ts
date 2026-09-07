import { describe, it, expect } from 'vitest'
import {
  outcomeOf, compareItems, mismatchOf,
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

