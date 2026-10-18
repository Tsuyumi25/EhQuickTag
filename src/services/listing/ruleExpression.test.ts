import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  createGroup, createRangeCondition, createTagCondition, evaluateRule, GROUP_MODES, MAX_GROUP_DEPTH, normalizeTag, RANGE_OPS,
  type ConditionGroup, type FixedConditionItem, type GroupMode, type RangeField,
} from '@/services/listing/fixedRulePrototype'
import { GALLERY_CATEGORIES } from '@/services/listing/galleryCategory'
import { applyConditions, parseConditions, printConditions, type ExpressionErrorKind } from './ruleExpression'
import { probeArb, ruleArb } from './test-helpers'

// 標籤刻意帶語法裡有意義的字：空白、括號、比較符號、開頭的 -、冒號、跟分類撞名的 namespace、空字串
const TRICKY_TAGS = [
  'female:a', 'female:some tag', 'parody:x (y)', 'other:a<b', 'male:-x', '-x', 'x', 'and', 'not', 'stars', '12',
  'category:doujinshi', 'female:', ':x', 'a b:c', 'a:b:c', '',
]
const tagTextArb = fc.oneof(
  fc.constantFrom(...TRICKY_TAGS),
  fc.string({ unit: fc.constantFrom('a', 'b', ' ', ':', '(', ')', '-', '<', '=', '1', '.'), maxLength: 8 }).map(normalizeTag),
)
const valueArb = (field: RangeField) => field === 'rating' ? fc.integer({ min: 0, max: 10 }).map(n => n / 2) : fc.integer({ min: 1, max: 200 })

let id = 0
const nextId = () => ++id

const leafArb: fc.Arbitrary<FixedConditionItem> = fc.oneof(
  fc.record({ tag: tagTextArb, exclude: fc.boolean() }).map(({ tag, exclude }) => ({ id: nextId(), kind: 'tag' as const, tag, exclude })),
  fc.record({ category: fc.constantFrom(...GALLERY_CATEGORIES), exclude: fc.boolean() })
    .map(({ category, exclude }) => ({ id: nextId(), kind: 'category' as const, category, exclude })),
  fc.constantFrom<RangeField>('rating', 'pages').chain(field => fc.tuple(
    fc.constantFrom(...RANGE_OPS), valueArb(field), valueArb(field), fc.boolean(),
  ).map(([op, a, b, open]): FixedConditionItem => ({
    id: nextId(), kind: field, op, value: Math.min(a, b),
    ...(op === 'between' && !open ? { max: Math.max(a, b) } : {}),
  }))),
)
const modeArb = fc.constantFrom<GroupMode>(...GROUP_MODES)
const groupArb = (depth: number): fc.Arbitrary<ConditionGroup> => {
  const child = depth < MAX_GROUP_DEPTH ? fc.oneof({ weight: 3, arbitrary: leafArb }, { weight: 1, arbitrary: fc.constant(null).chain(() => groupArb(depth + 1)) }) : leafArb
  return fc.tuple(modeArb, fc.boolean(), fc.array(child, { maxLength: 3 }))
    .map(([mode, negate, conditions]) => ({ id: nextId(), kind: 'group' as const, mode, negate, conditions }))
}
const rootArb = groupArb(0)

function parsed(text: string) {
  const result = parseConditions(text)
  if (!result.ok) throw new Error(`parse failed: ${JSON.stringify(result.error)} in ${JSON.stringify(text)}`)
  return result.root
}

function errorOf(text: string): { kind: ExpressionErrorKind; at: number } {
  const result = parseConditions(text)
  if (result.ok) throw new Error(`expected an error for ${JSON.stringify(text)}`)
  return { kind: result.error.kind, at: result.error.at }
}

describe('printConditions', () => {
  const tags = () => [createTagCondition('female:a'), createTagCondition('female:b')]

  it('根群組一行一個條件，子群組照原本的結構寫在同一行', () => {
    expect(printConditions(createGroup('all', [
      createTagCondition('female:a'),
      createGroup('any', [createTagCondition('female:b'), createRangeCondition('rating', 'lt', 4)]),
      createGroup('any', [createTagCondition('male:c'), { ...createRangeCondition('pages', 'between', 20), max: 80 }]),
      createGroup('any', [createTagCondition('other:d', true)], true),
    ]))).toBe([
      'female:a',
      'AND (female:b OR stars < 4)',
      'AND (male:c OR 20 <= pages <= 80)',
      'AND NOT (NOT other:d)',
    ].join('\n'))
  })

  it('根群組的判定模式接在行首，NOT 時整段包起來', () => {
    expect(printConditions(createGroup('any', tags()))).toBe('female:a\nOR female:b')
    expect(printConditions(createGroup('all', tags(), true))).toBe('NOT (\n  female:a\n  AND female:b\n)')
  })

  it('空群組寫成 ()，沒有條件的規則是空字串', () => {
    expect(printConditions(createGroup('all', [createTagCondition('female:some tag'), createGroup()]))).toBe('female:"some tag"\nAND ()')
    expect(printConditions(createGroup())).toBe('')
    expect(printConditions(createGroup('all', [], true))).toBe('NOT ()')
  })
})

