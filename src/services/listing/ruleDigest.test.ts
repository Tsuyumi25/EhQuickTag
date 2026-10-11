import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  createFolder, createRangeCondition, createRule, createTagCondition, evaluateRule, RANGE_OPS,
  type FixedConditionItem, type FixedRule, type FolderMode, type GalleryProbe, type RangeField, type RangeOp, type ValueRange,
} from '@/services/listing/fixedRulePrototype'
import { digestCases, digestRule, formatRange, ruleExpression, type DigestTerm, type RuleDigest } from './ruleDigest'

const TAGS = ['female:a', 'female:b', 'male:c', 'other:d']

function rule(parts: Partial<Pick<FixedRule, 'common' | 'alternatives' | 'exceptions'>>): FixedRule {
  return { ...createRule(1), ...parts }
}

function folder(mode: FolderMode, conditions: FixedConditionItem[]) {
  return { ...createFolder(), mode, conditions }
}

const inRange = (range: ValueRange, value: number) => range.min <= value && value <= range.max

function holds(term: DigestTerm, probe: GalleryProbe): boolean {
  if (term.kind === 'tag') return probe.tags.has(term.tag) !== term.exclude
  if (term.kind === 'range') return inRange(term.range, probe[term.field]!) !== term.exclude
  return term.kind === 'all' ? term.terms.every(child => holds(child, probe)) : term.terms.some(child => holds(child, probe))
}

function digestHolds(digest: RuleDigest, probe: GalleryProbe): boolean {
  return digest.tags.every(tag => probe.tags.has(tag))
    && Object.entries(digest.ranges).every(([field, range]) => inRange(range, probe[field as RangeField]!))
    && digest.groups.every(group => group.some(term => holds(term, probe)))
    && !digest.unless.some(term => holds(term, probe))
}

describe('digestRule', () => {
  it('同一區的評分條件合併成交集', () => {
    const digest = digestRule(rule({
      common: [{ ...createRangeCondition('rating', 'between', 3), max: 4 }, createRangeCondition('rating', 'gte', 4)],
    }))
    expect(digest.ranges.rating).toEqual({ min: 4, max: 4 })
    expect(digest.notes).toContainEqual({ kind: 'rangeMerged', field: 'rating', range: { min: 4, max: 4 } })
    expect(digest.never).toBe(false)
  })

  it('評分沒有交集時永遠不會命中', () => {
    const digest = digestRule(rule({ common: [createRangeCondition('rating', 'lte', 2), createRangeCondition('rating', 'gte', 4)] }))
    expect(digest.never).toBe(true)
  })

  it('例外裡的「不含」其實是一定要含有', () => {
    const digest = digestRule(rule({ exceptions: [createTagCondition('female:a', true)] }))
    expect(digest.tags).toEqual(['female:a'])
    expect(digest.unless).toEqual([])
  })

  it('全部成立的 Folder 放進例外，讀成「同時含有就不算」', () => {
    const digest = digestRule(rule({
      exceptions: [folder('all', [createTagCondition('female:a'), createTagCondition('female:b')])],
    }))
    expect(digest.unless).toEqual([{
      kind: 'all',
      terms: [{ kind: 'tag', tag: 'female:a', exclude: false }, { kind: 'tag', tag: 'female:b', exclude: false }],
    }])
  })

  it('同一個標籤既是必要條件又是例外時永遠不會命中', () => {
    const digest = digestRule(rule({ common: [createTagCondition('female:a')], exceptions: [createTagCondition('female:a')] }))
    expect(digest.notes).toContainEqual({ kind: 'conflict', tags: ['female:a'] })
    expect(digest.never).toBe(true)
  })

  it('任一成立裡有必要條件時，那一組一定成立', () => {
    const digest = digestRule(rule({
      common: [createTagCondition('female:a')],
      alternatives: [createTagCondition('female:a'), createTagCondition('female:b')],
    }))
    expect(digest.notes).toContainEqual({ kind: 'groupRedundant', terms: [{ kind: 'tag', tag: 'female:a', exclude: false }] })
  })

  it('空 Folder 不計入並標成未完成', () => {
    const digest = digestRule(rule({ common: [createFolder()] }))
    expect(digest.notes).toEqual([{ kind: 'incomplete' }])
  })
})

describe('digestCases', () => {
  it('每一組各挑一項展開，被例外擋掉的情況標成不可能', () => {
    const digest = digestRule(rule({
      common: [createTagCondition('female:a')],
      alternatives: [createTagCondition('female:b'), createTagCondition('male:c')],
      exceptions: [createTagCondition('male:c')],
    }))
    const { cases, total } = digestCases(digest)
    expect(total).toBe(2)
    expect(cases.map(item => item.impossible)).toEqual([false, true])
  })

  it('超過上限只列前面幾種，total 仍是全部的數量', () => {
    const pair = () => folder('any', [createTagCondition('female:a'), createTagCondition('female:b')])
    const digest = digestRule(rule({ common: [pair(), pair(), pair()] }))
    const { cases, total } = digestCases(digest, 5)
    expect(total).toBe(8)
    expect(cases).toHaveLength(5)
  })
})

