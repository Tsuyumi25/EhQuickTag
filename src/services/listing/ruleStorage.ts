// 規則的儲存格式與驗證。

import { parseColorInput } from '@/services/color'
import {
  createActions, GROUP_MODES, MAX_GROUP_DEPTH, normalizeTitlePrefix, RANGE_FIELDS, RANGE_OPS,
  type ConditionGroup, type FixedActions, type FixedCondition,
  type FixedRule, type GroupMode, type RangeCondition, type RangeField, type RangeOp,
} from '@/services/listing/fixedRulePrototype'
import { isGalleryCategory } from '@/services/listing/galleryCategory'

// 版號只在舊版會把新資料讀錯時才升：多一種條件或動作時，舊版讀到認不得的欄位本來就會丟錯、不會寫回，
// 跟升版號的效果一樣。升版號時要在這裡寫下哪裡變了，並讓 decodeRules 讀得懂上一版
export const RULE_SCHEMA = 1

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function invalid(): never {
  throw new Error('Invalid fixed rule storage')
}

function inField(field: RangeField, value: unknown): value is number {
  const { min, max } = RANGE_FIELDS[field]
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function decodeCondition(value: unknown): FixedCondition {
  if (!isObject(value) || !Number.isSafeInteger(value.id)) invalid()
  const id = value.id as number
  if (value.kind === 'tag') {
    if (typeof value.tag !== 'string' || typeof value.exclude !== 'boolean') invalid()
    return { id, kind: 'tag', tag: value.tag, exclude: value.exclude }
  }
  if (value.kind === 'category') {
    if (!isGalleryCategory(value.category) || typeof value.exclude !== 'boolean') invalid()
    return { id, kind: 'category', category: value.category, exclude: value.exclude }
  }
  if (value.kind === 'uploader') {
    if (typeof value.uploader !== 'string' || typeof value.exclude !== 'boolean') invalid()
    return { id, kind: 'uploader', uploader: value.uploader, exclude: value.exclude }
  }
  if (typeof value.kind !== 'string' || !Object.hasOwn(RANGE_FIELDS, value.kind)) invalid()
  const kind = value.kind as RangeField
  if (!RANGE_OPS.includes(value.op as RangeOp) || !inField(kind, value.value) || ('max' in value && !inField(kind, value.max))) {
    invalid()
  }
  const condition: RangeCondition = { id, kind, op: value.op as RangeOp, value: value.value }
  if ('max' in value) condition.max = value.max as number
  return condition
}

/** depth 是群組自己在根底下第幾層（根是 0） */
function decodeGroup(value: unknown, depth: number): ConditionGroup {
  if (!isObject(value) || value.kind !== 'group' || depth > MAX_GROUP_DEPTH || !Number.isSafeInteger(value.id)
    || !Array.isArray(value.conditions) || typeof value.mode !== 'string' || !GROUP_MODES.includes(value.mode as GroupMode)
    || typeof value.negate !== 'boolean') invalid()
  return {
    id: value.id as number,
    kind: 'group',
    mode: value.mode as GroupMode,
    negate: value.negate,
    conditions: value.conditions.map((child: unknown) =>
      isObject(child) && child.kind === 'group' ? decodeGroup(child, depth + 1) : decodeCondition(child)),
  }
}

function decodeBackground(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || parseColorInput(value, true) !== value) invalid()
  return value
}

function decodeTitlePrefix(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || normalizeTitlePrefix(value) !== value) invalid()
  return value
}

function decodeActions(actions: unknown): FixedActions {
  if (!isObject(actions)) invalid()
  for (const flag of ['blur', 'showName', 'strike', 'dim', 'hide'] as const) {
    if (typeof actions[flag] !== 'boolean') invalid()
  }
  return {
    ...createActions(),
    background: decodeBackground(actions.background),
    blur: actions.blur as boolean,
    showName: actions.showName as boolean,
    titlePrefix: decodeTitlePrefix(actions.titlePrefix),
    strike: actions.strike as boolean,
    dim: actions.dim as boolean,
    hide: actions.hide as boolean,
  }
}

function decodeRule(rule: unknown): FixedRule {
  if (!isObject(rule) || !Number.isSafeInteger(rule.id) || typeof rule.name !== 'string' || typeof rule.enabled !== 'boolean') {
    invalid()
  }
  return {
    id: rule.id as number, name: rule.name, enabled: rule.enabled,
    root: decodeGroup(rule.root, 0), actions: decodeActions(rule.actions),
  }
}

/**
 * 讀出存著的規則；格式不對就丟錯，呼叫端不能把壞資料當成空清單覆寫回去。
 * 認不得的版號（較新版本存的）也一樣丟錯，舊版才不會把新資料寫回成舊格式
 */
export function decodeRules(raw: string | null): FixedRule[] {
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!isObject(data) || data.schema !== RULE_SCHEMA || !Array.isArray(data.rules)) invalid()
  return data.rules.map(decodeRule)
}