describe('原始算式與條件樹', () => {
  // 根群組只有一個 NOT 群組時，印出來跟「根群組本身是 NOT」一樣；讀回來會變成後者，判定不變（下一個 property 驗證）
  const ambiguousRoot = (root: ConditionGroup) =>
    !root.negate && root.conditions.length === 1 && root.conditions[0].kind === 'group' && root.conditions[0].negate

  test.prop([rootArb])('印出來再讀回來，跟原本的樹一模一樣（含 id 與看不出來的判定模式）', (root) => {
    fc.pre(!ambiguousRoot(root))
    expect(applyConditions(parsed(printConditions(root)), root)).toEqual(root)
  })

  test.prop([ruleArb, probeArb])('不給原本的樹也能讀回來，判定結果不變', (rule, probe) => {
    const root = applyConditions(parsed(printConditions(rule.root)), createGroup())
    expect(evaluateRule({ ...rule, root }, probe)).toBe(evaluateRule(rule, probe))
  })

  it('沒寫運算子就是 AND，- 跟 NOT 一樣是排除', () => {
    const root = applyConditions(parsed('female:a -female:b'), createGroup('any'))
    expect(root.mode).toBe('all')
    expect(root.conditions).toMatchObject([{ tag: 'female:a', exclude: false }, { tag: 'female:b', exclude: true }])
  })

  it('沒有上限的介於只寫下限一側，跟 >= 是不同的條件', () => {
    expect(applyConditions(parsed('20 <= pages'), createGroup()).conditions).toMatchObject([{ kind: 'pages', op: 'between', value: 20 }])
    expect(applyConditions(parsed('pages >= 20'), createGroup()).conditions).toMatchObject([{ kind: 'pages', op: 'gte', value: 20 }])
  })

  it('改了文字之後，同一個位置還是同一種條件的沿用原本的 id', () => {
    const previous = createGroup('all', [createTagCondition('female:a'), createGroup('any', [createTagCondition('male:b')])])
    const next = applyConditions(parsed('female:c AND (male:b) AND female:d'), previous)
    expect(next.conditions.map(item => item.id).slice(0, 2)).toEqual(previous.conditions.map(item => item.id))
    expect(next.conditions[1]).toMatchObject({ kind: 'group', mode: 'any' })
  })

  it.each<[string, string, ExpressionErrorKind, number]>([
    ['同一層混用 AND 與 OR', 'a AND b OR c', 'mixed', 8],
    ['沒寫運算子也算 AND，跟 OR 混用一樣不行', 'a OR b c', 'mixed', 7],
    ['數值條件不能加 NOT', 'NOT stars >= 4', 'notRange', 4],
    ['不能連續兩個 NOT', 'NOT -a', 'doubleNot', 4],
    ['不認得的分類', 'category:foo', 'category', 0],
    ['括號沒關', 'a AND (b', 'unclosed', 6],
    ['引號沒關', 'female:"a', 'unterminated', 7],
    ['多出來的右括號', 'a)', 'unexpected', 1],
    ['運算子後面沒東西', 'a AND', 'end', 5],
    ['開頭就是運算子', 'OR a', 'unexpected', 0],
    ['比較符號前面不是欄位', 'female:a >= 3', 'field', 0],
    ['欄位名稱不會撈到 Object.prototype', 'constructor >= 3', 'field', 0],
    ['比較符號後面不是數字', 'stars >= x', 'number', 9],
    ['介於只能用 <=', '2 < stars', 'unexpected', 2],
    ['群組太深', `${'('.repeat(MAX_GROUP_DEPTH + 1)}a${')'.repeat(MAX_GROUP_DEPTH + 1)}`, 'depth', MAX_GROUP_DEPTH],
  ])('%s', (_name, text, kind, at) => {
    expect(errorOf(text)).toEqual({ kind, at })
  })
})
