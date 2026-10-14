import { describe, expect, it } from 'vitest'
import {
  averageOfStars, conditionReady, conditionsFromTerms, createGroup, createRangeCondition, createRule, createTagCondition,
  evaluateCondition, evaluateRule, itemHeight, resolveRuleEffects, resolveRuleOutcome, starsFromAverage,
  type BlurAction, type ConditionGroup, type FixedActions, type FixedRule, type GalleryProbe, type RangeOp,
} from '@/services/listing/fixedRulePrototype'

const probe = (rating: number | null, tags: string[] = [], pages: number | null = null): GalleryProbe =>
  ({ tags: new Set(tags), complete: true, rating, pages })

function ruleWith(tag: string, background: string | null, blur: BlurAction, enabled = true, name = ''): FixedRule {
  const rule = createRule(1)
  rule.root.conditions.push(createTagCondition(tag))
  rule.name = name
  rule.root.actions = { background, blur, showName: name !== '' }
  rule.enabled = enabled
  return rule
}

describe('resolveRuleEffects', () => {
  it('每個效果由清單中位置最高、命中且有指定的規則決定', () => {
    const rules = [
      ruleWith('female:a', null, 'clear'),
      ruleWith('female:a', 'red', 'blur'),
      ruleWith('female:a', 'green', 'blur'),
    ]
    expect(resolveRuleEffects(rules, probe(null, ['female:a']))).toMatchObject({ background: 'red', blur: false })
  })

  it('沒命中、停用或「維持不變」的規則都讓給下面', () => {
    const rules = [
      ruleWith('female:b', 'red', 'blur'),
      ruleWith('female:a', 'green', 'blur', false),
      ruleWith('female:a', null, 'unchanged'),
      ruleWith('female:a', 'blue', 'blur'),
    ]
    expect(resolveRuleEffects(rules, probe(null, ['female:a']))).toMatchObject({ background: 'blue', blur: true })
  })

  it('勾了顯示名稱的規則各貼一個名稱，照清單順序，帶著自己的背景色', () => {
    const hidden = ruleWith('female:a', 'blue', 'unchanged', true, 'hidden')
    hidden.root.actions.showName = false
    const rules = [
      ruleWith('female:a', 'red', 'blur', true, ' first '),
      ruleWith('female:b', 'green', 'unchanged', true, 'missed'),
      ruleWith('female:a', null, 'unchanged', false, 'disabled'),
      hidden,
      ruleWith('female:a', null, 'unchanged', true, '  '),
      ruleWith('female:a', null, 'unchanged', true, 'last'),
    ]
    expect(resolveRuleEffects(rules, probe(null, ['female:a'])).labels).toEqual([
      { ruleId: rules[0].id, text: 'first', tone: 'red' },
      { ruleId: rules[5].id, text: 'last', tone: null },
    ])
  })
})

