// 摘要不照抄規則的樹：先把它化成「一定要／至少一個／只要有就不算」的標準形，
// 攤平巢狀群組、合併數值區間，逐層看時看不到的衝突與多餘條件才算得出來。

import {
  averageOfStars, COLOR_PRESETS, conditionRange, evaluateRule, GROUP_MODE_OPERATORS, normalizeTag, RANGE_FIELDS, resolveRuleOutcome,
  type FixedActions, type FixedConditionItem, type FixedRule, type GalleryProbe, type RangeCondition, type RangeField, type RuleOutcome,
  type ValueRange,
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
  // NOT 往下推到每一項：取反後 and / or 互換；外層傳下來的取反與群組自己的 NOT 會互相抵銷
  const flip = item.negate !== neg
  const k = (item.mode === 'all') !== flip ? 'and' : 'or'
  return junction(k, item.conditions.map(child => itemExpr(child, flip, ctx)))
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

function termHolds(term: DigestTerm, probe: GalleryProbe): boolean {
  if (term.kind === 'tag') return probe.tags.has(term.tag) !== term.exclude
  if (term.kind === 'range') {
    const value = probe[term.field]
    return value !== null && (term.range.min <= value && value <= term.range.max) !== term.exclude
  }
  return term.kind === 'all' ? term.terms.every(child => termHolds(child, probe)) : term.terms.some(child => termHolds(child, probe))
}

/** 數值只需要試規則裡出現過的邊界與邊界外一格；星等是半星一格，全部試一遍也只有 11 個 */
function candidateValues(rule: FixedRule, field: RangeField): number[] {
  const { min, max, step } = RANGE_FIELDS[field]
  if (Number.isFinite(max)) return Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => min + index * step)
  const values = new Set([min])
  const visit = (item: FixedConditionItem) => {
    if (item.kind === 'group') item.conditions.forEach(visit)
    else if (item.kind === field) {
      for (const edge of [item.value, item.max ?? item.value]) for (const value of [edge - step, edge, edge + step]) if (value >= min) values.add(value)
    }
  }
  visit(rule.root)
  return [...values].sort((a, b) => a - b)
}

// 「至少一個」裡的標籤各自可有可無，最多試這麼多個的所有組合；再多就只試全部不帶
const OPTIONAL_TAG_LIMIT = 6

/**
 * 情境的一列只寫出「至少要有」的條件。拿這一列湊出最小的圖庫（列出的標籤，加上「至少一個」裡最少需要的幾個），
 * 實際跑一次判定與動作，結果就跟列表上同樣的圖庫一模一樣；湊不出來或不可能的列不給結果
 */
export function caseOutcome(rule: FixedRule, item: DigestCase): RuleOutcome | null {
  if (item.impossible) return null
  const required = new Set<string>()
  const optional = new Set<string>()
  const collect = (term: DigestTerm, inAny: boolean) => {
    if (term.kind === 'tag') {
      if (!term.exclude) (inAny ? optional : required).add(term.tag)
    } else if (term.kind !== 'range') {
      term.terms.forEach(child => collect(child, inAny || term.kind === 'any'))
    }
  }
  item.terms.forEach(term => collect(term, false))
  const extras = [...optional].filter(tag => !required.has(tag))
  const subsets = extras.length > OPTIONAL_TAG_LIMIT ? [0] : Array.from({ length: 1 << extras.length }, (_, mask) => mask)
    .sort((a, b) => bitCount(a) - bitCount(b))
  const ratings = candidateValues(rule, 'rating')
  const pages = candidateValues(rule, 'pages')
  for (const mask of subsets) {
    const tags = new Set([...required, ...extras.filter((_, index) => mask & (1 << index))])
    for (const rating of ratings) {
      for (const pageCount of pages) {
        const probe: GalleryProbe = { tags, complete: true, rating, pages: pageCount }
        if (item.terms.every(term => termHolds(term, probe)) && evaluateRule(rule, probe) === true) return resolveRuleOutcome(rule, probe)
      }
    }
  }
  return null
}

function bitCount(mask: number): number {
  let count = 0
  for (let rest = mask; rest; rest &= rest - 1) count += 1
  return count
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
// 要的是能整段貼給別人或 AI 判讀，不需要再看畫面。
// 動作用 { } 緊接在群組的括號後面，不會跟 AND / OR 搶優先順序；根群組的動作另起一行，以 => 開頭
const RAW_FIELD: Record<RangeField, string> = { rating: 'stars', pages: 'pages' }
const RAW_OP: Record<Exclude<RangeCondition['op'], 'between'>, string> = { eq: '=', lt: '<', lte: '<=', gt: '>', gte: '>=' }

function rawTag(tag: string): string {
  const colon = tag.indexOf(':')
  const [namespace, name] = colon < 0 ? ['', tag] : [tag.slice(0, colon + 1), tag.slice(colon + 1)]
  return /\s/.test(name) ? `${namespace}"${name}"` : tag
}

/** 沒指定任何動作時是空字串 */
export function rawActions(actions: FixedActions): string {
  const parts: string[] = []
  if (actions.background) parts.push(`background: ${COLOR_PRESETS.find(preset => preset.value === actions.background)?.name ?? actions.background}`)
  if (actions.blur === 'blur') parts.push('blur')
  if (actions.blur === 'clear') parts.push('no-blur')
  if (actions.showName) parts.push('show-name')
  return parts.length ? `{${parts.join(', ')}}` : ''
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
  if (!item.conditions.length) return `(EMPTY)${rawActions(item.actions)}`
  const body = item.conditions.map(rawItem).join(` ${GROUP_MODE_OPERATORS[item.mode]} `)
  return `${item.negate ? 'NOT ' : ''}(${body})${rawActions(item.actions)}`
}

// 根群組照判定模式一行一個條件，AND / OR 接在行首；
// 有 NOT 時整段包在 NOT ( ) 裡，NOT 的範圍不能靠讀的人去猜
export function ruleExpression(rule: FixedRule): string {
  const lines = rule.root.conditions.map(rawItem)
  const actions = rawActions(rule.root.actions)
  const tail = actions ? `\n=> ${actions}` : ''
  if (!lines.length) return `(EMPTY)${tail}`
  const joiner = GROUP_MODE_OPERATORS[rule.root.mode]
  if (rule.root.negate) return `NOT (\n  ${lines.join(`\n  ${joiner} `)}\n)${tail}`
  return lines.map((line, index) => (index ? `${joiner} ${line}` : line)).join('\n') + tail
}
