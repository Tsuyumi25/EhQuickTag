import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  createRule, evaluateRule, kleeneAll, kleeneAny,
  type ConditionGroup, type FixedConditionItem, type GalleryProbe, type Tri,
} from '@/services/listing/fixedRulePrototype'
import { decodeRules, rootFromSections, RULE_SCHEMA } from './ruleStorage'
import { itemArb, probeArb, rule } from './test-helpers'

const actions = { background: 'red', blur: 'unchanged' }
const tag = (id: number, name: string, exclude = false) => ({ id, kind: 'tag', tag: name, exclude })
const probe = (tags: string[]): GalleryProbe => ({ tags: new Set(tags), complete: true, rating: null, pages: null })

function ids(item: FixedConditionItem): number[] {
  return item.kind === 'group' ? [item.id, ...item.conditions.flatMap(ids)] : [item.id]
}

describe('decodeRules', () => {
  it('三區時代（schema 4）的規則換成根群組，判定不變', () => {
    const [rule] = decodeRules(JSON.stringify({
      schema: 4,
      rules: [{
        id: 1, name: 'r', enabled: true, actions,
        common: [tag(2, 'female:a')],
        alternatives: [tag(3, 'female:b'), { id: 4, kind: 'folder', mode: 'all', conditions: [tag(5, 'male:c'), tag(6, 'other:d')] }],
        exceptions: [tag(7, 'male:e')],
      }],
    }))
    expect(rule.root.kind).toBe('group')
    expect(rule.root.mode).toBe('all')
    // a ∧ (b ∨ (c ∧ d)) ∧ ¬e
    expect(evaluateRule(rule, probe(['female:a', 'female:b']))).toBe(true)
    expect(evaluateRule(rule, probe(['female:a', 'male:c', 'other:d']))).toBe(true)
    expect(evaluateRule(rule, probe(['female:a', 'male:c']))).toBe(false)
    expect(evaluateRule(rule, probe(['female:a', 'female:b', 'male:e']))).toBe(false)
  })

  it('換成樹時新建的群組不會撞到舊 id，之後新建的規則也不會', () => {
    const [rule] = decodeRules(JSON.stringify({
      schema: 4,
      rules: [{ id: 50, name: 'r', enabled: true, actions, common: [], alternatives: [tag(60, 'female:a'), tag(61, 'female:b')], exceptions: [] }],
    }))
    const all = [rule.id, ...ids(rule.root)]
    expect(new Set(all).size).toBe(all.length)
    const fresh = createRule(2)
    expect(fresh.id).toBeGreaterThan(Math.max(...all))
  })

  it('schema 1–2 的任一成立叫 groups，裡面的 Folder 沒有 kind，當成全部成立', () => {
    const [rule] = decodeRules(JSON.stringify({
      schema: 2,
      rules: [{
        id: 1, name: 'r', enabled: true, actions, common: [], exceptions: [],
        groups: [{ id: 2, conditions: [tag(3, 'female:a'), tag(4, 'female:b')] }],
      }],
    }))
    expect(evaluateRule(rule, probe(['female:a']))).toBe(false)
    expect(evaluateRule(rule, probe(['female:a', 'female:b']))).toBe(true)
  })

  it('目前的格式原樣讀回來', () => {
    const root: ConditionGroup = { id: 2, kind: 'group', mode: 'any', conditions: [tag(3, 'female:a') as FixedConditionItem] }
    const stored = { id: 1, name: 'r', enabled: false, root, actions }
    expect(decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [stored] }))).toEqual([stored])
  })

  it('格式不對就丟錯，不會讀成空清單', () => {
    const deep = (depth: number): unknown => (depth ? { id: 100 + depth, kind: 'group', mode: 'all', conditions: [deep(depth - 1)] } : tag(1, 'female:a'))
    expect(() => decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [{ id: 1, name: 'r', enabled: true, actions, root: deep(5) }] }))).toThrow()
    expect(() => decodeRules(JSON.stringify({ schema: 99, rules: [] }))).toThrow()
    expect(() => decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [{ id: 1, name: 'r', enabled: true, actions }] }))).toThrow()
  })
})

// 舊版三區的語意：必要條件全部成立、任一成立有項目時至少一項成立、例外一項都不成立；三區都空就是全部命中
function sectionsVerdict(common: FixedConditionItem[], alternatives: FixedConditionItem[], exceptions: FixedConditionItem[], probe: GalleryProbe): Tri {
  const each = (item: FixedConditionItem) => evaluateRule(rule('all', [item]), probe)
  const exception = exceptions.length ? kleeneAny(exceptions.map(each)) : false
  return kleeneAll([
    ...common.map(each),
    alternatives.length ? kleeneAny(alternatives.map(each)) : true,
    exception === null ? null : !exception,
  ])
}

const sectionArb = fc.array(itemArb, { maxLength: 3 })

describe('三區換成根群組', () => {
  test.prop([sectionArb, sectionArb, sectionArb, probeArb])('判定結果不變；三區都空的規則變成未完成', (common, alternatives, exceptions, probe) => {
    const migrated = { ...createRule(1), root: rootFromSections(common, alternatives, exceptions) }
    const expected = common.length + alternatives.length + exceptions.length ? sectionsVerdict(common, alternatives, exceptions, probe) : null
    expect(evaluateRule(migrated, probe)).toBe(expected)
  })
})