describe('resolveRuleOutcome', () => {
  const withActions = <T extends { actions: FixedActions }>(item: T, actions: Partial<FixedActions>): T => Object.assign(item.actions, actions) && item
  // a AND (B OR c)，B 是只含 b 的子群組
  function branchingRule() {
    const rule = createRule(1)
    const b = withActions(createGroup('all', [createTagCondition('female:b')]), { background: 'green' })
    const or = withActions(createGroup('any', [b, createTagCondition('male:c')]), { background: 'yellow' })
    rule.root.conditions.push(createTagCondition('female:a'), or)
    withActions(rule.root, { background: 'red', blur: 'blur' })
    return rule
  }

  it('子群組成立時蓋過上一層，沒指定的效果往上一層找', () => {
    const rule = branchingRule()
    expect(resolveRuleOutcome(rule, probe(null, ['female:a', 'female:b']))).toEqual({ background: 'green', blur: 'blur', showName: false })
    expect(resolveRuleOutcome(rule, probe(null, ['female:a', 'male:c']))).toEqual({ background: 'yellow', blur: 'blur', showName: false })
    expect(resolveRuleOutcome(rule, probe(null, ['female:b']))).toBeNull()
  })

  it('不同分支同時成立時越上面越優先；顯示名稱只要任一層有勾就顯示', () => {
    const rule = createRule(1)
    const first = withActions(createGroup('all', [createTagCondition('female:a')]), { background: 'green' })
    const second = withActions(createGroup('all', [createTagCondition('female:b')]), { background: 'blue', showName: true })
    rule.root.mode = 'any'
    rule.root.conditions.push(first, second)
    expect(resolveRuleOutcome(rule, probe(null, ['female:a', 'female:b']))).toEqual({ background: 'green', blur: 'unchanged', showName: true })
  })

  it('掛在 NOT OR 底下的子群組，規則命中時一定不成立，動作永遠不生效', () => {
    const rule = createRule(1)
    const dead = withActions(createGroup('all', [createTagCondition('female:b')]), { background: 'green' })
    rule.root.conditions.push(createTagCondition('female:a'), createGroup('any', [dead], true))
    withActions(rule.root, { background: 'red' })
    expect(resolveRuleOutcome(rule, probe(null, ['female:a']))).toMatchObject({ background: 'red' })
    expect(resolveRuleOutcome(rule, probe(null, ['female:a', 'female:b']))).toBeNull()
  })

  it('OR 底下的標籤與數值條件各自帶動作，成立的那條支線蓋過 OR 自己的動作', () => {
    const rule = createRule(1)
    const b = withActions(createTagCondition('female:b'), { background: 'green' })
    const stars = withActions(createRangeCondition('rating', 'gte', 4), { blur: 'blur' })
    const or = withActions(createGroup('any', [b, createTagCondition('male:c'), stars]), { background: 'yellow' })
    rule.root.conditions.push(or)
    expect(resolveRuleOutcome(rule, probe(1, ['female:b']))).toEqual({ background: 'green', blur: 'unchanged', showName: false })
    expect(resolveRuleOutcome(rule, probe(1, ['male:c']))).toEqual({ background: 'yellow', blur: 'unchanged', showName: false })
    expect(resolveRuleOutcome(rule, probe(4.5, ['male:c']))).toEqual({ background: 'yellow', blur: 'blur', showName: false })
  })
})

describe('評分介於', () => {
  it('上下限都包含在內', () => {
    const condition = { ...createRangeCondition('rating', 'between', 3), max: 4 }
    expect([2.9, 3, 3.5, 4, 4.1].map(rating => evaluateCondition(condition, probe(rating))))
      .toEqual([false, true, true, true, false])
  })

  it('舊資料沒有上限欄位時，上限視為 5', () => {
    expect(evaluateCondition(createRangeCondition('rating', 'between', 4), probe(5))).toBe(true)
  })

  it('下限高於上限的條件未完成，不給求值', () => {
    expect(conditionReady({ ...createRangeCondition('rating', 'between', 4), max: 3 })).toBe(false)
    expect(conditionReady({ ...createRangeCondition('rating', 'between', 3), max: 3 })).toBe(true)
  })
})

describe('< 與 ≤ 的邊界', () => {
  it('剛好落在邊界上的值：≤ 與 ≥ 算進去，< 與 > 不算', () => {
    const at = (op: RangeOp) => evaluateCondition(createRangeCondition('rating', op, 4), probe(4))
    expect((['lt', 'lte', 'eq', 'gte', 'gt'] as const).map(at)).toEqual([false, true, true, true, false])
  })

  it('< 只差一格就成立：星等差半星、頁數差一頁', () => {
    expect(evaluateCondition(createRangeCondition('rating', 'lt', 4), probe(3.5))).toBe(true)
    expect(evaluateCondition(createRangeCondition('pages', 'gt', 20), probe(null, [], 21))).toBe(true)
    expect(evaluateCondition(createRangeCondition('pages', 'gt', 20), probe(null, [], 20))).toBe(false)
  })
})

