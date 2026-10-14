// Rule conditions shared by the editor and live gallery evaluation.

import { t } from '@/composables/useI18n'
import { parseTerm } from '@/services/search/searchSyntax'

/** 根群組底下最多再巢狀幾層群組 */
export const MAX_GROUP_DEPTH = 3

/** 三值：true 命中、false 不命中、null 資料不足以判定 */
export type Tri = boolean | null
export type RangeField = 'rating' | 'pages'
export type RangeOp = 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'between'
export type BlurAction = 'unchanged' | 'blur' | 'clear'

/** 也是下拉選單的順序 */
export const RANGE_OPS: readonly RangeOp[] = ['eq', 'lt', 'lte', 'gt', 'gte', 'between']

/** 也是模糊下拉選單的順序 */
export const BLUR_ACTIONS: readonly BlurAction[] = ['unchanged', 'blur', 'clear']

/**
 * 每種數值欄位的合法範圍、步進與新條件的預設值；頁數沒有上限。
 * rating 是列表上顯示的星等（半星一格），條件跟頁面上看到的一致，不會出現未知
 */
export const RANGE_FIELDS: Record<RangeField, { min: number; max: number; step: number; initial: number }> = {
  rating: { min: 0, max: 5, step: 0.5, initial: 4 },
  pages: { min: 1, max: Number.POSITIVE_INFINITY, step: 1, initial: 20 },
}

/** 兩端都包含；min > max 代表沒有交集 */
export interface ValueRange {
  min: number
  max: number
}

// 列表上的星等是平均分取最近的半星，剛好在中間時往上進位（3.75 → 4、4.75 → 5）；
// 拿列表擷取的星星與同一批圖庫的平均分對照過
const STAR_HALF_WIDTH = 0.25

export function starsFromAverage(average: number): number {
  return Math.floor(average * 2 + 0.5) / 2
}

/** 星等區間對應的平均分範圍：下限包含、上限不含（5 星沒有上限） */
export function averageOfStars(range: ValueRange): ValueRange {
  const { min, max } = RANGE_FIELDS.rating
  return {
    min: Math.max(min, range.min - STAR_HALF_WIDTH),
    max: range.max >= max ? max : range.max + STAR_HALF_WIDTH,
  }
}

export interface TagCondition {
  id: number
  kind: 'tag'
  tag: string
  exclude: boolean
  /** OR 底下的每一條支線各自的動作；放在 AND 底下時，上一層成立它就一定成立，等於跟上一層一起生效 */
  actions: FixedActions
}

export interface RangeCondition {
  id: number
  kind: RangeField
  op: RangeOp
  value: number
  /** 只有 between 用到，value 是下限、這欄是上限；舊資料沒有這欄，視為欄位上限 */
  max?: number
  /** 同 TagCondition.actions */
  actions: FixedActions
}

export type FixedCondition = TagCondition | RangeCondition

export type GroupMode = 'all' | 'any'

/** 也是群組判定模式切換的順序 */
export const GROUP_MODES: readonly GroupMode[] = ['all', 'any']

/** 群組標題、素材產生器與原始算式共用同一套寫法；是運算子，不翻譯 */
export const GROUP_MODE_OPERATORS: Record<GroupMode, string> = { all: 'AND', any: 'OR' }

export interface ConditionGroup {
  id: number
  kind: 'group'
  mode: GroupMode
  /** 套在判定模式外面的 NOT：all + negate = 任一不成立、any + negate = 全部不成立 */
  negate: boolean
  conditions: FixedConditionItem[]
  /** 根群組的動作是整條規則的預設；子群組的動作在它這一支成立時蓋過上一層 */
  actions: FixedActions
}

export type FixedConditionItem = FixedCondition | ConditionGroup

export interface FixedActions {
  background: string | null
  blur: BlurAction
  /** 命中時把規則名稱貼在縮圖模式的標籤列上方 */
  showName: boolean
}

/** 背景色的選項；值是主題 token，淺色與深色主題各自換色。name 是原始算式裡的寫法，不翻譯 */
export const COLOR_PRESETS: readonly { value: string; name: string; labelKey: string }[] = [
  { value: 'var(--eqt-status-or)', name: 'yellow', labelKey: 'rulePrototype.colorOr' },
  { value: 'var(--eqt-status-include)', name: 'green', labelKey: 'rulePrototype.colorInclude' },
  { value: 'var(--eqt-status-exclude)', name: 'red', labelKey: 'rulePrototype.colorExclude' },
  { value: 'var(--eqt-green)', name: 'deep-green', labelKey: 'rulePrototype.colorGreen' },
  { value: 'var(--eqt-danger)', name: 'deep-red', labelKey: 'rulePrototype.colorDanger' },
  { value: 'var(--eqt-border)', name: 'border', labelKey: 'rulePrototype.colorBorder' },
  { value: 'var(--eqt-text-hint)', name: 'muted', labelKey: 'rulePrototype.colorHint' },
]

export interface FixedRule {
  id: number
  name: string
  enabled: boolean
  /** 規則本身就是一個群組；條件不只一個時才有東西決定它們之間是「且」還是「或」 */
  root: ConditionGroup
}

