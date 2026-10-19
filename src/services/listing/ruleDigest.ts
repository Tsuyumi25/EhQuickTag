// 摘要不照抄規則的樹：先把它化成「一定要／至少一個／只要有就不算」的標準形，
// 攤平巢狀群組、合併數值區間，逐層看時看不到的衝突與多餘條件才算得出來。

import {
  averageOfStars, conditionRange, normalizeTag, normalizeUploader, RANGE_FIELDS,
  type RuleConditionItem, type GalleryRule, type RangeField, type ValueRange,
} from '@/services/listing/galleryRules'
import type { GalleryCategory } from '@/services/listing/galleryCategory'

export type DigestTerm =
  | { kind: 'tag'; tag: string; exclude: boolean }
  | { kind: 'category'; category: GalleryCategory; exclude: boolean }
  | { kind: 'uploader'; uploader: string; exclude: boolean }
  | { kind: 'range'; field: RangeField; range: ValueRange; exclude: boolean }
  | { kind: 'all'; terms: DigestTerm[] }
  | { kind: 'any'; terms: DigestTerm[] }

export type DigestNote =
  | { kind: 'conflict'; tags: string[] }
  /** 一個圖庫只屬於一種分類：一定要的分類不只一種，或一定要的分類又被排除 */
  | { kind: 'categoryConflict'; categories: GalleryCategory[] }
  /** 一個圖庫只有一個上傳者：一定要的上傳者不只一個，或一定要的上傳者又被排除 */
  | { kind: 'uploaderConflict'; uploaders: string[] }
  | { kind: 'rangeEmpty'; field: RangeField }
  | { kind: 'rangeExcluded'; field: RangeField }
  | { kind: 'groupImpossible'; terms: DigestTerm[] }
  | { kind: 'groupRedundant'; terms: DigestTerm[] }
  | { kind: 'rangeMerged'; field: RangeField; range: ValueRange }
  | { kind: 'incomplete' }

export type DigestRanges = Partial<Record<RangeField, ValueRange>>

export interface RuleDigest {
  /** 一定要含有 */
  tags: string[]
  /** 一定要是這個分類；超過一個就永遠不會命中 */
  categories: GalleryCategory[]
  /** 一定要是這個上傳者；超過一個就永遠不會命中 */
  uploaders: string[]
  /** 每個欄位一定要落在的範圍；沒有的欄位不限 */
  ranges: DigestRanges
  /** 每一組至少要成立一項 */
  groups: DigestTerm[][]
  /** 任一項成立就不算 */
  unless: DigestTerm[]
  notes: DigestNote[]
  /** 不論哪個圖庫都不會命中 */
  never: boolean
}

const RANGE_FIELD_ORDER = Object.keys(RANGE_FIELDS) as RangeField[]
/** 出現這幾種提示，代表任何圖庫都不會命中 */
export const NEVER_NOTES: Partial<Record<DigestNote['kind'], true>> = {
  conflict: true, categoryConflict: true, uploaderConflict: true, rangeEmpty: true, rangeExcluded: true, groupImpossible: true,
}

// 否定只掛在葉子上（NNF）：整理成三段時只要看葉子的正負號
type Expr =
  | { k: 'tag'; tag: string; neg: boolean }
  | { k: 'category'; category: GalleryCategory; neg: boolean }
  | { k: 'uploader'; uploader: string; neg: boolean }
  | { k: 'range'; field: RangeField; range: ValueRange; neg: boolean }
  | { k: 'and' | 'or'; xs: Expr[] }

function intersect(a: ValueRange, b: ValueRange): ValueRange {
  return { min: Math.max(a.min, b.min), max: Math.min(a.max, b.max) }
}

function isEmpty(range: ValueRange): boolean {
  return range.min > range.max
}

function covers(outer: ValueRange, inner: ValueRange): boolean {
  return outer.min <= inner.min && inner.max <= outer.max
}

function junction(k: 'and' | 'or', items: readonly (Expr | null)[]): Expr | null {
  const xs: Expr[] = []
  for (const item of items) {
    if (!item) continue
    if (item.k === k) xs.push(...item.xs)
    else xs.push(item)
  }
  if (!xs.length) return null
  return xs.length === 1 ? xs[0] : { k, xs }
}

