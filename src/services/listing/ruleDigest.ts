// 摘要不照抄規則的樹：先把它化成「一定要／至少一個／只要有就不算」的標準形，
// 攤平巢狀群組、合併數值區間，逐層看時看不到的衝突與多餘條件才算得出來。

import {
  averageOfStars, conditionRange, normalizeTag, RANGE_FIELDS,
  type FixedConditionItem, type FixedRule, type RangeCondition, type RangeField, type ValueRange,
} from '@/services/listing/fixedRulePrototype'

export type DigestMode = 'sentence' | 'rows' | 'cases' | 'raw'

export type DigestTerm =
  | { kind: 'tag'; tag: string; exclude: boolean }
  | { kind: 'range'; field: RangeField; range: ValueRange; exclude: boolean }
  | { kind: 'all'; terms: DigestTerm[] }
  | { kind: 'any'; terms: DigestTerm[] }

export type DigestNote =
  | { kind: 'conflict'; tags: string[] }
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

export interface DigestCase {
  terms: DigestTerm[]
  impossible: boolean
}

export const CASE_LIMIT = 12
const RANGE_FIELD_ORDER = Object.keys(RANGE_FIELDS) as RangeField[]
/** 出現這幾種提示，代表任何圖庫都不會命中 */
export const NEVER_NOTES: Partial<Record<DigestNote['kind'], true>> = { conflict: true, rangeEmpty: true, rangeExcluded: true, groupImpossible: true }

// 否定只掛在葉子上（NNF）：整理成三段時只要看葉子的正負號
type Expr =
  | { k: 'tag'; tag: string; neg: boolean }
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

function itemExpr(item: FixedConditionItem, neg: boolean, ctx: Context): Expr | null {
  if (item.kind === 'tag') {
    const tag = normalizeTag(item.tag)
    if (!tag) {
      ctx.incomplete = true
      return null
    }
    return { k: 'tag', tag, neg: neg !== item.exclude }
  }
  if (item.kind !== 'group') return { k: 'range', field: item.kind, range: conditionRange(item), neg }
  if (!item.conditions.length) {
    ctx.incomplete = true
    return null
  }
  // none = 一個都不成立 = 每一項都取反後全部成立；外層再取反時 and / or 互換
  const childNeg = (item.mode === 'none') !== neg
  const k = (item.mode === 'any') === neg ? 'and' : 'or'
  return junction(k, item.conditions.map(child => itemExpr(child, childNeg, ctx)))
}

function negate(expr: Expr): Expr {
  if (expr.k === 'tag' || expr.k === 'range') return { ...expr, neg: !expr.neg }
  return { k: expr.k === 'and' ? 'or' : 'and', xs: expr.xs.map(negate) }
}

function allNegative(expr: Expr): boolean {
  if (expr.k === 'tag' || expr.k === 'range') return expr.neg
  return expr.xs.every(allNegative)
}

function toTerm(expr: Expr): DigestTerm {
  if (expr.k === 'tag') return { kind: 'tag', tag: expr.tag, exclude: expr.neg }
  if (expr.k === 'range') return { kind: 'range', field: expr.field, range: expr.range, exclude: expr.neg }
  return { kind: expr.k === 'and' ? 'all' : 'any', terms: expr.xs.map(toTerm) }
}

