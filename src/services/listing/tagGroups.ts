// 列表上的標籤照圖庫頁的寫法分列：每個 namespace 一列，列的先後跟同一列裡的標籤都照網站原本的順序。

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
