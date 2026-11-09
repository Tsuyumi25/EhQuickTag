import { describe, it, expect } from 'vitest'
import type { Line } from '@/types'
import { litButtonPicks } from './searchPicks'

const lines: Line[] = [
  { kind: 'separator', label: 'x' },
  { kind: 'buttons', buttons: [
    { kind: 'tag', tags: ['f:"some tag$"'] },
    { kind: 'tag', tags: ['l:chinese$', 'l:english$'] },
    { kind: 'tag', tags: ['-o:"other tag$"'] },
    { kind: 'tag', tags: ['m:unlit$'] },
    { kind: 'tag', tags: ['title:word'] },
    { kind: 'url', url: 'https://e-hentai.org/' },
  ] },
]

describe('litButtonPicks', () => {
  it('只帶亮著的按鈕，狀態照搜尋框裡的前綴', () => {
    const picks = litButtonPicks(lines, '~female:"some tag$" l:chinese$ l:english$ -other:"other tag$" hand typed')
    expect(picks).toEqual([
      { key: 'female:some tag', selection: 'or' },
      { key: 'language:chinese', selection: 'positive' },
      { key: 'language:english', selection: 'positive' },
      { key: 'other:other tag', selection: 'negative' },
    ])
  })

  it('多 tag 按鈕只亮一半就不算亮，整顆都不帶', () => {
    expect(litButtonPicks(lines, 'l:chinese$')).toEqual([])
  })

  it('否定按鈕被按成 Exclude 時，雙重否定的正向 token 照實帶成 positive', () => {
    expect(litButtonPicks(lines, 'other:"other tag$"')).toEqual([{ key: 'other:other tag', selection: 'positive' }])
  })

  it('亮著但不是標籤的詞（title:）不帶', () => {
    expect(litButtonPicks(lines, 'title:word')).toEqual([])
  })
})
