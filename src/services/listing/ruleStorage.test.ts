import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  createActions, createGroup, createRule, evaluateCondition, evaluateRule, kleeneAll, kleeneAny, resolveRuleEffects,
  type ConditionGroup, type FixedActions, type FixedConditionItem, type GalleryProbe, type Tri,
} from '@/services/listing/fixedRulePrototype'
import { decodeRules, rootFromSections, RULE_SCHEMA } from './ruleStorage'
import { itemArb, probeArb, rule } from './test-helpers'

const RED = '#cc000080'
const GREEN = '#00cc0080'
const actions: FixedActions = { ...createActions(), background: RED, showName: true }
// 每一欄都填上非預設值，確認每一欄都存得回來
const fullActions: FixedActions = {
  background: RED, blur: true, showName: true, titlePrefix: 'some prefix', dim: true, strike: true, hide: true,
}
// 12 之前的背景色是主題 token
const legacyActions = { background: 'var(--eqt-status-exclude)', blur: 'unchanged' }
const migratedActions = { background: '#8c333340', blur: false }
// 15 之前的模糊是三選一的字串
const storedBefore15 = { ...actions, blur: 'unchanged' }
const noneBefore15 = { ...createActions(), blur: 'unchanged' }
const noActions: FixedActions = createActions()
const tag = (id: number, name: string, exclude = false) => ({ id, kind: 'tag', tag: name, exclude })
const probe = (tags: string[], rating: number | null = null): GalleryProbe => ({ tags: new Set(tags), complete: true, rating, pages: null })

function ids(item: FixedConditionItem): number[] {
  return item.kind === 'group' ? [item.id, ...item.conditions.flatMap(ids)] : [item.id]
}