interface Context { incomplete: boolean }

function itemExpr(item: RuleConditionItem, neg: boolean, ctx: Context): Expr | null {
  if (item.kind === 'tag') {
    const tag = normalizeTag(item.tag)
    if (!tag) {
      ctx.incomplete = true
      return null
    }
    return { k: 'tag', tag, neg: neg !== item.exclude }
  }
  if (item.kind === 'category') return { k: 'category', category: item.category, neg: neg !== item.exclude }
  if (item.kind === 'uploader') {
    const uploader = item.uploader.trim()
    if (!uploader) {
      ctx.incomplete = true
      return null
    }
    return { k: 'uploader', uploader, neg: neg !== item.exclude }
  }
  if (item.kind !== 'group') return { k: 'range', field: item.kind, range: conditionRange(item), neg }
  if (!item.conditions.length) {
    ctx.incomplete = true
    return null
  }
  // NOT 往下推到每一項：取反後 and / or 互換；外層傳下來的取反與群組自己的 NOT 會互相抵銷
  const flip = item.negate !== neg
  const k = (item.mode === 'all') !== flip ? 'and' : 'or'
  return junction(k, item.conditions.map(child => itemExpr(child, flip, ctx)))
}

type Leaf = Exclude<Expr, { k: 'and' | 'or' }>

function isLeaf(expr: Expr): expr is Leaf {
  return expr.k !== 'and' && expr.k !== 'or'
}

function negate(expr: Expr): Expr {
  if (isLeaf(expr)) return { ...expr, neg: !expr.neg }
  return { k: expr.k === 'and' ? 'or' : 'and', xs: expr.xs.map(negate) }
}

function allNegative(expr: Expr): boolean {
  if (isLeaf(expr)) return expr.neg
  return expr.xs.every(allNegative)
}

function toTerm(expr: Expr): DigestTerm {
  if (expr.k === 'tag') return { kind: 'tag', tag: expr.tag, exclude: expr.neg }
  if (expr.k === 'category') return { kind: 'category', category: expr.category, exclude: expr.neg }
  if (expr.k === 'uploader') return { kind: 'uploader', uploader: expr.uploader, exclude: expr.neg }
  if (expr.k === 'range') return { kind: 'range', field: expr.field, range: expr.range, exclude: expr.neg }
  return { kind: expr.k === 'and' ? 'all' : 'any', terms: expr.xs.map(toTerm) }
}

// 排除清單去重：同一個標籤或分類只列一次；數值條件與組合各自不同，照收
function sameLeaf(a: DigestTerm, b: DigestTerm): boolean {
  if (a.kind === 'tag' && b.kind === 'tag') return a.tag === b.tag && a.exclude === b.exclude
  if (a.kind === 'category' && b.kind === 'category') return a.category === b.category && a.exclude === b.exclude
  if (a.kind === 'uploader' && b.kind === 'uploader') return normalizeUploader(a.uploader) === normalizeUploader(b.uploader) && a.exclude === b.exclude
  return false
}

function unlessTags(unless: readonly DigestTerm[]): Set<string> {
  const tags = new Set<string>()
  for (const term of unless) if (term.kind === 'tag' && !term.exclude) tags.add(term.tag)
  return tags
}

function unlessCategories(unless: readonly DigestTerm[]): Set<GalleryCategory> {
  const categories = new Set<GalleryCategory>()
  for (const term of unless) if (term.kind === 'category' && !term.exclude) categories.add(term.category)
  return categories
}

function unlessUploaders(unless: readonly DigestTerm[]): Set<string> {
  const uploaders = new Set<string>()
  for (const term of unless) if (term.kind === 'uploader' && !term.exclude) uploaders.add(normalizeUploader(term.uploader))
  return uploaders
}

function excludedRange(field: RangeField, range: ValueRange, unless: readonly DigestTerm[]): boolean {
  return unless.some(term => term.kind === 'range' && term.field === field && !term.exclude && covers(term.range, range))
}

