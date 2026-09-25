import { describe, it, expect } from 'vitest'
import {
  accuracy, listingUrl, emptyStore, type SampleStore,
} from '@/services/mytagsSamples'
import type { TagFacts } from '@/services/mytagsScore'

const FACTS: Record<string, TagFacts> = {
  'male:core': { weight: -20, hidden: false, watch: false },
  'male:save': { weight: 99, hidden: false, watch: false },
}
const factsOf = (tag: string): TagFacts | null => FACTS[tag] ?? null

function store(): SampleStore {
  const sample = emptyStore()
  sample.galleries = {
    '1': { gid: 1, token: 'a', title: 'A', category: 'Doujinshi', thumb: '', tags: ['male:core'] },
    '2': {
      gid: 2,
      token: 'b',
      title: 'B',
      category: 'Manga',
      thumb: '',
      tags: ['male:core', 'male:save'],
    },
    '3': { gid: 3, token: 'c', title: 'C', category: 'Misc', thumb: '', tags: ['male:other'] },
  }
  return sample
}

describe('accuracy', () => {
  it('沒判過的不進分母——那些沒有正確答案可比', () => {
    expect(accuracy(store(), factsOf, -2)).toMatchObject({ judged: 0, correct: 0 })
  })

  it('判斷跟設定一致就算對', () => {
    const sample = store()
    sample.verdicts = { '1': 'block', '2': 'keep' }
    expect(accuracy(sample, factsOf, -2)).toMatchObject({ judged: 2, correct: 2 })
  })

  it('誤傷和漏網分開記', () => {
    const sample = store()
    sample.verdicts = { '1': 'keep', '2': 'block' }
    expect(accuracy(sample, factsOf, -2)).toMatchObject({
      judged: 2, correct: 0, overBlocked: 1, leaked: 1,
    })
  })

  it('判斷指向已經不在快取裡的畫廊時跳過', () => {
    const sample = store()
    sample.verdicts = { '999': 'block' }
    expect(accuracy(sample, factsOf, -2).judged).toBe(0)
  })
})

describe('listingUrl', () => {
  it('使用者設定的過濾器全部停用——不停用的話被排除的分類和硬隱藏的標籤會缺席', () => {
    const url = new URL(listingUrl('male:"example$"', 'https://e-hentai.org'))
    expect(url.searchParams.get('f_cats')).toBe('0')
    expect(url.searchParams.get('f_sft')).toBe('on')
    expect(url.searchParams.get('f_sfu')).toBe('on')
    expect(url.searchParams.get('f_sfl')).toBe('on')
    expect(url.searchParams.get('f_search')).toBe('male:"example$"')
    expect(url.searchParams.has('next')).toBe(false)
  })

  it('不指定顯示模式——標籤走 API，不從 HTML 讀', () => {
    expect(new URL(listingUrl('x', 'https://e-hentai.org')).searchParams.has('inline_set'))
      .toBe(false)
  })

  it('翻頁走游標，不是 page——EH 會忽略 page，每一頁都回第一頁', () => {
    const url = new URL(listingUrl('x', 'https://e-hentai.org', '1000000'))
    expect(url.searchParams.get('next')).toBe('1000000')
    expect(url.searchParams.has('page')).toBe(false)
  })

  it('游標是 null 就是第一頁', () => {
    expect(new URL(listingUrl('x', 'https://e-hentai.org', null)).searchParams.has('next'))
      .toBe(false)
  })
})
