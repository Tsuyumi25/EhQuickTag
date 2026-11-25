export interface GroupHead {
  kind: 'head'
  group: string
  /** 這一組在清單裡的筆數 */
  count: number
  top: number
  height: number
}

export interface LaidRow<T> {
  kind: 'row'
  row: T
  top: number
  height: number
}

export type LayoutItem<T> = GroupHead | LaidRow<T>

export interface ListLayout<T> {
  items: LayoutItem<T>[]
  heads: GroupHead[]
  total: number
}

/** `groupOf` 給了就在每一組前面插一個標題；同一組的列必須已經排在一起 */
export function layoutList<T>(
  rows: readonly T[],
  sizes: { row: number; head: number },
  groupOf?: (row: T) => string,
): ListLayout<T> {
  const counts = new Map<string, number>()
  if (groupOf) for (const row of rows) counts.set(groupOf(row), (counts.get(groupOf(row)) ?? 0) + 1)
  const items: LayoutItem<T>[] = []
  const heads: GroupHead[] = []
  let top = 0
  let current: string | null = null
  for (const row of rows) {
    const group = groupOf?.(row)
    if (group !== undefined && group !== current) {
      current = group
      const head: GroupHead = { kind: 'head', group, count: counts.get(group) ?? 0, top, height: sizes.head }
      items.push(head)
      heads.push(head)
      top += sizes.head
    }
    items.push({ kind: 'row', row, top, height: sizes.row })
    top += sizes.row
  }
  return { items, heads, total: top }
}

/** 跟 [from, to) 有交集的那幾項 */
export function itemsWithin<T>(items: readonly LayoutItem<T>[], from: number, to: number): LayoutItem<T>[] {
  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (items[mid].top + items[mid].height <= from) lo = mid + 1
    else hi = mid
  }
  const out: LayoutItem<T>[] = []
  for (let i = lo; i < items.length && items[i].top < to; i++) out.push(items[i])
  return out
}

/**
 * 黏在頂端的是捲軸位置所在的那一組。下一組的標題頂上來時把它往上推（offset 為負），
 * 兩個標題才不會疊在一起
 */
export function stickyHead(heads: readonly GroupHead[], scrollTop: number): { head: GroupHead; offset: number } | null {
  let at = -1
  for (let i = 0; i < heads.length && heads[i].top <= scrollTop; i++) at = i
  if (at < 0) return null
  const head = heads[at]
  const next = heads[at + 1]
  return { head, offset: next ? Math.min(0, next.top - scrollTop - head.height) : 0 }
}
