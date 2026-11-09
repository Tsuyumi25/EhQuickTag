import { TagState, type Line } from '@/types'
import { buildIdentityIndex, getState, tokenIdentity, tokenize } from '@/services/search/tagState'
import { parseTerm } from '@/services/search/searchSyntax'
import type { Selection } from '@/services/tagPick'

export interface SearchPick {
  /** dock 的選取 key，跟列表上的 chip 一樣：namespace:標籤（小寫）或 uploader:名稱 */
  key: string
  /** 這個標籤在搜尋框裡的狀態 */
  selection: Selection
}

/**
 * tagbar 上亮著的按鈕在搜尋框裡留下的標籤。一顆按鈕可能有好幾個 tag，每個各算一筆；
 * 狀態照搜尋框裡實際的前綴走。不是標籤的詞（自由文字、title: 之類）在 dock 沒有位置，略過
 */
export function litButtonPicks(lines: readonly Line[], searchText: string): SearchPick[] {
  const index = buildIdentityIndex(tokenize(searchText))
  const picks = new Map<string, Selection>()
  for (const line of lines) {
    if (line.kind !== 'buttons') continue
    for (const button of line.buttons) {
      if (button.kind !== 'tag' || getState(button.tags, index) === TagState.Off) continue
      for (const tag of button.tags) {
        const id = tokenIdentity(tag)
        const token = id ? index.get(id) : null
        if (!token) continue
        const term = parseTerm(token)
        const key = term.qualifier === 'uploader'
          ? `uploader:${term.tag}`
          : term.namespace ? `${term.namespace}:${term.tag.toLowerCase()}` : null
        if (key) picks.set(key, term.prefix === '-' ? 'negative' : term.prefix === '~' ? 'or' : 'positive')
      }
    }
  }
  return [...picks].map(([key, selection]) => ({ key, selection }))
}
