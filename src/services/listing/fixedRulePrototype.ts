// Rule conditions shared by the editor and live gallery evaluation.

import { t } from '@/composables/useI18n'
import { parseTerm } from '@/services/search/searchSyntax'
import type { GalleryCategory } from '@/services/listing/galleryCategory'

/** 根群組底下最多再巢狀幾層群組 */
export const MAX_GROUP_DEPTH = 3

/** 三值：true 命中、false 不命中、null 資料不足以判定 */
export type Tri = boolean | null
export type RangeField = 'rating' | 'pages'
export type RangeOp = 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'between'

/** 也是下拉選單的順序 */
export const RANGE_OPS: readonly RangeOp[] = ['eq', 'lt', 'lte', 'gt', 'gte', 'between']

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
}

export interface RangeCondition {
  id: number
  kind: RangeField
  op: RangeOp
  value: number
  /** 只有 between 用到，value 是下限、這欄是上限；舊資料沒有這欄，視為欄位上限 */
  max?: number
}

export interface CategoryCondition {
  id: number
  kind: 'category'
  category: GalleryCategory
  exclude: boolean
}

/** 上傳者跟分類一樣，每個圖庫只有一個；E 站的 uploader: 搜尋不分大小寫，比對時也不分 */
export interface UploaderCondition {
  id: number
  kind: 'uploader'
  uploader: string
  exclude: boolean
}

export type FixedCondition = TagCondition | RangeCondition | CategoryCondition | UploaderCondition

/** 素材清單收的條件：從列表選回來的標籤與上傳者 */
export type MaterialCondition = TagCondition | UploaderCondition

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
}

export type FixedConditionItem = FixedCondition | ConditionGroup

export interface FixedActions {
  /** #rrggbbaa；透明度直接決定疊在圖庫原本底色上有多濃 */
  background: string | null
  blur: boolean
  /** 命中時把規則名稱貼在縮圖模式的標籤列上方 */
  showName: boolean
  /** 加在標題最前面的自填文字 */
  titlePrefix: string | null
  strike: boolean
  dim: boolean
  /** 從列表上拿掉這些圖庫；開著時其他動作都不作用，但設定留著，關掉隱藏就回來 */
  hide: boolean
}

// 一條規則只有一組動作：條件裡不分岔出不同的動作。想要不同的結果就另開一條規則，
// 誰優先由規則清單的順序決定，跟只有一條規則時是同一套讀法
export interface FixedRule {
  id: number
  name: string
  enabled: boolean
  /** 規則本身就是一個群組；條件不只一個時才有東西決定它們之間是「且」還是「或」 */
  root: ConditionGroup
  actions: FixedActions
}

/** 受測圖庫：tags 不完整時「沒看到」不等於「沒有」，complete 才允許推斷缺席 */
export interface GalleryProbe {
  tags: ReadonlySet<string>
  complete: boolean
  rating: number | null
  pages: number | null
  /** 讀不到就是 null，判定維持未知 */
  category: GalleryCategory | null
  /** 讀不到就是 null，判定維持未知 */
  uploader: string | null
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
  return { id: nextEntityId(), kind: 'tag', tag, exclude }
}

export function createCategoryCondition(category: GalleryCategory, exclude = false): CategoryCondition {
  return { id: nextEntityId(), kind: 'category', category, exclude }
}

export function createUploaderCondition(uploader: string, exclude = false): UploaderCondition {
  return { id: nextEntityId(), kind: 'uploader', uploader, exclude }
}

export function normalizeUploader(uploader: string): string {
  return uploader.trim().toLowerCase()
}

export function createRangeCondition(kind: RangeField, op: RangeOp = 'gte', value = RANGE_FIELDS[kind].initial): RangeCondition {
  return { id: nextEntityId(), kind, op, value }
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

/** 背景沒選代表「沒指定」，讓給下一條規則 */
export function createActions(): FixedActions {
  return { background: null, blur: false, showName: false, titlePrefix: null, strike: false, dim: false, hide: false }
}

/** 前後的空白沒有意義，標題本身會跟前綴隔開；只剩空白就是不加 */
export function normalizeTitlePrefix(raw: string): string | null {
  return raw.trim() || null
}

export function createGroup(mode: GroupMode = 'all', conditions: FixedConditionItem[] = [], negate = false): ConditionGroup {
  return { id: nextEntityId(), kind: 'group', mode, negate, conditions }
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
    // 新規則先在縮圖上掛規則按鈕：剛建好時最想確認的就是它命中了哪些圖庫
    actions: { ...createActions(), showName: true },
  }
}

function cloneGroup(group: ConditionGroup): ConditionGroup {
  return createGroup(group.mode, group.conditions.map(cloneItem), group.negate)
}

/** 每個群組與條件都換上新的 id：跟原本共用 id 的話，畫面上的列、拖曳與選取都會認錯對象 */
function cloneItem(item: FixedConditionItem): FixedConditionItem {
  return item.kind === 'group' ? cloneGroup(item) : { ...item, id: nextEntityId() }
}

export function duplicateRule(rule: FixedRule): FixedRule {
  return {
    id: nextEntityId(),
    name: t('rulePagePrototype.duplicateName', { name: rule.name }),
    enabled: rule.enabled,
    root: cloneGroup(rule.root),
    actions: { ...rule.actions },
  }
}

