// 規則的儲存格式：驗證與各版本之間的轉換。

import { parseColorInput } from '@/services/color'
import {
  BLUR_ACTIONS, createActions, createGroup, GROUP_MODES, hasActions, isRuleComplete, itemHeight, MAX_GROUP_DEPTH, nextEntityId,
  RANGE_FIELDS, RANGE_OPS, reserveRuleIds,
  type BlurAction, type ConditionGroup, type FixedActions, type FixedCondition, type FixedConditionItem, type FixedRule,
  type GroupMode, type RangeField, type RangeOp,
} from '@/services/listing/fixedRulePrototype'

// 12：背景色是自選的 #rrggbbaa。之前只能從幾個主題 token 裡選，讀進來換成淺色主題的色值，
// 透明度 25% 對應當時「跟底色混 25%」的畫法（LEGACY_BACKGROUNDS）。
// 11：一條規則只有一組動作，掛回規則上。9–10 的子群組與條件各自帶動作，讀進來拆成各自的規則（splitBranchActions）。
// 8：效果改成「在圖庫上顯示規則名稱」（showName）。7 存的是自填的標示文字（label），
// 有填字就當成要顯示，文字本身不保留；7 之前的版本一律不顯示。
// 6：NOT 是群組的獨立旗標。5 的判定模式多一種「全部不成立」，讀進來換成 NOT 任一成立；
// 1–4 是固定三區（必要條件／任一成立／例外），讀進來時換成樹
export const RULE_SCHEMA = 12
// 三區時代每一區底下最多兩層 Folder
const LEGACY_FOLDER_DEPTH = 2

const LEGACY_BACKGROUNDS: Record<string, string> = {
  'var(--eqt-status-or)': '#f5c51840',
  'var(--eqt-status-include)': '#7ad09440',
  'var(--eqt-status-exclude)': '#8c333340',
  'var(--eqt-green)': '#4a7c5940',
  'var(--eqt-danger)': '#8c333340',
  'var(--eqt-border)': '#b5a4a440',
  'var(--eqt-text-hint)': '#8a827140',
}

/** 9–10 存在群組與條件身上的動作，拆規則時才用得到 */
type BranchActions = Map<FixedConditionItem, FixedActions>

/**
 * 舊版的三區（必要條件 ∧ 任一成立 ∧ ¬例外）換成一棵樹，判定結果不變。
 * 例外裡的標籤直接翻轉極性放進根群組（¬(a ∨ b) = ¬a ∧ ¬b），其餘的例外收進一個 NOT 任一成立；
 * 任一成立只有一項時就是那一項本身。呼叫前要先 reserveRuleIds，新建的群組才不會撞到舊 id
 */