/** 一定要成立的數值條件，照欄位順序排成 term */
export function rangeTerms(ranges: DigestRanges): DigestTerm[] {
  return RANGE_FIELD_ORDER.flatMap(field => {
    const range = ranges[field]
    return range ? [{ kind: 'range', field, range, exclude: false } satisfies DigestTerm] : []
  })
}

export function digestRule(rule: GalleryRule): RuleDigest {
  const ctx: Context = { incomplete: false }
  const root = itemExpr(rule.root, false, ctx)
  const conjuncts = !root ? [] : root.k === 'and' ? root.xs : [root]

  const tags: string[] = []
  const categories: GalleryCategory[] = []
  const uploaders: string[] = []
  const required = new Set<string>()
  const pieces: Partial<Record<RangeField, ValueRange[]>> = {}
  const groups: DigestTerm[][] = []
  const unless: DigestTerm[] = []
  const pushUnless = (term: DigestTerm) => {
    if (term.kind === 'any') term.terms.forEach(pushUnless)
    else if (!unless.some(seen => sameLeaf(seen, term))) unless.push(term)
  }

  for (const conjunct of conjuncts) {
    if (conjunct.k === 'tag') {
      if (conjunct.neg) pushUnless({ kind: 'tag', tag: conjunct.tag, exclude: false })
      else if (!tags.includes(conjunct.tag)) tags.push(conjunct.tag)
    } else if (conjunct.k === 'category') {
      if (conjunct.neg) pushUnless({ kind: 'category', category: conjunct.category, exclude: false })
      else if (!categories.includes(conjunct.category)) categories.push(conjunct.category)
    } else if (conjunct.k === 'uploader') {
      if (conjunct.neg) pushUnless({ kind: 'uploader', uploader: conjunct.uploader, exclude: false })
      else if (!required.has(normalizeUploader(conjunct.uploader))) {
        required.add(normalizeUploader(conjunct.uploader))
        uploaders.push(conjunct.uploader)
      }
    } else if (conjunct.k === 'range') {
      if (conjunct.neg) pushUnless({ kind: 'range', field: conjunct.field, range: conjunct.range, exclude: false })
      else (pieces[conjunct.field] ??= []).push(conjunct.range)
    } else if (allNegative(conjunct)) {
      // 「不含 F 或不含 G」讀起來不如「同時含有 F 和 G 就不算」
      pushUnless(toTerm(negate(conjunct)))
    } else {
      groups.push(conjunct.k === 'or' ? conjunct.xs.map(toTerm) : [toTerm(conjunct)])
    }
  }

  const ranges: DigestRanges = {}
  const notes: DigestNote[] = []
  const blocked = unlessTags(unless)
  const conflicts = tags.filter(tag => blocked.has(tag))
  if (conflicts.length) notes.push({ kind: 'conflict', tags: conflicts })
  const blockedCategories = unlessCategories(unless)
  const categoryConflicts = categories.length > 1 ? categories : categories.filter(category => blockedCategories.has(category))
  if (categoryConflicts.length) notes.push({ kind: 'categoryConflict', categories: categoryConflicts })
  const blockedUploaders = unlessUploaders(unless)
  const uploaderConflicts = uploaders.length > 1 ? uploaders : uploaders.filter(uploader => blockedUploaders.has(normalizeUploader(uploader)))
  if (uploaderConflicts.length) notes.push({ kind: 'uploaderConflict', uploaders: uploaderConflicts })
  // 跟分類同一套：一定要的那個以外都不可能，被排除的也不可能
  const otherUploader = (uploader: string) => {
    const key = normalizeUploader(uploader)
    return blockedUploaders.has(key) || (required.size > 0 && !required.has(key))
  }

  for (const field of RANGE_FIELD_ORDER) {
    const list = pieces[field]
    const range = list ? list.reduce(intersect) : null
    if (range) ranges[field] = range
    const effective = range ?? RANGE_FIELDS[field]
    if (range && isEmpty(range)) notes.push({ kind: 'rangeEmpty', field })
    else if (excludedRange(field, effective, unless)) notes.push({ kind: 'rangeExcluded', field })
    else if (range && list!.length > 1) notes.push({ kind: 'rangeMerged', field, range })
  }

  const effectiveOf = (field: RangeField) => ranges[field] ?? RANGE_FIELDS[field]
  const impossible = (term: DigestTerm): boolean => {
    if (term.kind === 'tag') return term.exclude ? tags.includes(term.tag) : blocked.has(term.tag)
    if (term.kind === 'category') {
      if (term.exclude) return categories.includes(term.category)
      return blockedCategories.has(term.category) || (categories.length > 0 && !categories.includes(term.category))
    }
    if (term.kind === 'uploader') return term.exclude ? required.has(normalizeUploader(term.uploader)) : otherUploader(term.uploader)
    if (term.kind === 'range') {
      if (term.exclude) return covers(term.range, effectiveOf(term.field))
      const range = intersect(effectiveOf(term.field), term.range)
      return isEmpty(range) || excludedRange(term.field, range, unless)
    }
    return false
  }
  const certain = (term: DigestTerm): boolean => {
    if (term.kind === 'tag') return term.exclude ? blocked.has(term.tag) : tags.includes(term.tag)
    if (term.kind === 'category') {
      if (!term.exclude) return categories.includes(term.category)
      return blockedCategories.has(term.category) || (categories.length > 0 && !categories.includes(term.category))
    }
    if (term.kind === 'uploader') return term.exclude ? otherUploader(term.uploader) : required.has(normalizeUploader(term.uploader))
    if (term.kind === 'range') {
      const effective = effectiveOf(term.field)
      return term.exclude ? isEmpty(intersect(effective, term.range)) : covers(term.range, effective)
    }
    return false
  }
  for (const group of groups) {
    if (group.every(impossible)) notes.push({ kind: 'groupImpossible', terms: group })
    else if (group.some(certain)) notes.push({ kind: 'groupRedundant', terms: group.filter(certain) })
  }

  if (ctx.incomplete) notes.push({ kind: 'incomplete' })

  return {
    tags, categories, uploaders, ranges, groups, unless, notes,
    never: notes.some(note => NEVER_NOTES[note.kind] === true),
  }
}

