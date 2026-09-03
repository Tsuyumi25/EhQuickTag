import { describe, it, expect } from 'vitest'
import { tagBars, isBlocked, type ComboDataset } from '@/services/mytagsBars'
import {
  accuracy, listingUrl, emptyStore, type SampleStore,
} from '@/services/mytagsSamples'
import { parseRefs, parseNextCursor } from '@/composables/useEhSearchListing'

const W: Record<string, number | null> = {
  'male:core': -20, 'male:save': 99, 'male:hid': null, 'male:mild': -1,
}
const weightOf = (t: string): number | null => (t in W ? W[t] : 0)

describe('isBlocked', () => {
  it('加總低於閾值就擋', () => {
    expect(isBlocked(['male:core'], weightOf, -2)).toBe(true)
    expect(isBlocked(['male:mild'], weightOf, -2)).toBe(false)
  })

  it('豁免拉回來', () => {
    expect(isBlocked(['male:core', 'male:save'], weightOf, -2)).toBe(false)
  })

  it('硬隱藏短路，再多正權重都沒用', () => {
    expect(isBlocked(['male:hid', 'male:save'], weightOf, -2)).toBe(true)
  })

  it('不在清單裡的標籤當 0 分，不影響結果', () => {
    expect(isBlocked(['male:core', 'other:unknown'], weightOf, -2)).toBe(true)
  })
})

// core / save / other，三本畫廊
const DATA: ComboDataset = {
  tags: ['male:core', 'male:save', 'male:other'],
  combos: [
    [100, 0],          // core          → 擋
    [ 40, 0, 1],       // core + save   → 顯示
    [ 25, 2],          // other         → 顯示
  ],
}

describe('tagBars', () => {
  it('一個標籤的總數是所有含它的組合加總', () => {
    const bars = tagBars(DATA, ['male:core'], weightOf, -2)
    expect(bars[0]).toMatchObject({ total: 140, blocked: 100, shown: 40, state: 'mixed' })
  })

  it('全擋和全顯示各自收斂成單一狀態', () => {
    const bars = tagBars(DATA, ['male:save', 'male:other'], weightOf, -2)
    expect(bars.find((b) => b.tag === 'male:save')?.state).toBe('allShown')
    expect(bars.find((b) => b.tag === 'male:other')?.state).toBe('allShown')
  })

  it('混色的排在前面——那是唯一要動腦的一群', () => {
    const bars = tagBars(DATA, ['male:save', 'male:core'], weightOf, -2)
    expect(bars.map((b) => b.tag)).toEqual(['male:core', 'male:save'])
  })

  it('容忍度把零星雜訊算成單一狀態', () => {
    const noisy: ComboDataset = {
      tags: ['male:core', 'male:save'],
      combos: [[1000, 0], [1, 0, 1]],
    }
    expect(tagBars(noisy, ['male:core'], weightOf, -2)[0].state).toBe('mixed')
    expect(tagBars(noisy, ['male:core'], weightOf, -2, 0.01)[0].state).toBe('allBlocked')
  })

  it('詞彙表裡沒有的標籤直接不出現，不是回一條空的', () => {
    expect(tagBars(DATA, ['male:absent'], weightOf, -2)).toEqual([])
  })

  it('一本畫廊同時算進它身上每一個被宣告的標籤', () => {
    const bars = tagBars(DATA, ['male:core', 'male:save'], weightOf, -2)
    expect(bars.find((b) => b.tag === 'male:save')?.total).toBe(40)
  })

  // tagBars 為了速度把去向判斷攤平成索引運算，沒有呼叫 isBlocked。兩份規則走鐘的話
  // 條子和右邊的封面會各說各話，而且畫面上看不出來——所以在這裡釘死
  it('去向判斷跟 isBlocked 完全一致', () => {
    const declared = ['male:core', 'male:save', 'male:other']
    for (const threshold of [-2, 0, -100, 99]) {
      const bars = tagBars(DATA, declared, weightOf, threshold)
      const want = new Map(declared.map((t) => [t, { blocked: 0, shown: 0 }]))
      for (const [count, ...idxs] of DATA.combos) {
        const tags = idxs.map((i) => DATA.tags[i])
        const blocked = isBlocked(tags, weightOf, threshold)
        for (const t of tags) {
          const a = want.get(t)
          if (a) a[blocked ? 'blocked' : 'shown'] += count
        }
      }
      for (const b of bars) expect({ tag: b.tag, threshold, blocked: b.blocked, shown: b.shown })
        .toEqual({ tag: b.tag, threshold, ...want.get(b.tag) })
    }
  })
})

function store(): SampleStore {
  const s = emptyStore()
  s.galleries = {
    '1': { gid: 1, token: 'a', title: 'A', category: 'Doujinshi', thumb: '', tags: ['male:core'] },
    '2': { gid: 2, token: 'b', title: 'B', category: 'Manga', thumb: '', tags: ['male:core', 'male:save'] },
    '3': { gid: 3, token: 'c', title: 'C', category: 'Misc', thumb: '', tags: ['male:other'] },
  }
  return s
}

