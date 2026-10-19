import { describe, expect, it } from 'vitest'
import { test } from '@fast-check/vitest'
import {
  averageOfStars, conditionReady, conditionsFromTerms, createActions, createCategoryCondition, createGroup, createRangeCondition, createRule, createTagCondition, createUploaderCondition, duplicateRule,
  evaluateCondition, evaluateRule, itemHeight, resolveRuleEffects, ruleEvidence, starsFromAverage,
  type ConditionGroup, type FixedConditionItem, type FixedRule, type GalleryProbe, type RangeOp,
} from '@/services/listing/fixedRulePrototype'
import { probeArb, ruleArb } from './test-helpers'

const probe = (rating: number | null, tags: string[] = [], pages: number | null = null, category: GalleryProbe['category'] = null, uploader: string | null = null): GalleryProbe =>
  ({ tags: new Set(tags), complete: true, rating, pages, category, uploader })

function ruleWith(tag: string, background: string | null, blur: number, enabled = true, name = ''): FixedRule {
  const rule = createRule(1)
  rule.root.conditions.push(createTagCondition(tag))
  rule.name = name
  rule.actions = { ...createActions(), background, blur, showName: name !== '' }
  rule.enabled = enabled
  return rule
}

describe('resolveRuleEffects', () => {
  it('背景由清單中位置最高、命中且有選背景的規則決定；模糊取最強的那條，方式跟著它', () => {
    const rules = [
      ruleWith('female:a', null, 0),
      ruleWith('female:a', 'red', 30),
      ruleWith('female:a', 'green', 80),
      ruleWith('female:a', 'blue', 80),
    ]
    rules[2].actions.blurMode = 'mosaic'
    expect(resolveRuleEffects(rules, probe(null, ['female:a']))).toMatchObject({ background: 'red', blur: 80, blurMode: 'mosaic' })
  })

  it('沒命中、停用或沒選背景的規則都讓給下面', () => {
    const rules = [
      ruleWith('female:b', 'red', 100),
      ruleWith('female:a', 'green', 90, false),
      ruleWith('female:a', null, 0),
      ruleWith('female:a', 'blue', 20),
    ]
    expect(resolveRuleEffects(rules, probe(null, ['female:a']))).toMatchObject({ background: 'blue', blur: 20 })
  })

  it('勾了顯示名稱的規則各貼一個名稱，照清單順序，帶著自己的背景色', () => {
    const hidden = ruleWith('female:a', 'blue', 0, true, 'hidden')
    hidden.actions.showName = false
    const rules = [
      ruleWith('female:a', 'red', 50, true, ' first '),
      ruleWith('female:b', 'green', 0, true, 'missed'),
      ruleWith('female:a', null, 0, false, 'disabled'),
      hidden,
      ruleWith('female:a', null, 0, true, '  '),
      ruleWith('female:a', null, 0, true, 'last'),
    ]
    expect(resolveRuleEffects(rules, probe(null, ['female:a'])).labels).toEqual([
      { ruleId: rules[0].id, text: 'first', tone: 'red', evidence: { tags: ['female:a'], categories: [], uploaders: [], ranges: [] } },
      { ruleId: rules[5].id, text: 'last', tone: null, evidence: { tags: ['female:a'], categories: [], uploaders: [], ranges: [] } },
    ])
  })

  it('標題前綴每條命中的規則各加一個，帶著自己的配色；淡化取最強，標題樣式與隱藏有一條要就做', () => {
    const top = ruleWith('female:a', null, 0, true, 'top')
    Object.assign(top.actions, { prefix: 'first', prefixColor: '#111111ff', dim: 30, bold: true })
    const middle = ruleWith('female:a', 'red', 0, true, 'middle')
    Object.assign(middle.actions, { hide: true, titleColor: '#222222ff' })
    const bottom = ruleWith('female:a', null, 0, true, 'bottom')
    Object.assign(bottom.actions, {
      prefix: 'second', prefixBackground: '#333333ff', prefixRadius: 6, dim: 70, strike: true,
      titleColor: '#444444ff', titleBackground: '#555555ff', titleRadius: 9,
    })
    const missed = ruleWith('female:b', null, 0, true, 'missed')
    Object.assign(missed.actions, { prefix: 'missed', dim: 100, italic: true })
    const effects = resolveRuleEffects([top, missed, middle, bottom], probe(null, ['female:a']))
    expect(effects).toMatchObject({ dim: 70, hide: true })
    expect(effects.title).toEqual({
      color: '#222222ff', background: '#555555ff', radius: 9, strike: true, underline: false, bold: true, italic: false,
    })
    expect(effects.prefixes.map(({ text, color, background, radius }) => ({ text, color, background, radius }))).toEqual([
      { text: 'first', color: '#111111ff', background: null, radius: 3 },
      { text: 'second', color: null, background: '#333333ff', radius: 6 },
    ])
  })
})

