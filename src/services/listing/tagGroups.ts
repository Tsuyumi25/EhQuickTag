// 素材清單照固定的 namespace 順序排。

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