describe('decodeRules', () => {
  it('三區時代（schema 4）的規則換成根群組，判定不變', () => {
    const [rule] = decodeRules(JSON.stringify({
      schema: 4,
      rules: [{
        id: 1, name: 'r', enabled: true, actions: storedBefore15,
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
      rules: [{ id: 50, name: 'r', enabled: true, actions: storedBefore15, common: [], alternatives: [tag(60, 'female:a'), tag(61, 'female:b')], exceptions: [] }],
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
        id: 1, name: 'r', enabled: true, actions: storedBefore15, common: [], exceptions: [],
        groups: [{ id: 2, conditions: [tag(3, 'female:a'), tag(4, 'female:b')] }],
      }],
    }))
    expect(evaluateRule(rule, probe(['female:a']))).toBe(false)
    expect(evaluateRule(rule, probe(['female:a', 'female:b']))).toBe(true)
  })

  it('目前的格式原樣讀回來', () => {
    const child: ConditionGroup = { id: 3, kind: 'group', mode: 'all', negate: false, conditions: [tag(4, 'female:a') as FixedConditionItem] }
    const root: ConditionGroup = { id: 2, kind: 'group', mode: 'any', negate: true, conditions: [child] }
    const stored = { id: 1, name: 'r', enabled: false, root, actions: fullActions }
    expect(decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [stored] }))).toEqual([stored])
  })

  it('schema 10 的支線動作拆成各自的規則，排在原規則上面', () => {
    const branch = { ...tag(4, 'female:b'), actions: { ...noneBefore15, background: GREEN } }
    const stars = { id: 5, kind: 'rating', op: 'gte', value: 4, actions: { ...noneBefore15, blur: 'blur' } }
    const or = { id: 3, kind: 'group', mode: 'any', negate: false, conditions: [branch, { ...tag(6, 'male:c'), actions: noneBefore15 }, stars], actions: noneBefore15 }
    const root = { id: 2, kind: 'group', mode: 'all', negate: false, conditions: [{ ...tag(7, 'female:a'), actions: noneBefore15 }, or], actions: { ...noneBefore15, background: RED } }
    const rules = decodeRules(JSON.stringify({ schema: 10, rules: [{ id: 1, name: 'r', enabled: true, root }] }))
    expect(rules.map(item => [item.name, item.actions.background, item.actions.blur])).toEqual([
      ['r · 1', GREEN, false],
      ['r · 2', null, true],
      ['r', RED, false],
    ])
    expect(rules[0].root.conditions).toMatchObject([{ tag: 'female:a' }, { kind: 'group' }, { tag: 'female:b' }])
    expect(resolveRuleEffects(rules, probe(['female:a', 'female:b']))).toMatchObject({ background: GREEN, blur: false })
    expect(resolveRuleEffects(rules, probe(['female:a', 'male:c']))).toMatchObject({ background: RED, blur: false })
    expect(resolveRuleEffects(rules, probe(['female:a', 'male:c'], 4.5))).toMatchObject({ background: RED, blur: true })
    const all = rules.flatMap(item => [item.id, ...ids(item.root)])
    expect(new Set(all).size).toBe(all.length)
  })

  it('schema 9 只有群組帶動作；沒填完的規則拆出來先停用', () => {
    const branch = { id: 3, kind: 'group', mode: 'all', negate: false, conditions: [tag(4, 'female:b')], actions: { ...noneBefore15, blur: 'blur' } }
    const empty = { id: 5, kind: 'group', mode: 'all', negate: false, conditions: [], actions: noneBefore15 }
    const root = { id: 2, kind: 'group', mode: 'any', negate: false, conditions: [branch, empty], actions: noneBefore15 }
    const rules = decodeRules(JSON.stringify({ schema: 9, rules: [{ id: 1, name: 'r', enabled: true, root }] }))
    expect(rules.map(item => [item.name, item.enabled, item.actions.blur])).toEqual([['r · 1', false, true], ['r', true, false]])
  })

  it('schema 8 的動作掛在規則上，照舊讀回來', () => {
    const [decoded] = decodeRules(JSON.stringify({
      schema: 8,
      rules: [{ id: 1, name: 'r', enabled: true, actions: storedBefore15, root: { id: 2, kind: 'group', mode: 'all', negate: false, conditions: [tag(3, 'female:a')] } }],
    }))
    expect(decoded.actions).toEqual(actions)
  })

  it('schema 13 的標題前綴是勾選，勾了換成規則名稱；卡片大小、布幕與排到最後不再保留', () => {
    const { background, showName } = fullActions
    const stored = { background, blur: 'blur', showName, sticker: '👍🏽', size: 'large', titlePrefix: true, dim: false, curtain: true, strike: false, moveToEnd: true, hide: false }
    const root = { id: 2, kind: 'group', mode: 'all', negate: false, conditions: [tag(3, 'female:a')] }
    const rules = decodeRules(JSON.stringify({
      schema: 13,
      rules: [
        { id: 1, name: ' some rule ', enabled: true, actions: stored, root },
        { id: 4, name: 'other', enabled: true, actions: { ...stored, titlePrefix: false }, root: { ...root, id: 5 } },
      ],
    }))
    expect(rules.map(item => item.actions)).toEqual([
      { ...noActions, background, blur: true, showName, titlePrefix: 'some rule' },
      { ...noActions, background, blur: true, showName },
    ])
  })

  it('schema 12 還沒有貼紙之後的動作，讀進來一律不做', () => {
    const { background, showName } = fullActions
    const [decoded] = decodeRules(JSON.stringify({
      schema: 12,
      rules: [{ id: 1, name: 'r', enabled: true, actions: { background, blur: 'clear', showName }, root: { id: 2, kind: 'group', mode: 'all', negate: false, conditions: [tag(3, 'female:a')] } }],
    }))
    expect(decoded.actions).toEqual({ ...noActions, background, showName })
  })

  it('schema 5 的全部不成立換成 NOT 任一成立，判定不變；那時還沒有顯示名稱，一律不顯示', () => {
    const none = { id: 3, kind: 'group', mode: 'none', conditions: [tag(4, 'female:a'), tag(5, 'female:b')] }
    const [decoded] = decodeRules(JSON.stringify({
      schema: 5,
      rules: [{ id: 1, name: 'r', enabled: true, actions: legacyActions, root: { id: 2, kind: 'group', mode: 'all', conditions: [none] } }],
    }))
    expect(decoded.root).toMatchObject({ mode: 'all', negate: false, conditions: [{ mode: 'any', negate: true }] })
    expect(decoded.actions.showName).toBe(false)
    expect(evaluateRule(decoded, probe(['male:c']))).toBe(true)
    expect(evaluateRule(decoded, probe(['female:b']))).toBe(false)
  })

  it('schema 7 的自填標示換成顯示規則名稱：有填字就顯示，空白當成沒填', () => {
    const root = { id: 9, kind: 'group', mode: 'all', negate: false, conditions: [tag(10, 'female:a')] }
    const rules = decodeRules(JSON.stringify({
      schema: 7,
      rules: [
        { id: 1, name: 'a', enabled: true, root, actions: { ...legacyActions, label: 'some label' } },
        { id: 2, name: 'b', enabled: true, root: { ...root, id: 11 }, actions: { ...legacyActions, label: '  ' } },
      ],
    }))
    expect(rules.map(item => item.actions)).toEqual([
      { ...noActions, ...migratedActions, showName: true },
      { ...noActions, ...migratedActions, showName: false },
    ])
  })

  it('格式不對就丟錯，不會讀成空清單', () => {
    const deep = (depth: number): unknown => (depth
      ? { id: 100 + depth, kind: 'group', mode: 'all', negate: false, conditions: [deep(depth - 1)] }
      : tag(1, 'female:a'))
    const ruleWith = (root: unknown, ruleActions: unknown = actions) => JSON.stringify({
      schema: RULE_SCHEMA, rules: [{ id: 1, name: 'r', enabled: true, root, actions: ruleActions }],
    })
    expect(() => decodeRules(ruleWith(deep(5)))).toThrow()
    expect(() => decodeRules(JSON.stringify({ schema: 99, rules: [] }))).toThrow()
    expect(() => decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [{ id: 1, name: 'r', enabled: true, actions }] }))).toThrow()
    expect(() => decodeRules(ruleWith({ id: 2, kind: 'group', mode: 'all', conditions: [tag(3, 'female:a')] }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), null))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, background: 'var(--eqt-status-or)' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, blur: 'blur' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, titlePrefix: ' padded ' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, titlePrefix: true }))).toThrow()
    const { hide: _, ...missingFlag } = actions
    expect(() => decodeRules(ruleWith(deep(1), missingFlag))).toThrow()
  })
})

