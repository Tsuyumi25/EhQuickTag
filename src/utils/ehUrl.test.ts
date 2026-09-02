import { describe, it, expect } from 'vitest'
import { resolveButtonUrl, toAbsoluteUrl, isEhUrl } from './ehUrl'

const FRONT = 'https://e-hentai.org'
const BACK = 'https://exhentai.org'

describe('toAbsoluteUrl', () => {
  it('補完相對路徑', () => {
    expect(toAbsoluteUrl('?f_cats=991')?.href).toBe('https://e-hentai.org/?f_cats=991')
    expect(toAbsoluteUrl('/watched')?.href).toBe('https://e-hentai.org/watched')
  })

  it('完整網址原樣解析', () => {
    expect(toAbsoluteUrl('https://example.com/foo')?.href).toBe('https://example.com/foo')
  })

  it('解析不了回 null', () => {
    expect(toAbsoluteUrl('http://')).toBeNull()
  })
})

describe('isEhUrl', () => {
  it('兩個站都算', () => {
    expect(isEhUrl(new URL(FRONT))).toBe(true)
    expect(isEhUrl(new URL(BACK))).toBe(true)
    expect(isEhUrl(new URL('https://example.com'))).toBe(false)
  })
})

describe('resolveButtonUrl', () => {
  it('跟隨開啟時換成當前站', () => {
    expect(resolveButtonUrl(`${FRONT}/?f_cats=991`, true, BACK))
      .toBe('https://exhentai.org/?f_cats=991')
    expect(resolveButtonUrl(`${BACK}/?f_cats=991`, true, FRONT))
      .toBe('https://e-hentai.org/?f_cats=991')
  })

  it('跟隨關閉時保留存下來的站', () => {
    expect(resolveButtonUrl(`${FRONT}/?f_cats=991`, false, BACK))
      .toBe('https://e-hentai.org/?f_cats=991')
  })

  it('外部網址不受跟隨影響', () => {
    expect(resolveButtonUrl('https://example.com/foo', true, BACK))
      .toBe('https://example.com/foo')
  })

  it('相對路徑一律補成絕對，跟隨開啟時再換站', () => {
    expect(resolveButtonUrl('?f_cats=991', false, BACK))
      .toBe('https://e-hentai.org/?f_cats=991')
    expect(resolveButtonUrl('?f_cats=991', true, BACK))
      .toBe('https://exhentai.org/?f_cats=991')
  })

  it('相對路徑不再跟著當前頁面的路徑跑', () => {
    expect(resolveButtonUrl('?f_cats=991', true, `${BACK}/tag/some-tag`))
      .toBe('https://exhentai.org/?f_cats=991')
  })

  it('當前頁面不是那兩個站時不換', () => {
    expect(resolveButtonUrl(`${FRONT}/?f_cats=991`, true, 'http://localhost:5173'))
      .toBe('https://e-hentai.org/?f_cats=991')
  })

  it('解析不了的字串原樣回傳', () => {
    expect(resolveButtonUrl('http://', true, BACK)).toBe('http://')
  })
})
