// 一本畫廊落在哪一欄，以及為什麼。
//
//    左 被擋      右 會顯示      加總 vs Tag Filtering Threshold
//
// ⭐ 只有這一條軸。watch 仍然是標籤的屬性（要不要進 Watched 那個搜尋），但它不參與
// 計分，也就沒有自己的預覽可言；硬隱藏是同一條軸上的短路，不是另一個觀點。

import type { SampleGallery, Verdict } from '@/services/mytagsSamples'

export interface TagFacts {
  weight: number
  hidden: boolean
  watch: boolean
}

/** 回 null 代表這個標籤不在使用者的清單裡，對任何模式都沒有貢獻 */
export type FactsOf = (tag: string) => TagFacts | null

export interface Contribution {
  tag: string
  /** null 代表硬隱藏——它不是一個很大的負數，它根本不進加總 */
  weight: number | null
}

export interface Outcome {
  side: 'left' | 'right'
  score: number
  /** 負 = 還差多少才過門檻；正 = 還有多少餘裕 */
  distance: number
  hiddenBy: string[]
  parts: Contribution[]
  /** 在清單裡但沒有貢獻的標籤數（權重 0）。列出來只會淹沒重點，所以只給數量 */
  ignored: number
}

export function outcomeOf(
  tags: string[],
  factsOf: FactsOf,
  threshold: number,
): Outcome {
  const known = tags.map((tag) => ({ tag, facts: factsOf(tag) }))
    .filter((x): x is { tag: string; facts: TagFacts } => x.facts !== null)
  const hiddenBy = known.filter((x) => x.facts.hidden).map((x) => x.tag)

  // 加總的範圍是畫廊上所有非隱藏標籤的權重，wiki 的原文是
  // "the sum of all tag weights that appear in the gallery"
  const counted = known.filter((x) => !x.facts.hidden && x.facts.weight !== 0)
  const parts: Contribution[] = counted
    .map((x) => ({ tag: x.tag, weight: x.facts.weight }))
    .sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0))
  const score = counted.reduce((sum, x) => sum + x.facts.weight, 0)

  // EH 的規則是「小於門檻才擋」，所以等於門檻算過線
  const passes = hiddenBy.length === 0 && score >= threshold

  return {
    side: passes ? 'right' : 'left',
    score,
    distance: score - threshold,
    hiddenBy,
    parts,
    ignored: known.length - counted.length - hiddenBy.length,
  }
}

/** 一個標籤在一批樣本裡的去向分佈 */
export interface TagImpact {
  total: number
  left: number
  right: number
}

export interface PreviewItem {
  gallery: SampleGallery
  outcome: Outcome
}

/**
 * 兩欄的排序：離門檻最近的排最前面，硬隱藏的沉到底。
 *
 * 離門檻遠的怎麼調都不會越線；硬隱藏的根本不在這條軸上，調權重對它沒有意義。
 */
export function compareItems(a: PreviewItem, b: PreviewItem): number {
  const ah = a.outcome.hiddenBy.length
  const bh = b.outcome.hiddenBy.length
  if (ah !== bh) return ah - bh
  return Math.abs(a.outcome.distance) - Math.abs(b.outcome.distance)
    || a.gallery.gid - b.gallery.gid
}

export type Mismatch = 'correct' | 'over' | 'leak' | null

/** 記號跟欄位對不對得上 */
export function mismatchOf(side: 'left' | 'right', verdict: Verdict | undefined): Mismatch {
  if (!verdict) return null
  if (verdict === 'keep' && side === 'left') return 'over'
  if (verdict === 'block' && side === 'right') return 'leak'
  return 'correct'
}

export interface Snapshot {
  sides: Map<number, 'left' | 'right'>
  mismatches: Map<number, Mismatch>
}

export function snapshot(items: PreviewItem[], verdicts: Record<string, Verdict>): Snapshot {
  return {
    sides: new Map(items.map((i) => [i.gallery.gid, i.outcome.side])),
    mismatches: new Map(items.map((i) =>
      [i.gallery.gid, mismatchOf(i.outcome.side, verdicts[String(i.gallery.gid)])])),
  }
}

export interface EffectSummary {
  moved: number[]
  /** 本來對不上、現在對上了 */
  fixed: number
  /** 本來沒問題、現在對不上了 */
  introduced: number
}

/** 一次改動做了什麼 */
export function summarizeEffect(before: Snapshot, after: Snapshot): EffectSummary {
  const moved: number[] = []
  let fixed = 0
  let introduced = 0

  for (const [gid, side] of after.sides) {
    if (before.sides.has(gid) && before.sides.get(gid) !== side) moved.push(gid)
    const was = before.mismatches.get(gid)
    const now = after.mismatches.get(gid)
    if ((was === 'over' || was === 'leak') && now === 'correct') fixed += 1
    if ((was === 'correct' || !was) && (now === 'over' || now === 'leak')) introduced += 1
  }
  return { moved, fixed, introduced }
}