describe('分類條件', () => {
  it('讀不到分類時是未知；讀得到時照「是／不是這個分類」判定', () => {
    const doujinshi = createCategoryCondition('doujinshi')
    const notDoujinshi = createCategoryCondition('doujinshi', true)
    expect([null, 'doujinshi', 'manga'].map(category => evaluateCondition(doujinshi, probe(null, [], null, category as GalleryProbe['category']))))
      .toEqual([null, true, false])
    expect([null, 'doujinshi', 'manga'].map(category => evaluateCondition(notDoujinshi, probe(null, [], null, category as GalleryProbe['category']))))
      .toEqual([null, false, true])
  })
})

describe('ruleEvidence', () => {
  it('只列出成立的分支裡、讓規則成立的「含有」標籤、分類與數值條件', () => {
    const stars = createRangeCondition('rating', 'gte', 4)
    const rule = createRule(1)
    rule.root.conditions.push(
      createTagCondition('Female:A'),
      createTagCondition('female:x', true),
      createCategoryCondition('doujinshi'),
      createCategoryCondition('manga', true),
      createGroup('any', [createGroup('all', [createTagCondition('male:b'), createTagCondition('male:c')]), stars]),
      createGroup('any', [createTagCondition('female:d')], true),
    )
    expect(ruleEvidence(rule, probe(4.5, ['female:a', 'male:b'], null, 'doujinshi')))
      .toEqual({ tags: ['female:a'], categories: ['doujinshi'], uploaders: [], ranges: [stars] })
    expect(ruleEvidence(rule, probe(4.5, ['female:a', 'male:b', 'male:c'], null, 'doujinshi')))
      .toEqual({ tags: ['female:a', 'male:b', 'male:c'], categories: ['doujinshi'], uploaders: [], ranges: [stars] })
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
    expect(added.map(condition => ({ tag: condition.kind === 'tag' ? condition.tag : null, exclude: condition.exclude }))).toEqual([
      { tag: 'female:some tag', exclude: true },
      { tag: 'male:other', exclude: false },
    ])
  })

  it('沒有命名空間或解析失敗的搜尋詞不收', () => {
    expect(conditionsFromTerms(['some tag', 'title:something'])).toEqual([])
  })

  it('uploader: 限定詞變成上傳者條件，同一個人不分大小寫只收一次', () => {
    const added = conditionsFromTerms(['uploader:"Some Uploader$"', 'uploader:"some uploader"', '-uploader:"some uploader"'])
    expect(added).toMatchObject([
      { kind: 'uploader', uploader: 'Some Uploader', exclude: false },
      { kind: 'uploader', uploader: 'some uploader', exclude: true },
    ])
  })
})

describe('上傳者條件', () => {
  it('不分大小寫比對；讀不到上傳者時是未知', () => {
    const rule = createRule(1)
    rule.root.conditions.push(createUploaderCondition('Some Uploader'))
    expect(evaluateRule(rule, probe(null, [], null, null, 'some uploader'))).toBe(true)
    expect(evaluateRule(rule, probe(null, [], null, null, 'other'))).toBe(false)
    expect(evaluateRule(rule, probe(null))).toBeNull()
  })
})

describe('duplicateRule', () => {
  const ids = (rule: FixedRule): number[] => {
    const out = [rule.id]
    const walk = (item: FixedConditionItem) => {
      out.push(item.id)
      if (item.kind === 'group') item.conditions.forEach(walk)
    }
    walk(rule.root)
    return out
  }

  test.prop([ruleArb, probeArb])('每個 id 都是新的，判定與動作跟原本一樣', (rule, probe) => {
    const copy = duplicateRule(rule)
    const original = new Set(ids(rule))
    expect(ids(copy).some(id => original.has(id))).toBe(false)
    expect(new Set(ids(copy)).size).toBe(ids(copy).length)
    expect(evaluateRule(copy, probe)).toBe(evaluateRule(rule, probe))
    expect(copy.actions).toEqual(rule.actions)
  })

  it('改複本不會動到原本那條', () => {
    const rule = createRule(1)
    rule.root.conditions.push(createGroup('any', [createTagCondition('female:a')]))
    const copy = duplicateRule(rule)
    const group = copy.root.conditions[0]
    if (group.kind === 'group') group.conditions.push(createTagCondition('female:b'))
    copy.actions.blur = 60
    expect((rule.root.conditions[0] as ConditionGroup).conditions).toHaveLength(1)
    expect(rule.actions.blur).toBe(0)
  })
})
