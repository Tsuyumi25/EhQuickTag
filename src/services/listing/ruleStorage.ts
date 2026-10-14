// 規則的儲存格式：驗證與各版本之間的轉換。

import {
  BLUR_ACTIONS, createGroup, GROUP_MODES, MAX_GROUP_DEPTH, RANGE_FIELDS, RANGE_OPS, reserveRuleIds,
  type BlurAction, type ConditionGroup, type FixedActions, type FixedCondition, type FixedConditionItem, type FixedRule,
  type GroupMode, type RangeField, type RangeOp,
} from '@/services/listing/fixedRulePrototype'

// 8：效果改成「在圖庫上顯示規則名稱」（showName）。7 存的是自填的標示文字（label），
// 有填字就當成要顯示，文字本身不保留；7 之前的版本一律不顯示。
// 6：NOT 是群組的獨立旗標。5 的判定模式多一種「全部不成立」，讀進來換成 NOT 任一成立；
// 1–4 是固定三區（必要條件／任一成立／例外），讀進來時換成樹
export const RULE_SCHEMA = 8
// 三區時代每一區底下最多兩層 Folder
const LEGACY_FOLDER_DEPTH = 2

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

function validCondition(condition: unknown): condition is FixedCondition {
  if (!condition || typeof condition !== 'object' || !('id' in condition) || !Number.isSafeInteger(condition.id)
    || !('kind' in condition)) return false
  if (condition.kind === 'tag') {
    return 'tag' in condition && typeof condition.tag === 'string'
      && 'exclude' in condition && typeof condition.exclude === 'boolean'
  }
  if (typeof condition.kind !== 'string' || !Object.hasOwn(RANGE_FIELDS, condition.kind)) return false
  const field = RANGE_FIELDS[condition.kind as RangeField]
  const inField = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= field.min && value <= field.max
  return 'op' in condition && RANGE_OPS.includes(condition.op as RangeOp)
    && 'value' in condition && inField(condition.value) && (!('max' in condition) || inField(condition.max))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
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

/** depth 是群組自己在根底下第幾層（根是 0） */
function decodeGroup(value: unknown, depth: number, schema: number): ConditionGroup {
  if (!isObject(value) || value.kind !== 'group' || depth > MAX_GROUP_DEPTH || !Number.isSafeInteger(value.id)
    || !Array.isArray(value.conditions)) throw new Error('Invalid fixed rule storage')
  return {
    id: value.id as number,
    kind: 'group',
    ...decodeMode(value, schema),
    conditions: value.conditions.map((child: unknown) => {
      if (isObject(child) && child.kind === 'group') return decodeGroup(child, depth + 1, schema)
      if (!validCondition(child)) throw new Error('Invalid fixed rule storage')
      return child
    }),
  }
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
  if (!validCondition(value)) throw new Error('Invalid fixed rule storage')
  return value
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

function decodeActions(actions: unknown, schema: number): FixedActions {
  if (!isObject(actions) || (actions.background !== null && typeof actions.background !== 'string')
    || typeof actions.blur !== 'string' || !BLUR_ACTIONS.includes(actions.blur as BlurAction)) {
    throw new Error('Invalid fixed rule storage')
  }
  return { background: actions.background, blur: actions.blur as BlurAction, showName: decodeShowName(actions, schema) }
}

function decodeHeader(rule: unknown, schema: number): Omit<FixedRule, 'root'> & Record<string, unknown> {
  if (!isObject(rule) || !Number.isSafeInteger(rule.id) || typeof rule.name !== 'string' || typeof rule.enabled !== 'boolean') {
    throw new Error('Invalid fixed rule storage')
  }
  return { ...rule, actions: decodeActions(rule.actions, schema) } as Omit<FixedRule, 'root'> & Record<string, unknown>
}

/** 讀出存著的規則；格式不對就丟錯，呼叫端不能把壞資料當成空清單覆寫回去 */
export function decodeRules(raw: string | null): FixedRule[] {
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!isObject(data) || ![1, 2, 3, 4, 5, 6, 7, RULE_SCHEMA].includes(data.schema as number) || !Array.isArray(data.rules)) {
    throw new Error('Invalid fixed rule storage')
  }
  const schema = data.schema as number
  if (schema >= 5) {
    return data.rules.map((rule: unknown): FixedRule => {
      const header = decodeHeader(rule, schema)
      return { id: header.id, name: header.name, enabled: header.enabled, root: decodeGroup(header.root, 0, schema), actions: header.actions }
    })
  }
  const legacy = data.rules.map((rule: unknown) => {
    const header = decodeHeader(rule, schema)
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
    ...header, root: { id: header.id, kind: 'group' as const, mode: 'all' as const, negate: false, conditions: [...common, ...alternatives, ...exceptions] },
  })))
  return legacy.map(({ header, common, alternatives, exceptions }): FixedRule => ({
    id: header.id, name: header.name, enabled: header.enabled,
    root: rootFromSections(common, alternatives, exceptions), actions: header.actions,
  }))
}