export function conditionReady(condition: FixedCondition): boolean {
  if (condition.kind === 'tag') return !!normalizeTag(condition.tag)
  if (condition.kind === 'category') return true
  if (condition.kind === 'uploader') return !!normalizeUploader(condition.uploader)
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
function isRuleComplete(rule: FixedRule): boolean {
  return itemReady(rule.root, 0)
}

export function evaluateCondition(condition: FixedCondition, probe: GalleryProbe): Tri {
  if (condition.kind === 'category') {
    if (probe.category === null) return null
    return (probe.category === condition.category) !== condition.exclude
  }
  if (condition.kind === 'uploader') {
    const uploader = normalizeUploader(condition.uploader)
    if (!uploader || probe.uploader === null) return null
    return (normalizeUploader(probe.uploader) === uploader) !== condition.exclude
  }
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

/** 命中原因：讓規則成立的「含有」標籤、分類、上傳者與數值條件 */
export interface RuleEvidence {
  tags: string[]
  categories: GalleryCategory[]
  uploaders: string[]
  ranges: RangeCondition[]
}

/**
 * 只走成立的分支：任一成立底下沒成立的那幾支不算原因。
 * NOT 群組與「不含」成立靠的是缺了什麼，指不出是哪個標籤，略過
 */
export function ruleEvidence(rule: FixedRule, probe: GalleryProbe): RuleEvidence {
  const tags = new Set<string>()
  const categories = new Set<GalleryCategory>()
  const uploaders = new Set<string>()
  const ranges: RangeCondition[] = []
  const walk = (item: FixedConditionItem) => {
    if (evaluateItem(item, probe) !== true) return
    if (item.kind === 'group') {
      if (!item.negate) item.conditions.forEach(walk)
    } else if (item.kind === 'tag') {
      if (!item.exclude) tags.add(normalizeTag(item.tag))
    } else if (item.kind === 'category') {
      if (!item.exclude) categories.add(item.category)
    } else if (item.kind === 'uploader') {
      if (!item.exclude) uploaders.add(item.uploader.trim())
    } else {
      ranges.push(item)
    }
  }
  walk(rule.root)
  return { tags: [...tags], categories: [...categories], uploaders: [...uploaders], ranges }
}

/** 規則掛在圖庫上的一段文字（名稱標示、標題前綴）；tone 是規則自己的背景色，沒選背景時是 null */
export interface RuleMark {
  ruleId: number
  text: string
  tone: string | null
}

export interface RuleEffects {
  background: string | null
  blur: boolean
  /** ruleId 讓點標示時能打開那一條；evidence 是滑鼠移上去看到的命中原因 */
  labels: (RuleMark & { evidence: RuleEvidence })[]
  prefixes: RuleMark[]
  strike: boolean
  dim: boolean
  hide: boolean
}

/**
 * 背景由清單裡位置最高、命中且有選背景的規則決定；沒選背景讓給下面的規則。
 * 標示與標題前綴不互相搶：每條命中的規則各加一個，照清單順序排。
 * 模糊、刪除線、淡化與隱藏只要有一條命中的規則要就做
 */
export function resolveRuleEffects(rules: readonly FixedRule[], probe: GalleryProbe): RuleEffects {
  const effects: RuleEffects = { background: null, blur: false, labels: [], prefixes: [], strike: false, dim: false, hide: false }
  for (const rule of rules) {
    if (!rule.enabled || evaluateRule(rule, probe) !== true) continue
    const { actions } = rule
    const name = rule.name.trim()
    const tone = actions.background
    effects.background ??= tone
    if (actions.showName && name) effects.labels.push({ ruleId: rule.id, text: name, tone, evidence: ruleEvidence(rule, probe) })
    if (actions.titlePrefix) effects.prefixes.push({ ruleId: rule.id, text: actions.titlePrefix, tone })
    effects.blur ||= actions.blur
    effects.strike ||= actions.strike
    effects.dim ||= actions.dim
    effects.hide ||= actions.hide
  }
  return effects
}

/** 同一個標籤或上傳者的含有與不含是兩件不同的素材，去重要連同極性一起比 */
export function materialKey(condition: MaterialCondition): string {
  return condition.kind === 'tag'
    ? tagConditionKey(condition)
    : `${condition.exclude ? '-' : '+'}uploader\u0000${normalizeUploader(condition.uploader)}`
}

/** 已經在 existing 裡的標籤與上傳者（連同極性）不再重複產生；上傳者在搜尋語法裡是 uploader: 限定詞 */
export function conditionsFromTerms(terms: readonly string[], existing: readonly MaterialCondition[] = []): MaterialCondition[] {
  const seen = new Set(existing.map(materialKey))
  const conditions: MaterialCondition[] = []
  for (const raw of terms) {
    const term = parseTerm(raw)
    if (!term.tag || term.parseError) continue
    const exclude = term.prefix === '-'
    let condition: MaterialCondition
    if (term.qualifier === 'uploader') condition = createUploaderCondition(term.tag, exclude)
    else if (term.namespace) condition = createTagCondition(`${term.namespace}:${term.tag}`, exclude)
    else continue
    const key = materialKey(condition)
    if (seen.has(key)) continue
    seen.add(key)
    conditions.push(condition)
  }
  return conditions
}