describe('accuracy', () => {
  it('沒判過的不進分母——那些沒有正確答案可比', () => {
    expect(accuracy(store(), weightOf, -2)).toMatchObject({ judged: 0, correct: 0 })
  })

  it('判斷跟設定一致就算對', () => {
    const s = store()
    s.verdicts = { '1': 'block', '2': 'keep' }
    expect(accuracy(s, weightOf, -2)).toMatchObject({ judged: 2, correct: 2 })
  })

  it('誤傷和漏網分開記', () => {
    const s = store()
    s.verdicts = { '1': 'keep', '2': 'block' }   // 兩本都跟設定相反
    expect(accuracy(s, weightOf, -2)).toMatchObject({
      judged: 2, correct: 0, overBlocked: 1, leaked: 1,
    })
  })

  it('判斷指向已經不在快取裡的畫廊時跳過', () => {
    const s = store()
    s.verdicts = { '999': 'block' }
    expect(accuracy(s, weightOf, -2).judged).toBe(0)
  })
})

describe('listingUrl', () => {
  it('三個過濾器全部停用——不停用的話硬隱藏的標籤會是零筆', () => {
    const u = new URL(listingUrl('male:"example$"', 'https://e-hentai.org'))
    expect(u.searchParams.get('f_sft')).toBe('on')
    expect(u.searchParams.get('f_sfu')).toBe('on')
    expect(u.searchParams.get('f_sfl')).toBe('on')
    expect(u.searchParams.get('f_search')).toBe('male:"example$"')
    expect(u.searchParams.has('next')).toBe(false)
  })

  it('不指定顯示模式——標籤走 API，不從 HTML 讀', () => {
    expect(new URL(listingUrl('x', 'https://e-hentai.org')).searchParams.has('inline_set'))
      .toBe(false)
  })

  it('翻頁走游標，不是 page——EH 會忽略 page，每一頁都回第一頁', () => {
    const u = new URL(listingUrl('x', 'https://e-hentai.org', '1000000'))
    expect(u.searchParams.get('next')).toBe('1000000')
    expect(u.searchParams.has('page')).toBe(false)
  })

  it('游標是 null 就是第一頁', () => {
    expect(new URL(listingUrl('x', 'https://e-hentai.org', null)).searchParams.has('next'))
      .toBe(false)
  })
})

describe('parseRefs', () => {
  const html = `
    <td class="gl1e"><a href="https://e-hentai.org/g/1000001/aaaaaaaaaa/"><img></a></td>
    <td class="gl3c"><a href="https://e-hentai.org/g/1000001/aaaaaaaaaa/">dup</a></td>
    <td><a href="/g/1000002/bbbbbbbbbb/">relative</a></td>
    <a href="https://e-hentai.org/gallerytorrents.php?gid=99&t=abc">not a gallery</a>`

  it('抓得到 gid 和 token，相對路徑也算', () => {
    expect(parseRefs(html)).toEqual([
      { gid: 1000001, token: 'aaaaaaaaaa' },
      { gid: 1000002, token: 'bbbbbbbbbb' },
    ])
  })

  it('同一本只出現一次——每筆在頁面上有封面和標題兩個連結', () => {
    expect(parseRefs(html).filter((r) => r.gid === 1000001)).toHaveLength(1)
  })

  it('token 必須是 10 位十六進位，其他連結不會誤中', () => {
    expect(parseRefs('<a href="/g/12/xyz/">bad</a>')).toEqual([])
  })

  it('沒有結果就是空陣列', () => {
    expect(parseRefs('<p>No hits found</p>')).toEqual([])
  })
})

describe('parseNextCursor', () => {
  // ⚠️ 實際頁面的分隔符是 `&amp;` 而不是 `&`，識別碼本身是虛構的
  const nav = '<a id="unext" href="https://e-hentai.org/?f_search=x%24'
    + '&amp;f_sft=on&amp;f_sfu=on&amp;f_sfl=on&amp;next=1000000"><img></a>'

  it('抓得到游標，HTML 實體分隔符不會擋住', () => {
    expect(parseNextCursor(nav)).toBe('1000000')
  })

  it('沒有 #unext 就是到底了——最後一頁照樣是滿的，只有這個 anchor 說得準', () => {
    const last = '<a id="ufirst" href="/?f_search=x"></a>'
      + '<a id="uprev" href="/?f_search=x&amp;prev=999999"></a>'
    expect(parseNextCursor(last)).toBeNull()
  })

  it('prev 不會被誤認成 next', () => {
    expect(parseNextCursor('<a id="uprev" href="/?prev=999999"></a>')).toBeNull()
  })

  it('零結果的頁面沒有任何翻頁按鈕', () => {
    expect(parseNextCursor('<p>No hits found</p>')).toBeNull()
  })
})
