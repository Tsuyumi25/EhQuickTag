// 每個標籤一條紅綠條：帶這個標籤的畫廊裡，多少會顯示、多少被擋。
//
// 資料來自 combos fixture，離線計算。實際畫廊的抓取在 useEhSearchListing。

export interface ComboDataset {
  tags: string[]
  /** 每筆 `[畫廊數, 標籤索引...]` */
  combos: number[][]
}

/** 標籤權重；null 代表硬隱藏（短路整個加總），不在清單裡的回 0 */
export type WeightOf = (tag: string) => number | null

/** 一組標籤的去向。硬隱藏無條件被擋，不看分數 */
export function isBlocked(tags: string[], weightOf: WeightOf, threshold: number): boolean {
  let sum = 0
  for (const t of tags) {
    const w = weightOf(t)
    if (w === null) return true
    sum += w
  }
  return sum < threshold
}

interface Tally { total: number; shown: number; blocked: number }

export type BarState = 'allShown' | 'allBlocked' | 'mixed'

export interface TagBar {
  tag: string
  /** 帶這個標籤的畫廊總數 */
  total: number
  shown: number
  blocked: number
  state: BarState
}

/**
 * `tolerance` 是把「99.9% 被擋」也算成全紅的容忍度（0~1，比例）。設 0 就是嚴格。
 * 留這個參數是因為單獨幾本的雜訊會讓每一條都變成混色，那樣三態就失去意義了。
 */
export function tagBars(
  data: ComboDataset,
  tags: string[],
  weightOf: WeightOf,
  threshold: number,
  tolerance = 0,
): TagBar[] {
  const index = new Map(data.tags.map((t, i) => [t, i]))
  const acc = new Map<string, Tally>()
  // 權重和累加器都先照標籤索引攤平。這個迴圈在每次按鍵時跑十萬筆以上，字串查表和
  // 中間陣列的配置就是整個面板的延遲來源——攤平之後快四倍以上
  const weights = data.tags.map(weightOf)
  const slot: (Tally | undefined)[] = new Array(data.tags.length)

  for (const t of tags) {
    const i = index.get(t)
    if (i === undefined) continue
    const a = { total: 0, shown: 0, blocked: 0 }
    acc.set(t, a)
    slot[i] = a
  }
  if (acc.size === 0) return []

  for (const entry of data.combos) {
    let hit = false
    for (let k = 1; k < entry.length; k += 1) {
      if (slot[entry[k]]) { hit = true; break }
    }
    if (!hit) continue

    // 跟 isBlocked 同一條規則：硬隱藏短路整個加總，否則看總分有沒有跨過閾值
    let sum = 0
    let blocked = false
    for (let k = 1; k < entry.length; k += 1) {
      const w = weights[entry[k]]
      if (w === null) { blocked = true; break }
      sum += w
    }
    if (!blocked) blocked = sum < threshold

    const count = entry[0]
    for (let k = 1; k < entry.length; k += 1) {
      const a = slot[entry[k]]
      if (!a) continue
      a.total += count
      if (blocked) a.blocked += count
      else a.shown += count
    }
  }

  return tags
    .filter((t) => acc.has(t))
    .map((tag) => {
      const a = acc.get(tag)!
      const state: BarState =
        a.total === 0 ? 'allShown'
          : a.blocked <= a.total * tolerance ? 'allShown'
            : a.shown <= a.total * tolerance ? 'allBlocked'
              : 'mixed'
      return { tag, ...a, state }
    })
    // 混色的排前面：那是唯一需要判斷的一群
    .sort((a, b) => {
      const rank = (s: BarState): number => (s === 'mixed' ? 0 : 1)
      return rank(a.state) - rank(b.state) || b.total - a.total
    })
}
