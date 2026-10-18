// 標籤照 namespace 整理：列表上照圖庫頁的寫法分列，素材清單照固定的 namespace 順序排。

export function namespaceOf(tag: string): string {
  const colon = tag.indexOf(':')
  return colon < 0 ? '' : tag.slice(0, colon).trim().toLowerCase()
}

export interface NamespaceGroup<T> {
  namespace: string
  items: T[]
}

/** 列的順序是每個 namespace 第一次出現的位置 */
export function groupByNamespace<T>(items: readonly T[], namespace: (item: T) => string): NamespaceGroup<T>[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = namespace(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }
  return [...groups].map(([key, list]) => ({ namespace: key, items: list }))
}

/** 照 order 排，order 裡沒有的 namespace 放最後；同一個 namespace 裡維持原本的先後 */
export function sortByNamespace<T>(items: readonly T[], namespace: (item: T) => string, order: readonly string[]): T[] {
  const rank = (item: T) => {
    const at = order.indexOf(namespace(item))
    return at < 0 ? order.length : at
  }
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item)
}