describe('星等與平均分', () => {
  it('平均分取最近的半星，剛好在中間往上進位', () => {
    expect([3.74, 3.75, 4.24, 4.25, 4.74, 4.75, 5].map(starsFromAverage)).toEqual([3.5, 4, 4, 4.5, 4.5, 5, 5])
  })

  it('星等區間換回平均分：下限往下半格、上限往上半格，5 星沒有上限', () => {
    expect(averageOfStars({ min: 4, max: 4 })).toEqual({ min: 3.75, max: 4.25 })
    expect(averageOfStars({ min: 4.5, max: 5 })).toEqual({ min: 4.25, max: 5 })
    expect(averageOfStars({ min: 0, max: 2 })).toEqual({ min: 0, max: 2.25 })
  })
})

describe('頁數', () => {
  it('列表上讀不到頁數時維持未知，不當成 0 頁', () => {
    expect(evaluateCondition(createRangeCondition('pages', 'lte', 30), probe(null))).toBeNull()
  })

  it('介於但沒有上限時，視為不設上限', () => {
    expect(evaluateCondition(createRangeCondition('pages', 'between', 20), probe(null, [], 5000))).toBe(true)
  })
})

describe('itemHeight', () => {
  it('條件是 0 層，群組依最深的子群組往上加', () => {
    const inner = createGroup('all', [createTagCondition('male:b')])
    const outer = createGroup('any', [createTagCondition('male:a'), inner])

    expect(itemHeight(createTagCondition('male:a'))).toBe(0)
    expect(itemHeight(createRangeCondition('rating'))).toBe(0)
    expect(itemHeight(createGroup())).toBe(1)
    expect(itemHeight(outer)).toBe(2)
  })
})

describe('根群組', () => {
  it('新規則的根群組是空的，算未完成，不套用到任何圖庫', () => {
    expect(evaluateRule(createRule(1), probe(5, ['female:a']))).toBeNull()
  })

  it('根群組照判定模式求值，切成任一成立就是 OR', () => {
    const rule = createRule(1)
    rule.root.conditions.push(createTagCondition('female:a'), createTagCondition('female:b'))
    expect(evaluateRule(rule, probe(null, ['female:a']))).toBe(false)
    rule.root.mode = 'any'
    expect(evaluateRule(rule, probe(null, ['female:a']))).toBe(true)
  })

  it('NOT 把判定模式的結果反過來：NOT 全部成立在缺任何一項時命中', () => {
    const rule = createRule(1)
    rule.root.conditions.push(createTagCondition('female:a'), createTagCondition('female:b'))
    rule.root.negate = true
    expect(evaluateRule(rule, probe(null, ['female:a']))).toBe(true)
    expect(evaluateRule(rule, probe(null, ['female:a', 'female:b']))).toBe(false)
  })

  it('巢狀超過上限的群組不給求值', () => {
    const rule = createRule(1)
    rule.root.conditions.push(createGroup('all', [createGroup('all', [createGroup('all', [createGroup('all', [createTagCondition('female:a')])])])]))
    expect(evaluateRule(rule, probe(null, ['female:a']))).toBeNull()
  })
})

describe('conditionsFromTerms', () => {
  it('已有的素材不再重複產生，但同一個標籤的含有與不含各算一件', () => {
    const existing = [createTagCondition('female:some tag')]
    const added = conditionsFromTerms(['female:"some tag$"', '-female:"some tag$"', 'male:other$', 'male:other$'], existing)
    expect(added.map(({ tag, exclude }) => ({ tag, exclude }))).toEqual([
      { tag: 'female:some tag', exclude: true },
      { tag: 'male:other', exclude: false },
    ])
  })

  it('沒有命名空間或解析失敗的搜尋詞不收', () => {
    expect(conditionsFromTerms(['some tag', 'title:something'])).toEqual([])
  })
})
