import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  EH_CATEGORIES,
  ALL_CATEGORIES,
  selectedFromFCats,
  fCatsFromSelected,
  buildSearchUrl,
  parseSearchUrl,
  emptyAdvancedOptions,
  type EhSearchParams,
} from './ehSearchParams'

const DOUJINSHI = 2
const MANGA = 4
const IMAGE_SET = 32

describe('分類與 f_cats 的轉換', () => {
  it('十個分類加起來是 1023', () => {
    expect(ALL_CATEGORIES).toBe(1023)
    expect(EH_CATEGORIES).toHaveLength(10)
  })

  it('host 頁面實測值：選同人志 + 漫畫時 f_cats 是 1017', () => {
    expect(fCatsFromSelected([DOUJINSHI, MANGA])).toBe(1017)
    expect(selectedFromFCats(1017)).toEqual(new Set([DOUJINSHI, MANGA]))
  })

  it('內建預設值反推得回單一分類', () => {
    expect(selectedFromFCats(991)).toEqual(new Set([IMAGE_SET]))
    expect(selectedFromFCats(1019)).toEqual(new Set([MANGA]))
  })

  it('f_cats=0 是全選', () => {
    expect(selectedFromFCats(0).size).toBe(10)
    expect(fCatsFromSelected(EH_CATEGORIES.map(c => c.bit))).toBe(0)
  })

  it('f_cats=1023 是一個都不選', () => {
    expect(selectedFromFCats(1023)).toEqual(new Set())
    expect(fCatsFromSelected([])).toBe(1023)
  })

  it('超出範圍的 bit 被忽略', () => {
    expect(selectedFromFCats(1023 + 2048)).toEqual(new Set())
    expect(fCatsFromSelected([DOUJINSHI, 2048])).toBe(1021)
  })
})

describe('分類轉換的性質', () => {
  test.prop([fc.integer({ min: 0, max: ALL_CATEGORIES })])(
    'f_cats → 選取集合 → f_cats 回到原值',
    (fCats) => {
      expect(fCatsFromSelected(selectedFromFCats(fCats))).toBe(fCats)
    },
  )

  test.prop([fc.uniqueArray(fc.constantFrom(...EH_CATEGORIES.map(c => c.bit)))])(
    '選取集合 → f_cats → 選取集合回到原值',
    (bits) => {
      expect(selectedFromFCats(fCatsFromSelected(bits))).toEqual(new Set(bits))
    },
  )

  test.prop([fc.integer({ min: 0, max: ALL_CATEGORIES })])(
    '選取的與排除的沒有交集，聯集是全部',
    (fCats) => {
      const selected = [...selectedFromFCats(fCats)].reduce((m, b) => m | b, 0)
      expect(selected & fCats).toBe(0)
      expect(selected | fCats).toBe(ALL_CATEGORIES)
    },
  )
})

const allCats = () => new Set(EH_CATEGORIES.map(c => c.bit))

describe('組裝搜尋網址', () => {
  it('全選分類時不帶 f_cats', () => {
    const url = buildSearchUrl({ keywords: 'foo', categories: allCats(), advanced: null })
    expect(url).toBe('https://e-hentai.org/?f_search=foo')
  })

  it('沒開進階選項時不帶 advsearch', () => {
    const url = buildSearchUrl({ keywords: '', categories: new Set([MANGA]), advanced: null })
    expect(url).toBe('https://e-hentai.org/?f_cats=1019')
  })

  it('開了進階選項一定帶 advsearch=1，未使用的欄位不出現', () => {
    const advanced = emptyAdvancedOptions()
    const url = new URL(buildSearchUrl({ keywords: '', categories: allCats(), advanced }))
    expect(url.searchParams.get('advsearch')).toBe('1')
    expect(url.searchParams.has('f_sh')).toBe(false)
    expect(url.searchParams.has('f_srdd')).toBe(false)
  })

  it('進階欄位有值才寫進網址', () => {
    const advanced = { ...emptyAdvancedOptions(), browseExpunged: true, minRating: '4' as const, pagesFrom: '10' }
    const url = new URL(buildSearchUrl({ keywords: '', categories: allCats(), advanced }))
    expect(url.searchParams.get('f_sh')).toBe('on')
    expect(url.searchParams.get('f_srdd')).toBe('4')
    expect(url.searchParams.get('f_spf')).toBe('10')
    expect(url.searchParams.has('f_spt')).toBe(false)
  })

  it('關鍵字前後空白被去掉', () => {
    const url = buildSearchUrl({ keywords: '  foo  ', categories: allCats(), advanced: null })
    expect(url).toBe('https://e-hentai.org/?f_search=foo')
  })

  it('跟著當前站走的 origin 會被採用', () => {
    const url = buildSearchUrl({ keywords: 'foo', categories: allCats(), advanced: null }, 'https://exhentai.org')
    expect(url).toBe('https://exhentai.org/?f_search=foo')
  })
})

describe('解析搜尋網址', () => {
  it('非 EH 網域回 null', () => {
    expect(parseSearchUrl('https://example.com/?f_search=foo')).toBeNull()
  })

  it('EH 但不是根路徑回 null', () => {
    expect(parseSearchUrl('https://e-hentai.org/g/12/ab/')).toBeNull()
  })

  it('沒有 f_cats 時視為全選', () => {
    expect(parseSearchUrl('https://e-hentai.org/?f_search=foo')?.categories.size).toBe(10)
  })

  it('沒有 advsearch 時進階選項是 null', () => {
    expect(parseSearchUrl('https://e-hentai.org/?f_sh=on')?.advanced).toBeNull()
  })

  it('不認得的星等退回不限', () => {
    const p = parseSearchUrl('https://e-hentai.org/?advsearch=1&f_srdd=9')
    expect(p?.advanced?.minRating).toBe('0')
  })
})

describe('組裝與解析的往返', () => {
  const cases: EhSearchParams[] = [
    { keywords: 'foo bar', categories: allCats(), advanced: null },
    { keywords: '', categories: new Set([DOUJINSHI, MANGA]), advanced: null },
    {
      keywords: 'x',
      categories: new Set([IMAGE_SET]),
      advanced: {
        ...emptyAdvancedOptions(),
        browseExpunged: true,
        requireTorrent: true,
        pagesFrom: '5',
        pagesTo: '50',
        minRating: '3',
        disableFilterTags: true,
      },
    },
  ]

  it.each(cases.map((c, i) => [i, c] as const))('第 %i 組參數往返後不變', (_i, params) => {
    const parsed = parseSearchUrl(buildSearchUrl(params))
    expect(parsed).toEqual(params)
  })
})
