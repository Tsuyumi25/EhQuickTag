import { describe, expect, it } from 'vitest'
import { evidenceOf, parseGalleryUrl, withImport } from '@/services/gallery/galleryImport'

describe('parseGalleryUrl', () => {
  it('兩個站的圖庫網址都認，後面帶頁碼或 query 也行', () => {
    expect(parseGalleryUrl('https://e-hentai.org/g/123/abcdef0123/')).toEqual({ gid: 123, token: 'abcdef0123' })
    expect(parseGalleryUrl('  https://exhentai.org/g/9/0123456789/?p=2 ')).toEqual({ gid: 9, token: '0123456789' })
    expect(parseGalleryUrl('https://e-hentai.org/g/123/abcdef0123')).toEqual({ gid: 123, token: 'abcdef0123' })
  })

  it('還沒打完的網址或不是圖庫的網址不算', () => {
    expect(parseGalleryUrl('https://e-hentai.org/g/123/abcdef')).toBeNull()
    expect(parseGalleryUrl('https://e-hentai.org/s/abcdef0123/123-1')).toBeNull()
    expect(parseGalleryUrl('female:some tag')).toBeNull()
  })
})

describe('withImport', () => {
  it('同一個標籤記下每一本的線型；同一本再導入會換掉自己先前的那份', () => {
    let imports = withImport(new Map(), { gid: 1, title: 'A', tags: [{ full: 'x:a', tier: 'gtl' }, { full: 'x:b', tier: 'gt' }] })
    imports = withImport(imports, { gid: 2, title: 'B', tags: [{ full: 'x:a', tier: 'gt' }] })
    imports = withImport(imports, { gid: 1, title: 'A', tags: [{ full: 'x:a', tier: 'gtw' }] })
    expect(Object.fromEntries(imports)).toEqual({
      'x:a': [{ gid: 2, title: 'B', tier: 'gt' }, { gid: 1, title: 'A', tier: 'gtw' }],
    })
  })

  it('語言標籤和自動加上的 parody:original 不導入，其他 parody 照收', () => {
    const imports = withImport(new Map(), {
      gid: 1,
      title: 'A',
      tags: [
        { full: 'language:translated', tier: 'gt' },
        { full: 'parody:original', tier: 'gt' },
        { full: 'parody:some parody', tier: 'gt' },
        { full: 'x:a', tier: 'gt' },
      ],
    })
    expect([...imports.keys()]).toEqual(['parody:some parody', 'x:a'])
  })
})

describe('evidenceOf', () => {
  it('以最穩的那本為準，點線也算一級；沒被導入就沒有佐證', () => {
    expect(evidenceOf([{ gid: 1, title: '', tier: 'gtw' }, { gid: 2, title: '', tier: 'gt' }])).toBe('solid')
    expect(evidenceOf([{ gid: 1, title: '', tier: 'gtl' }, { gid: 2, title: '', tier: 'gtw' }])).toBe('dashed')
    expect(evidenceOf([{ gid: 1, title: '', tier: 'gtw' }])).toBe('dotted')
    expect(evidenceOf([])).toBeNull()
  })
})
