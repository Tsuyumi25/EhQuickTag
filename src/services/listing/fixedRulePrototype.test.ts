import { describe, expect, it } from 'vitest'
import {
  averageOfStars, conditionReady, conditionsFromTerms, createFolder, createRangeCondition, createRule, createTagCondition,
  evaluateCondition, itemHeight, resolveRuleEffects, starsFromAverage,
  type BlurAction, type FixedRule, type GalleryProbe, type RangeOp,
} from '@/services/listing/fixedRulePrototype'

const probe = (rating: number | null, tags: string[] = [], pages: number | null = null): GalleryProbe =>
  ({ tags: new Set(tags), complete: true, rating, pages })

function ruleWith(tag: string, background: string | null, blur: BlurAction, enabled = true): FixedRule {
  const rule = createRule(1)
  rule.common.push(createTagCondition(tag))
  rule.actions = { background, blur }
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
    expect(resolveRuleEffects(rules, probe(null, ['female:a']))).toEqual({ background: 'red', blur: false })
  })

  it('沒命中、停用或「維持不變」的規則都讓給下面', () => {
    const rules = [
      ruleWith('female:b', 'red', 'blur'),
      ruleWith('female:a', 'green', 'blur', false),
      ruleWith('female:a', null, 'unchanged'),
      ruleWith('female:a', 'blue', 'blur'),
    ]
    expect(resolveRuleEffects(rules, probe(null, ['female:a']))).toEqual({ background: 'blue', blur: true })
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
  it('條件是 0 層，Folder 依最深的子 Folder 往上加', () => {
    const inner = createFolder()
    inner.conditions.push(createTagCondition('male:b'))
    const outer = createFolder()
    outer.conditions.push(createTagCondition('male:a'), inner)

    expect(itemHeight(createTagCondition('male:a'))).toBe(0)
    expect(itemHeight(createRangeCondition('rating'))).toBe(0)
    expect(itemHeight(createFolder())).toBe(1)
    expect(itemHeight(outer)).toBe(2)
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