export type RangeShape =
  | { op: 'empty' }
  | { op: 'eq' | 'gte' | 'lte'; value: number }
  | { op: 'between'; min: number; max: number }

/** 區間在欄位上下限裡的寫法：碰到欄位邊界的一端省略不寫 */
export function rangeShape(field: RangeField, range: ValueRange): RangeShape {
  const bounds = RANGE_FIELDS[field]
  if (isEmpty(range)) return { op: 'empty' }
  if (range.min === range.max) return { op: 'eq', value: range.min }
  if (range.max >= bounds.max) return { op: 'gte', value: range.min }
  if (range.min <= bounds.min) return { op: 'lte', value: range.max }
  return { op: 'between', min: range.min, max: range.max }
}

const RANGE_SYMBOLS: Record<'eq' | 'gte' | 'lte', string> = { eq: '=', gte: '≥', lte: '≤' }

export function formatRange(field: RangeField, range: ValueRange): string {
  const shape = rangeShape(field, range)
  const value = (n: number) => String(Number(n.toFixed(2)))
  if (shape.op === 'empty') return '∅'
  if (shape.op === 'between') return `[${value(shape.min)}~${value(shape.max)}]`
  return `${RANGE_SYMBOLS[shape.op]} ${value(shape.value)}`
}

/** 星等區間換算成平均分的說法；上限不含，所以用 < 而不是 ≤ */
export function formatAverage(stars: ValueRange): string {
  const { min, max } = RANGE_FIELDS.rating
  const average = averageOfStars(stars)
  const value = (n: number) => String(Number(n.toFixed(2)))
  if (isEmpty(stars)) return '∅'
  if (average.max >= max) return average.min <= min ? '0 – 5' : `≥ ${value(average.min)}`
  if (average.min <= min) return `< ${value(average.max)}`
  return `${value(average.min)} – ${value(average.max)}`
}
