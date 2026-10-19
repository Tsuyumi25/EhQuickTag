import { describe, expect, it } from 'vitest'
import {
  createActions, type ConditionGroup, type FixedActions, type FixedConditionItem,
} from '@/services/listing/fixedRulePrototype'
import { decodeRules, RULE_SCHEMA } from './ruleStorage'

const RED = '#cc000080'
const actions: FixedActions = { ...createActions(), background: RED, showName: true }
// 每一欄都填上非預設值，確認每一欄都存得回來
const fullActions: FixedActions = {
  background: RED, dim: 40, blur: 70, blurMode: 'mosaic', showName: true,
  prefix: 'some prefix', prefixColor: '#112233ff', prefixBackground: '#445566cc', prefixRadius: 5,
  titleColor: '#778899ff', titleBackground: '#aabbcc80', titleRadius: 12,
  strike: true, underline: true, bold: true, italic: true, hide: true,
}
const tag = (id: number, name: string, exclude = false) => ({ id, kind: 'tag', tag: name, exclude })

describe('decodeRules', () => {
  it('目前的格式原樣讀回來', () => {
    const category: FixedConditionItem = { id: 5, kind: 'category', category: 'non-h', exclude: true }
    const uploader: FixedConditionItem = { id: 6, kind: 'uploader', uploader: 'Some Uploader', exclude: false }
    const range: FixedConditionItem = { id: 7, kind: 'pages', op: 'between', value: 20, max: 80 }
    const child: ConditionGroup = {
      id: 3, kind: 'group', mode: 'all', negate: false, conditions: [tag(4, 'female:a') as FixedConditionItem, category, uploader, range],
    }
    const root: ConditionGroup = { id: 2, kind: 'group', mode: 'any', negate: true, conditions: [child] }
    const stored = { id: 1, name: 'r', enabled: false, root, actions: fullActions }
    expect(decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [stored] }))).toEqual([stored])
  })

  it('格式不對或版號認不得就丟錯，不會讀成空清單', () => {
    const deep = (depth: number): unknown => (depth
      ? { id: 100 + depth, kind: 'group', mode: 'all', negate: false, conditions: [deep(depth - 1)] }
      : tag(1, 'female:a'))
    const ruleWith = (root: unknown, ruleActions: unknown = actions) => JSON.stringify({
      schema: RULE_SCHEMA, rules: [{ id: 1, name: 'r', enabled: true, root, actions: ruleActions }],
    })
    expect(() => decodeRules(ruleWith(deep(5)))).toThrow()
    expect(() => decodeRules(JSON.stringify({ schema: RULE_SCHEMA + 1, rules: [] }))).toThrow()
    expect(() => decodeRules(JSON.stringify({ rules: [] }))).toThrow()
    expect(() => decodeRules(JSON.stringify({ schema: RULE_SCHEMA, rules: [{ id: 1, name: 'r', enabled: true, actions }] }))).toThrow()
    expect(() => decodeRules(ruleWith({ id: 2, kind: 'group', mode: 'all', conditions: [tag(3, 'female:a')] }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), null))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, background: 'var(--eqt-status-or)' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, blur: true }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, blur: 101 }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, dim: 12.5 }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, blurMode: 'pixel' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, prefixRadius: 13 }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, titleColor: 'red' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, prefix: ' padded ' }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, prefix: true }))).toThrow()
    expect(() => decodeRules(ruleWith(deep(1), { ...actions, hide: 'yes' }))).toThrow()
    expect(() => decodeRules(ruleWith({ id: 2, kind: 'group', mode: 'all', negate: false, conditions: [{ id: 3, kind: 'category', category: 'hentai', exclude: false }] }))).toThrow()
    const { strike: _, ...missingFlag } = actions
    expect(() => decodeRules(ruleWith(deep(1), missingFlag))).toThrow()
  })
})
