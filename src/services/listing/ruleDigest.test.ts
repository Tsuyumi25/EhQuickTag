import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  createGroup, createRangeCondition, createTagCondition, evaluateRule,
  type GalleryProbe, type RangeField, type ValueRange,
} from '@/services/listing/fixedRulePrototype'
import { digestRule, formatRange, ruleExpression, type DigestTerm, type RuleDigest } from './ruleDigest'
import { probeArb, rule, ruleArb } from './test-helpers'

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
  it('同一個群組裡的星等條件合併成交集', () => {
    const digest = digestRule(rule('all', [{ ...createRangeCondition('rating', 'between', 3), max: 4 }, createRangeCondition('rating', 'gte', 4)]))
    expect(digest.ranges.rating).toEqual({ min: 4, max: 4 })
    expect(digest.notes).toContainEqual({ kind: 'rangeMerged', field: 'rating', range: { min: 4, max: 4 } })
    expect(digest.never).toBe(false)
  })

  it('星等沒有交集時永遠不會命中', () => {
    const digest = digestRule(rule('all', [createRangeCondition('rating', 'lte', 2), createRangeCondition('rating', 'gte', 4)]))
    expect(digest.never).toBe(true)
  })

  it('「NOT 任一成立」裡的「不含」其實是一定要含有', () => {
    const digest = digestRule(rule('all', [createGroup('any', [createTagCondition('female:a', true)], true)]))
    expect(digest.tags).toEqual(['female:a'])
    expect(digest.unless).toEqual([])
  })

  it('「全部成立」包在「NOT 任一成立」裡，讀成「同時含有就不算」', () => {
    const digest = digestRule(rule('all', [
      createGroup('any', [createGroup('all', [createTagCondition('female:a'), createTagCondition('female:b')])], true),
    ]))
    expect(digest.unless).toEqual([{
      kind: 'all',
      terms: [{ kind: 'tag', tag: 'female:a', exclude: false }, { kind: 'tag', tag: 'female:b', exclude: false }],
    }])
  })

  it('同一個標籤既一定要有又不能有時永遠不會命中', () => {
    const digest = digestRule(rule('all', [createTagCondition('female:a'), createGroup('any', [createTagCondition('female:a')], true)]))
    expect(digest.notes).toContainEqual({ kind: 'conflict', tags: ['female:a'] })
    expect(digest.never).toBe(true)
  })

  it('「任一成立」裡有一定要有的條件時，那一組一定成立', () => {
    const digest = digestRule(rule('all', [
      createTagCondition('female:a'), createGroup('any', [createTagCondition('female:a'), createTagCondition('female:b')]),
    ]))
    expect(digest.notes).toContainEqual({ kind: 'groupRedundant', terms: [{ kind: 'tag', tag: 'female:a', exclude: false }] })
  })

  it('空的根群組與空的子群組都標成未完成', () => {
    expect(digestRule(rule('all', [])).notes).toEqual([{ kind: 'incomplete' }])
    expect(digestRule(rule('all', [createGroup()])).notes).toEqual([{ kind: 'incomplete' }])
  })
})

describe('ruleExpression', () => {
  it('根群組一行一個條件，子群組照原本的結構寫，NOT 包在 NOT ( ) 裡', () => {
    const expression = ruleExpression(rule('all', [
      createTagCondition('female:a'),
      createGroup('any', [createTagCondition('female:b'), createRangeCondition('rating', 'lt', 4)]),
      createGroup('any', [createTagCondition('male:c'), { ...createRangeCondition('pages', 'between', 20), max: 80 }]),
      createGroup('any', [createTagCondition('other:d', true)], true),
    ]))
    expect(expression).toBe([
      'female:a',
      'AND (female:b OR stars < 4)',
      'AND (male:c OR 20 <= pages <= 80)',
      'AND NOT (NOT other:d)',
    ].join('\n'))
  })

  it('根群組的判定模式決定行首的運算子，NOT 時整段包起來', () => {
    const tags = () => [createTagCondition('female:a'), createTagCondition('female:b')]
    expect(ruleExpression(rule('any', tags()))).toBe('female:a\nOR female:b')
    expect(ruleExpression(rule('any', tags(), true))).toBe('NOT (\n  female:a\n  OR female:b\n)')
    expect(ruleExpression(rule('all', tags(), true))).toBe('NOT (\n  female:a\n  AND female:b\n)')
  })

  it('名稱有空白的標籤加引號，空群組與空規則都標成 EMPTY', () => {
    expect(ruleExpression(rule('all', [createTagCondition('female:some tag'), createGroup()])))
      .toBe('female:"some tag"\nAND (EMPTY)')
    expect(ruleExpression(rule('all', []))).toBe('(EMPTY)')
  })

  it('規則的動作另起一行，以 => 開頭；沒指定動作時不寫', () => {
    const fixedRule = rule('all', [createTagCondition('female:a')])
    Object.assign(fixedRule.actions, { background: '#cc000080', blur: true, showName: true })
    expect(ruleExpression(fixedRule)).toBe('female:a\n=> {background: #cc000080, blur, show-name}')
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

// 摘要是判定的另一種寫法，不能說謊：任何完整規則與完整圖庫，摘要與原本的判定都要一致
describe('摘要與判定一致', () => {
  test.prop([ruleArb, probeArb])('摘要命中 ⇔ 規則命中', (fixedRule, probe) => {
    expect(digestHolds(digestRule(fixedRule), probe)).toBe(evaluateRule(fixedRule, probe) === true)
  })

  test.prop([ruleArb, probeArb])('標成「永遠不會命中」的規則不會命中', (fixedRule, probe) => {
    if (digestRule(fixedRule).never) expect(evaluateRule(fixedRule, probe)).not.toBe(true)
  })
})
