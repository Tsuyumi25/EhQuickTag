import { describe, it, expect } from 'vitest'
import { parseRefs, parseNextCursor } from '@/composables/useEhSearchListing'

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
    expect(parseRefs(html).filter((ref) => ref.gid === 1000001)).toHaveLength(1)
  })

  it('token 必須是 10 位十六進位，其他連結不會誤中', () => {
    expect(parseRefs('<a href="/g/12/xyz/">bad</a>')).toEqual([])
  })

  it('沒有結果就是空陣列', () => {
    expect(parseRefs('<p>No hits found</p>')).toEqual([])
  })
})

describe('parseNextCursor', () => {
  // 實際頁面的分隔符是 `&amp;`，識別碼本身是虛構的。
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