describe('ruleExpression', () => {
  it('三區照原本的結構寫出來，例外整段包在 NOT ( ) 裡', () => {
    const expression = ruleExpression(rule({
      common: [createTagCondition('female:a'), folder('any', [createTagCondition('female:b'), createRangeCondition('rating', 'lt', 4)])],
      alternatives: [createTagCondition('male:c'), { ...createRangeCondition('pages', 'between', 20), max: 80 }],
      exceptions: [createTagCondition('other:d', true)],
    }))
    expect(expression).toBe([
      'female:a',
      'AND (female:b OR stars < 4)',
      'AND (male:c OR 20 <= pages <= 80)',
      'AND NOT (NOT other:d)',
    ].join('\n'))
  })

  it('名稱有空白的標籤加引號，空 Folder 標成 EMPTY，三區都空是 TRUE', () => {
    expect(ruleExpression(rule({ common: [createTagCondition('female:some tag'), createFolder()] })))
      .toBe('female:"some tag"\nAND (EMPTY)')
    expect(ruleExpression(rule({}))).toBe('TRUE')
  })
})

describe('formatRange', () => {
  it.each<[RangeField, ValueRange, string]>([
    ['rating', { min: 4, max: 4 }, '= 4'],
    ['rating', { min: 4.5, max: 5 }, '≥ 4.5'],
    ['rating', { min: 0, max: 3 }, '≤ 3'],
    ['rating', { min: 3, max: 4.5 }, '[3~4.5]'],
    ['rating', { min: 4, max: 3 }, '∅'],
    ['pages', { min: 20, max: Number.POSITIVE_INFINITY }, '≥ 20'],
    ['pages', { min: 1, max: 30 }, '≤ 30'],
  ])('%s %o → %s', (field, range, text) => {
    expect(formatRange(field, range)).toBe(text)
  })
})

// 摘要是判定的另一種寫法，不能說謊：任何完整規則與完整圖庫，摘要、展開後的情況、原本的判定都要一致
const ratingArb = fc.integer({ min: 0, max: 10 }).map(n => n / 2)
const tagArb = fc.record({ tag: fc.constantFrom(...TAGS), exclude: fc.boolean() })
  .map(({ tag, exclude }) => createTagCondition(tag, exclude))
const pagesArb = fc.integer({ min: 1, max: 12 })
const rangeConditionArb = (field: RangeField, valueArb: fc.Arbitrary<number>) =>
  fc.tuple(fc.constantFrom<RangeOp>(...RANGE_OPS), valueArb, valueArb, fc.boolean())
    .map(([op, a, b, open]) => ({
      ...createRangeCondition(field, op, Math.min(a, b)),
      // 頁數的介於可以不給上限
      ...(op === 'between' && !(field === 'pages' && open) ? { max: Math.max(a, b) } : {}),
    }))
const leafArb = fc.oneof(
  { weight: 4, arbitrary: tagArb },
  { weight: 1, arbitrary: rangeConditionArb('rating', ratingArb) },
  { weight: 1, arbitrary: rangeConditionArb('pages', pagesArb) },
)
const folderArb = (inner: fc.Arbitrary<FixedConditionItem>) =>
  fc.tuple(fc.constantFrom<FolderMode>('all', 'any', 'none'), fc.array(inner, { minLength: 1, maxLength: 3 }))
    .map(([mode, conditions]) => folder(mode, conditions))
const itemArb: fc.Arbitrary<FixedConditionItem> = fc.oneof(
  { weight: 3, arbitrary: leafArb },
  { weight: 1, arbitrary: folderArb(fc.oneof({ weight: 3, arbitrary: leafArb }, { weight: 1, arbitrary: folderArb(leafArb) })) },
)
const sectionArb = fc.array(itemArb, { maxLength: 3 })
const ruleArb = fc.record({ common: sectionArb, alternatives: sectionArb, exceptions: sectionArb }).map(rule)
const probeArb = fc.record({ tags: fc.subarray(TAGS), rating: ratingArb, pages: pagesArb })
  .map(({ tags, rating, pages }): GalleryProbe => ({ tags: new Set(tags), complete: true, rating, pages }))

describe('摘要與判定一致', () => {
  test.prop([ruleArb, probeArb])('摘要命中 ⇔ 規則命中', (fixedRule, probe) => {
    expect(digestHolds(digestRule(fixedRule), probe)).toBe(evaluateRule(fixedRule, probe) === true)
  })

  test.prop([ruleArb, probeArb])('展開的情況有一列命中 ⇔ 規則命中', (fixedRule, probe) => {
    const digest = digestRule(fixedRule)
    const { cases, total } = digestCases(digest, Number.POSITIVE_INFINITY)
    expect(cases).toHaveLength(total)
    const matched = cases.some(item => item.terms.every(term => holds(term, probe)))
      && !digest.unless.some(term => holds(term, probe))
    expect(matched).toBe(evaluateRule(fixedRule, probe) === true)
  })

  test.prop([ruleArb, probeArb])('標成不可能的情況與「永遠不會命中」都不會命中', (fixedRule, probe) => {
    const digest = digestRule(fixedRule)
    if (digest.never) expect(evaluateRule(fixedRule, probe)).not.toBe(true)
    const { cases } = digestCases(digest, Number.POSITIVE_INFINITY)
    for (const item of cases) {
      if (item.impossible) expect(item.terms.every(term => holds(term, probe)) && !digest.unless.some(term => holds(term, probe))).toBe(false)
    }
  })
})