/** 受測圖庫：tags 不完整時「沒看到」不等於「沒有」，complete 才允許推斷缺席 */
export interface GalleryProbe {
  tags: ReadonlySet<string>
  complete: boolean
  rating: number | null
  pages: number | null
}

// 規則 / 群組 / 條件共用同一條遞增序號——UI 的 v-for key 只要全域唯一即可，
// 刪掉中間一列時後面的列不會換 key，輸入框狀態也就不會錯位
let sequence = 0

export function nextEntityId(): number {
  sequence += 1
  return sequence
}

/** 讀進來的資料自帶 id，序號要跳過它們，之後新建的才不會撞號 */
function reserveIds(items: readonly FixedConditionItem[]): void {
  for (const item of items) {
    sequence = Math.max(sequence, item.id)
    if (item.kind === 'group') reserveIds(item.conditions)
  }
}

export function reserveRuleIds(rules: readonly FixedRule[]): void {
  for (const rule of rules) {
    sequence = Math.max(sequence, rule.id)
    reserveIds([rule.root])
  }
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export function createTagCondition(tag = '', exclude = false): TagCondition {
  return { id: nextEntityId(), kind: 'tag', tag, exclude, actions: createActions() }
}

export function createRangeCondition(kind: RangeField, op: RangeOp = 'gte', value = RANGE_FIELDS[kind].initial): RangeCondition {
  return { id: nextEntityId(), kind, op, value, actions: createActions() }
}

// 每個欄位都是離散的（半星一格、整數頁），所以 < 正好等於「≤ 往下一格」，
// 換成兩端都包含的區間之後，合併、交集與摘要都不必分開處理開閉端
export function conditionRange(condition: RangeCondition): ValueRange {
  const field = RANGE_FIELDS[condition.kind]
  if (condition.op === 'gte') return { min: condition.value, max: field.max }
  if (condition.op === 'gt') return { min: condition.value + field.step, max: field.max }
  if (condition.op === 'lte') return { min: field.min, max: condition.value }
  if (condition.op === 'lt') return { min: field.min, max: condition.value - field.step }
  if (condition.op === 'between') return { min: condition.value, max: condition.max ?? field.max }
  return { min: condition.value, max: condition.value }
}

/** 背景沒選、模糊維持不變都代表「沒指定」，讓給上一層或下一條規則 */
export function createActions(): FixedActions {
  return { background: null, blur: 'unchanged', showName: false }
}

export function hasActions(actions: FixedActions): boolean {
  return actions.background !== null || actions.blur !== 'unchanged' || actions.showName
}

export function createGroup(mode: GroupMode = 'all', conditions: FixedConditionItem[] = [], negate = false): ConditionGroup {
  return { id: nextEntityId(), kind: 'group', mode, negate, conditions, actions: createActions() }
}

/** 同一個標籤的含有與不含是兩件不同的素材，去重要連同極性一起比 */
export function tagConditionKey(condition: Pick<TagCondition, 'tag' | 'exclude'>): string {
  return `${condition.exclude ? '-' : '+'}${condition.tag}`
}

/** 群組自己算一層；條件本身是 0。用來判斷拖進某層之後會不會超過 MAX_GROUP_DEPTH */
export function itemHeight(item: FixedConditionItem): number {
  if (item.kind !== 'group') return 0
  return 1 + Math.max(0, ...item.conditions.map(itemHeight))
}

export function createRule(index: number): FixedRule {
  return {
    id: nextEntityId(),
    name: t('rulePagePrototype.newRule', { n: index }),
    enabled: true,
    root: createGroup('all'),
  }
}

export function conditionReady(condition: FixedCondition): boolean {
  if (condition.kind === 'tag') return !!normalizeTag(condition.tag)
  const field = RANGE_FIELDS[condition.kind]
  const inField = (value: number | undefined) =>
    value === undefined || (Number.isFinite(value) && value >= field.min && value <= field.max)
  if (!inField(condition.value) || !inField(condition.max)) return false
  return condition.op !== 'between' || condition.value <= (condition.max ?? field.max)
}

/** depth 是群組自己在根底下第幾層（根是 0）；空群組與太深的群組都是未完成，不給求值 */
function itemReady(item: FixedConditionItem, depth: number): boolean {
  if (item.kind !== 'group') return conditionReady(item)
  return depth <= MAX_GROUP_DEPTH && item.conditions.length > 0
    && item.conditions.every(child => itemReady(child, depth + 1))
}

/** 規則裡有沒有用到某個數值欄位；只有用到時才值得去補那個欄位的資料 */
export function ruleUsesField(rule: FixedRule, field: RangeField): boolean {
  const uses = (item: FixedConditionItem): boolean => (item.kind === 'group' ? item.conditions.some(uses) : item.kind === field)
  return uses(rule.root)
}

/** 根群組也一樣：一個條件都沒有的規則不知道要套到誰身上，算未完成 */
export function isRuleComplete(rule: FixedRule): boolean {
  return itemReady(rule.root, 0)
}

export function evaluateCondition(condition: FixedCondition, probe: GalleryProbe): Tri {
  if (condition.kind !== 'tag') {
    const value = probe[condition.kind]
    if (value === null) return null
    const range = conditionRange(condition)
    return value >= range.min && value <= range.max
  }
  const tag = normalizeTag(condition.tag)
  if (!tag) return null
  const hit = probe.tags.has(tag)
  // 標籤清單不完整時只有「有看到」能下結論，沒看到一律 unknown
  if (!hit && !probe.complete) return null
  return condition.exclude ? !hit : hit
}

export function kleeneAll(values: readonly Tri[]): Tri {
  let unknown = false
  for (const value of values) {
    if (value === false) return false
    if (value === null) unknown = true
  }
  return unknown ? null : true
}

export function kleeneAny(values: readonly Tri[]): Tri {
  let unknown = false
  for (const value of values) {
    if (value === true) return true
    if (value === null) unknown = true
  }
  return unknown ? null : false
}

function evaluateItem(item: FixedConditionItem, probe: GalleryProbe): Tri {
  if (item.kind !== 'group') return evaluateCondition(item, probe)
  const values = item.conditions.map(child => evaluateItem(child, probe))
  const matched = item.mode === 'all' ? kleeneAll(values) : kleeneAny(values)
  return item.negate && matched !== null ? !matched : matched
}

export function evaluateRule(rule: FixedRule, probe: GalleryProbe): Tri {
  return isRuleComplete(rule) ? evaluateItem(rule.root, probe) : null
}

/** 一條規則對一本圖庫的最後結果；blur 保留「維持不變」，跨規則合併時才知道要不要讓給下一條 */
export interface RuleOutcome {
  background: string | null
  blur: BlurAction
  showName: boolean
}

// 一個群組的動作要生效，從根一路到它的每一層都得成立；判定未知也算不成立。
// 收集的順序就是優先順序：子項排在上一層前面，先出現的支線排在後出現的前面
function firedActions(group: ConditionGroup, probe: GalleryProbe, out: FixedActions[]): void {
  for (const child of group.conditions) {
    if (child.kind === 'group') {
      if (evaluateItem(child, probe) === true) firedActions(child, probe, out)
    } else if (evaluateCondition(child, probe) === true) {
      out.push(child.actions)
    }
  }
  out.push(group.actions)
}

/**
 * 子群組蓋過上一層；不同分支同時成立時，越上面越優先。
 * 背景與模糊沒指定就往上一層找；顯示名稱只要成立的任一層有勾就顯示。
 * 規則沒命中（含未知）是 null；停用與否由呼叫端決定，編輯中的停用規則也要能預覽
 */
export function resolveRuleOutcome(rule: FixedRule, probe: GalleryProbe): RuleOutcome | null {
  if (evaluateRule(rule, probe) !== true) return null
  const fired: FixedActions[] = []
  firedActions(rule.root, probe, fired)
  let background: string | null = null
  let blur: BlurAction = 'unchanged'
  let showName = false
  for (const actions of fired) {
    background ??= actions.background
    if (blur === 'unchanged') blur = actions.blur
    showName ||= actions.showName
  }
  return { background, blur, showName }
}

export interface RuleEffects {
  background: string | null
  blur: boolean
  /** 底色沿用該規則最後的背景色，沒有背景時是 null；ruleId 讓點標示時能打開那一條 */
  labels: { ruleId: number; text: string; tone: string | null }[]
}

/**
 * 每條規則先算出自己的結果，背景與模糊再各自找：清單裡位置最高、命中且有指定該效果的規則說了算。
 * 「維持不變」與沒選背景都不算指定，讓給下面的規則。
 * 標示不互相搶：每條命中的規則各貼一個，照清單順序排
 */
export function resolveRuleEffects(rules: readonly FixedRule[], probe: GalleryProbe): RuleEffects {
  let background: string | null = null
  let blur: BlurAction = 'unchanged'
  const labels: RuleEffects['labels'] = []
  for (const rule of rules) {
    const outcome = rule.enabled ? resolveRuleOutcome(rule, probe) : null
    if (!outcome) continue
    background ??= outcome.background
    if (blur === 'unchanged') blur = outcome.blur
    const text = outcome.showName ? rule.name.trim() : ''
    if (text) labels.push({ ruleId: rule.id, text, tone: outcome.background })
  }
  return { background, blur: blur === 'blur', labels }
}

/** 已經在 existing 裡的標籤（連同極性）不再重複產生 */
export function conditionsFromTerms(terms: readonly string[], existing: readonly TagCondition[] = []): TagCondition[] {
  const seen = new Set(existing.map(tagConditionKey))
  const conditions: TagCondition[] = []
  for (const raw of terms) {
    const term = parseTerm(raw)
    if (!term.namespace || !term.tag || term.parseError) continue
    const tag = `${term.namespace}:${term.tag}`
    const exclude = term.prefix === '-'
    const key = tagConditionKey({ tag, exclude })
    if (seen.has(key)) continue
    seen.add(key)
    conditions.push(createTagCondition(tag, exclude))
  }
  return conditions
}