// 拆規則之前的算法：從根一路成立的節點，子項先於上一層、上面的支線先於下面的，每個效果取第一個有指定的
type ActionsBefore15 = { background: string | null; blur: 'unchanged' | 'blur' | 'clear'; showName: boolean }

// 背景取第一個有指定的；模糊從 15 起只剩要或不要，任一個要就模糊，保持清晰當成不要
function branchOutcome(root: ConditionGroup, branches: Map<FixedConditionItem, ActionsBefore15>, galleryProbe: GalleryProbe) {
  const fired: ActionsBefore15[] = []
  const visit = (group: ConditionGroup) => {
    for (const child of group.conditions) {
      if (child.kind === 'group') {
        if (evaluateGroup(child, galleryProbe) === true) visit(child)
      } else if (evaluateCondition(child, galleryProbe) === true) {
        fired.push(branches.get(child)!)
      }
    }
    fired.push(branches.get(group)!)
  }
  visit(root)
  let background: string | null = null
  for (const item of fired) background ??= item.background
  return { background, blur: fired.some(item => item.blur === 'blur') }
}

function evaluateGroup(group: ConditionGroup, galleryProbe: GalleryProbe): Tri {
  const asRule = { ...createRule(1), root: group }
  return evaluateRule(asRule, galleryProbe)
}

const actionsArb: fc.Arbitrary<ActionsBefore15> = fc.record({
  background: fc.constantFrom(null, RED, GREEN),
  blur: fc.constantFrom<ActionsBefore15['blur']>('unchanged', 'blur', 'clear'),
  showName: fc.constant(false),
})

describe('支線動作拆成規則', () => {
  test.prop([
    fc.tuple(fc.constantFrom<'all' | 'any'>('all', 'any'), fc.boolean(), fc.array(itemArb, { minLength: 1, maxLength: 4 })),
    fc.infiniteStream(actionsArb), probeArb,
  ])('拆出來的規則跟拆之前算出一樣的背景與模糊', ([mode, negate, conditions], stream, galleryProbe) => {
    const root = createGroup(mode, conditions, negate)
    const branches = new Map<FixedConditionItem, ActionsBefore15>()
    const toStored = (item: FixedConditionItem): unknown => {
      const own = stream.next().value as ActionsBefore15
      branches.set(item, own)
      if (item.kind !== 'group') return { ...item, actions: own }
      return { ...item, conditions: item.conditions.map(toStored), actions: own }
    }
    const stored = toStored(root)
    const rules = decodeRules(JSON.stringify({ schema: 10, rules: [{ id: 999999, name: 'r', enabled: true, root: stored }] }))
    const expected = evaluateGroup(root, galleryProbe) === true ? branchOutcome(root, branches, galleryProbe) : { background: null, blur: false }
    expect(resolveRuleEffects(rules, galleryProbe)).toMatchObject(expected)
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