function unlessTags(unless: readonly DigestTerm[]): Set<string> {
  const tags = new Set<string>()
  for (const term of unless) if (term.kind === 'tag' && !term.exclude) tags.add(term.tag)
  return tags
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

export function digestRule(rule: FixedRule): RuleDigest {
  const ctx: Context = { incomplete: false }
  const root = itemExpr(rule.root, false, ctx)
  const conjuncts = !root ? [] : root.k === 'and' ? root.xs : [root]

  const tags: string[] = []
  const pieces: Partial<Record<RangeField, ValueRange[]>> = {}
  const groups: DigestTerm[][] = []
  const unless: DigestTerm[] = []
  const pushUnless = (term: DigestTerm) => {
    if (term.kind === 'any') term.terms.forEach(pushUnless)
    else if (term.kind !== 'tag' || !unless.some(seen => seen.kind === 'tag' && seen.tag === term.tag && !seen.exclude)) unless.push(term)
  }

  for (const conjunct of conjuncts) {
    if (conjunct.k === 'tag') {
      if (conjunct.neg) pushUnless({ kind: 'tag', tag: conjunct.tag, exclude: false })
      else if (!tags.includes(conjunct.tag)) tags.push(conjunct.tag)
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
    if (term.kind === 'range') {
      if (term.exclude) return covers(term.range, effectiveOf(term.field))
      const range = intersect(effectiveOf(term.field), term.range)
      return isEmpty(range) || excludedRange(term.field, range, unless)
    }
    return false
  }
  const certain = (term: DigestTerm): boolean => {
    if (term.kind === 'tag') return term.exclude ? blocked.has(term.tag) : tags.includes(term.tag)
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

  return { tags, ranges, groups, unless, notes, never: notes.some(note => NEVER_NOTES[note.kind] === true) }
}

/** 把每一組「至少一個」各挑一項，展開成一列一列具體的命中情況（DNF），最多列 limit 列 */
export function digestCases(digest: RuleDigest, limit = CASE_LIMIT): { cases: DigestCase[]; total: number } {
  const total = digest.groups.reduce((product, group) => product * group.length, 1)
  const blocked = unlessTags(digest.unless)
  const cases: DigestCase[] = []
  const picks = digest.groups.map(() => 0)

  while (cases.length < Math.min(total, limit)) {
    const chosen = digest.groups.flatMap((group, index) => {
      const term = group[picks[index]]
      return term.kind === 'all' ? term.terms : [term]
    })
    const tags = [...digest.tags]
    const excluded: string[] = []
    const ranges: DigestRanges = { ...digest.ranges }
    const rest: DigestTerm[] = []
    for (const term of chosen) {
      if (term.kind === 'tag' && !term.exclude) {
        if (!tags.includes(term.tag)) tags.push(term.tag)
      } else if (term.kind === 'tag') {
        if (!excluded.includes(term.tag)) excluded.push(term.tag)
      } else if (term.kind === 'range' && !term.exclude) {
        const current = ranges[term.field]
        ranges[term.field] = current ? intersect(current, term.range) : term.range
      } else {
        rest.push(term)
      }
    }
    const impossible = tags.some(tag => blocked.has(tag) || excluded.includes(tag))
      || RANGE_FIELD_ORDER.some(field => {
        const range = ranges[field]
        return !!range && (isEmpty(range) || excludedRange(field, range, digest.unless))
      })
    cases.push({
      terms: [
        ...tags.map((tag): DigestTerm => ({ kind: 'tag', tag, exclude: false })),
        ...rangeTerms(ranges),
        ...excluded.map((tag): DigestTerm => ({ kind: 'tag', tag, exclude: true })),
        ...rest,
      ],
      impossible,
    })
    // 像里程表一樣進位：最後一組先動
    for (let index = picks.length - 1; index >= 0; index -= 1) {
      picks[index] += 1
      if (picks[index] < digest.groups[index].length) break
      picks[index] = 0
    }
  }
  return { cases, total }
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

// 原始算式照規則原本的結構寫，不做任何合併或換算，用的是純 ASCII 的 AND / OR / NOT 與 < <=：
// 要的是能整段貼給別人或 AI 判讀，不需要再看畫面
const RAW_FIELD: Record<RangeField, string> = { rating: 'stars', pages: 'pages' }
const RAW_OP: Record<Exclude<RangeCondition['op'], 'between'>, string> = { eq: '=', lt: '<', lte: '<=', gt: '>', gte: '>=' }

function rawTag(tag: string): string {
  const colon = tag.indexOf(':')
  const [namespace, name] = colon < 0 ? ['', tag] : [tag.slice(0, colon + 1), tag.slice(colon + 1)]
  return /\s/.test(name) ? `${namespace}"${name}"` : tag
}

function rawItem(item: FixedConditionItem): string {
  if (item.kind === 'tag') {
    const tag = normalizeTag(item.tag)
    if (!tag) return '(EMPTY)'
    return item.exclude ? `NOT ${rawTag(tag)}` : rawTag(tag)
  }
  if (item.kind !== 'group') {
    const field = RAW_FIELD[item.kind]
    if (item.op === 'between') return `${item.value} <= ${field} <= ${item.max ?? RANGE_FIELDS[item.kind].max}`
    return `${field} ${RAW_OP[item.op]} ${item.value}`
  }
  if (!item.conditions.length) return '(EMPTY)'
  const body = item.conditions.map(rawItem).join(item.mode === 'all' ? ' AND ' : ' OR ')
  return item.mode === 'none' ? `NOT (${body})` : `(${body})`
}

// 根群組照判定模式一行一個條件：全部成立以 AND、任一成立以 OR 接在行首；
// 全部不成立整段包在 NOT ( ) 裡，NOT 的範圍不能靠讀的人去猜
export function ruleExpression(rule: FixedRule): string {
  const lines = rule.root.conditions.map(rawItem)
  if (!lines.length) return '(EMPTY)'
  if (rule.root.mode === 'none') return `NOT (\n  ${lines.join('\n  OR ')}\n)`
  const joiner = rule.root.mode === 'all' ? 'AND' : 'OR'
  return lines.map((line, index) => (index ? `${joiner} ${line}` : line)).join('\n')
}
