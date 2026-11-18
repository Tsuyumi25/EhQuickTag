import { describe, expect, it } from 'vitest'
import { mpvGalleryUrl, parseVoteContext } from './mpvGallery'

describe('mpvGalleryUrl', () => {
  it('MPV 網址換成同一本的 /g/ 網址，站台跟著目前這頁', () => {
    expect(mpvGalleryUrl(new URL('https://e-hentai.org/mpv/1000/0a0a0a0a0a/'))).toBe('https://e-hentai.org/g/1000/0a0a0a0a0a/')
    expect(mpvGalleryUrl(new URL('https://exhentai.org/mpv/1000/0a0a0a0a0a'))).toBe('https://exhentai.org/g/1000/0a0a0a0a0a/')
  })

  it('其他頁面與缺段的網址不認', () => {
    expect(mpvGalleryUrl(new URL('https://e-hentai.org/g/1000/0a0a0a0a0a/'))).toBeNull()
    expect(mpvGalleryUrl(new URL('https://e-hentai.org/s/0a0a0a0a0a/1000-12'))).toBeNull()
    expect(mpvGalleryUrl(new URL('https://e-hentai.org/mpv/1000/'))).toBeNull()
  })
})

describe('parseVoteContext', () => {
  // /g/ 頁 inline script 的寫法：各一行 var，apiuid 沒登入時是 -1
  const script = [
    'var gid = 1000;',
    'var token = "0a0a0a0a0a";',
    'var apiuid = -1;',
    'var apikey = "abcdef0123";',
  ].join('\n')

  it('讀出投票要的四個值', () => {
    expect(parseVoteContext(`<script>${script}</script>`)).toEqual({ gid: 1000, token: '0a0a0a0a0a', apiuid: -1, apikey: 'abcdef0123' })
  })

  it('少了任何一個就是 null', () => {
    expect(parseVoteContext(`<script>${script.replace(/var apikey.*/, '')}</script>`)).toBeNull()
  })
})