export function rootFromSections(
  common: readonly FixedConditionItem[],
  alternatives: readonly FixedConditionItem[],
  exceptions: readonly FixedConditionItem[],
): ConditionGroup {
  const flipped = exceptions.flatMap(item => (item.kind === 'tag' ? [{ ...item, exclude: !item.exclude }] : []))
  const rest = exceptions.filter(item => item.kind !== 'tag')
  return createGroup('all', [
    ...common,
    ...(alternatives.length === 1 ? alternatives : alternatives.length ? [createGroup('any', [...alternatives])] : []),
    ...flipped,
    ...(rest.length ? [createGroup('any', rest, true)] : []),
  ])
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function inField(field: RangeField, value: unknown): value is number {
  const { min, max } = RANGE_FIELDS[field]
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/** 只留認得的欄位：舊版本存過的動作之類不會跟著留在條件上 */
function decodeCondition(value: unknown): FixedCondition {
  if (!isObject(value) || !Number.isSafeInteger(value.id)) throw new Error('Invalid fixed rule storage')
  const id = value.id as number
  if (value.kind === 'tag') {
    if (typeof value.tag !== 'string' || typeof value.exclude !== 'boolean') throw new Error('Invalid fixed rule storage')
    return { id, kind: 'tag', tag: value.tag, exclude: value.exclude }
  }
  if (typeof value.kind !== 'string' || !Object.hasOwn(RANGE_FIELDS, value.kind)) throw new Error('Invalid fixed rule storage')
  const kind = value.kind as RangeField
  if (!RANGE_OPS.includes(value.op as RangeOp) || !inField(kind, value.value) || ('max' in value && !inField(kind, value.max))) {
    throw new Error('Invalid fixed rule storage')
  }
  const condition: FixedCondition = { id, kind, op: value.op as RangeOp, value: value.value }
  if ('max' in value) condition.max = value.max as number
  return condition
}

function validMode(mode: unknown): mode is GroupMode {
  return typeof mode === 'string' && GROUP_MODES.includes(mode as GroupMode)
}

/** schema 6 之前沒有 negate；當時的 none 就是 NOT any */
function decodeMode(value: Record<string, unknown>, schema: number): Pick<ConditionGroup, 'mode' | 'negate'> {
  if (schema < 6) {
    if (value.mode === 'none') return { mode: 'any', negate: true }
    if (!validMode(value.mode)) throw new Error('Invalid fixed rule storage')
    return { mode: value.mode, negate: false }
  }
  if (!validMode(value.mode) || typeof value.negate !== 'boolean') throw new Error('Invalid fixed rule storage')
  return { mode: value.mode, negate: value.negate }
}

/** depth 是群組自己在根底下第幾層（根是 0）；9–10 的動作收進 branches */
function decodeGroup(value: unknown, depth: number, schema: number, branches: BranchActions): ConditionGroup {
  if (!isObject(value) || value.kind !== 'group' || depth > MAX_GROUP_DEPTH || !Number.isSafeInteger(value.id)
    || !Array.isArray(value.conditions)) throw new Error('Invalid fixed rule storage')
  const group: ConditionGroup = {
    id: value.id as number,
    kind: 'group',
    ...decodeMode(value, schema),
    conditions: value.conditions.map((child: unknown) => {
      if (isObject(child) && child.kind === 'group') return decodeGroup(child, depth + 1, schema, branches)
      const condition = decodeCondition(child)
      if (schema === 10) branches.set(condition, decodeActions((child as Record<string, unknown>).actions, schema))
      return condition
    }),
  }
  if (schema === 9 || schema === 10) branches.set(group, decodeActions(value.actions, schema))
  return group
}

/** 三區時代的 Folder（kind: 'folder'；schema 1–3 的任一成立連 kind 都沒有）換成群組 */
function decodeLegacyItem(value: unknown, depth: number, bare: boolean): FixedConditionItem {
  if (isObject(value) && (value.kind === 'folder' || (bare && !('kind' in value) && 'conditions' in value))) {
    if (depth >= LEGACY_FOLDER_DEPTH || !Number.isSafeInteger(value.id) || !Array.isArray(value.conditions)) {
      throw new Error('Invalid fixed rule storage')
    }
    return {
      id: value.id as number,
      kind: 'group',
      ...(value.kind === 'folder' ? decodeMode(value, 0) : { mode: 'all', negate: false }),
      conditions: value.conditions.map((child: unknown) => decodeLegacyItem(child, depth + 1, false)),
    }
  }
  return decodeCondition(value)
}

function decodeSection(value: unknown, bare = false): FixedConditionItem[] {
  if (!Array.isArray(value)) throw new Error('Invalid fixed rule storage')
  return value.map((item: unknown) => decodeLegacyItem(item, 0, bare))
}

function decodeShowName(actions: Record<string, unknown>, schema: number): boolean {
  if (schema >= 8) {
    if (typeof actions.showName !== 'boolean') throw new Error('Invalid fixed rule storage')
    return actions.showName
  }
  if (schema === 7) {
    if (typeof actions.label !== 'string') throw new Error('Invalid fixed rule storage')
    return actions.label.trim() !== ''
  }
  return false
}

function decodeBackground(value: unknown, schema: number): string | null {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error('Invalid fixed rule storage')
  const color = schema < 12 ? LEGACY_BACKGROUNDS[value] ?? parseColorInput(value, true) : parseColorInput(value, true)
  if (!color || (schema >= 12 && color !== value)) throw new Error('Invalid fixed rule storage')
  return color
}

function decodeActions(actions: unknown, schema: number): FixedActions {
  if (!isObject(actions) || typeof actions.blur !== 'string' || !BLUR_ACTIONS.includes(actions.blur as BlurAction)) {
    throw new Error('Invalid fixed rule storage')
  }
  return {
    background: decodeBackground(actions.background, schema),
    blur: actions.blur as BlurAction,
    showName: decodeShowName(actions, schema),
  }
}

function decodeHeader(rule: unknown): Omit<FixedRule, 'root' | 'actions'> & Record<string, unknown> {
  if (!isObject(rule) || !Number.isSafeInteger(rule.id) || typeof rule.name !== 'string' || typeof rule.enabled !== 'boolean') {
    throw new Error('Invalid fixed rule storage')
  }
  return rule as Omit<FixedRule, 'root' | 'actions'> & Record<string, unknown>
}

function cloneItem(item: FixedConditionItem): FixedConditionItem {
  if (item.kind !== 'group') return { ...item, id: nextEntityId() }
  return createGroup(item.mode, item.conditions.map(cloneItem), item.negate)
}

const plainAnd = (group: ConditionGroup) => group.mode === 'all' && !group.negate
const plainOr = (group: ConditionGroup) => group.mode === 'any' && !group.negate

/**
 * 9–10 的支線動作拆成各自的規則，判定與套用結果不變：
 * 當時一個節點的動作要生效，得從根到它每一層都成立；優先順序是子項先於上一層、上面的支線先於下面的，
 * 每個效果取第一個有指定的。拆出來的規則就照這個順序排在原規則上面，條件是「這一路上每一層都成立」，
 * 而跨規則本來就是每個效果取清單裡第一個有指定的，所以兩邊算出一樣的結果。
 * 一路上的條件能省就省：AND 底下的子項跟著上一層成立，OR 跟著成立的子項成立；
 * NOT OR 成立時子項一定不成立，底下的動作從來不會生效，不拆。
 * 拆出來太深、放不進群組層數上限的支線只能捨棄。原規則沒填完時當時一個動作都不會生效，
 * 拆出來的規則可能少了沒填完的那一塊而變成能用，所以先停用。呼叫前要先 reserveRuleIds
 */
export function splitBranchActions(rule: FixedRule, branches: BranchActions): FixedRule[] {
  const split: FixedRule[] = []
  const enabled = rule.enabled && isRuleComplete(rule)
  const emit = (path: readonly FixedConditionItem[]) => {
    const node = path.at(-1)!
    const actions = branches.get(node)
    if (!actions || !hasActions(actions)) return
    const conditions: FixedConditionItem[] = []
    path.forEach((item, index) => {
      const parent = path[index - 1] as ConditionGroup | undefined
      if (parent && plainAnd(parent)) return
      if (item.kind === 'group' && plainOr(item) && index < path.length - 1) return
      if (index === 0 && plainAnd(rule.root)) conditions.push(...rule.root.conditions.map(cloneItem))
      else conditions.push(cloneItem(item))
    })
    const root = createGroup('all', conditions)
    if (itemHeight(root) > MAX_GROUP_DEPTH + 1) return
    split.push({ id: nextEntityId(), name: `${rule.name} · ${split.length + 1}`, enabled, root, actions })
  }
  const visit = (path: readonly ConditionGroup[]) => {
    const group = path.at(-1)!
    if (!(group.mode === 'any' && group.negate)) {
      for (const child of group.conditions) {
        if (child.kind === 'group') visit([...path, child])
        else emit([...path, child])
      }
    }
    if (path.length > 1) emit(path)
  }
  visit([rule.root])
  return split
}

/** 讀出存著的規則；格式不對就丟錯，呼叫端不能把壞資料當成空清單覆寫回去 */
export function decodeRules(raw: string | null): FixedRule[] {
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!isObject(data) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, RULE_SCHEMA].includes(data.schema as number) || !Array.isArray(data.rules)) {
    throw new Error('Invalid fixed rule storage')
  }
  const schema = data.schema as number
  if (schema >= 5) {
    const branches: BranchActions = new Map()
    const rules = data.rules.map((rule: unknown): FixedRule => {
      const header = decodeHeader(rule)
      const root = decodeGroup(header.root, 0, schema, branches)
      const actions = schema === 9 || schema === 10 ? branches.get(root)! : decodeActions(header.actions, schema)
      return { id: header.id, name: header.name, enabled: header.enabled, root, actions }
    })
    if (schema !== 9 && schema !== 10) return rules
    reserveRuleIds(rules)
    return rules.flatMap(rule => [...splitBranchActions(rule, branches), rule])
  }
  const legacy = data.rules.map((rule: unknown) => {
    const header = decodeHeader(rule)
    // schema 1–2 的任一成立叫 groups
    const alternatives = data.schema === 1 || data.schema === 2 ? header.groups : header.alternatives
    return {
      header,
      common: decodeSection(header.common),
      alternatives: decodeSection(alternatives, data.schema !== 4),
      exceptions: decodeSection(header.exceptions),
    }
  })
  // 換成樹時會新建群組，序號要先跳過所有舊 id；三區先暫時裝進一個沿用規則 id 的群組，只為了一次掃完
  reserveRuleIds(legacy.map(({ header, common, alternatives, exceptions }) => ({
    ...header,
    root: { id: header.id, kind: 'group' as const, mode: 'all' as const, negate: false, conditions: [...common, ...alternatives, ...exceptions] },
    actions: createActions(),
  })))
  return legacy.map(({ header, common, alternatives, exceptions }): FixedRule => ({
    id: header.id, name: header.name, enabled: header.enabled,
    root: rootFromSections(common, alternatives, exceptions), actions: decodeActions(header.actions, schema),
  }))
}
