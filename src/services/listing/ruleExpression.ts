// 原始算式：規則條件的文字寫法，跟圖形介面的條件樹是同一份資料的兩種樣子。
// 語法只收樹裡有的東西——標籤、分類、數值、帶 AND／OR 與 NOT 的群組——所以任何一棵樹都寫得出來，
// 任何讀得懂的文字也都排得回圖形介面；樹裡沒有的寫法（同一層混用 AND 與 OR、數值加 NOT）直接報錯，
// 不偷偷補括號，否則改完再印出來就不是使用者打的那段字了。

import {
  GROUP_MODE_OPERATORS, MAX_GROUP_DEPTH, nextEntityId, normalizeTag,
  type ConditionGroup, type FixedConditionItem, type GroupMode, type RangeField, type RangeOp,
} from '@/services/listing/fixedRulePrototype'
import { isGalleryCategory, type GalleryCategory } from '@/services/listing/galleryCategory'

export type ExpressionNode =
  | { kind: 'tag'; tag: string; exclude: boolean }
  | { kind: 'category'; category: GalleryCategory; exclude: boolean }
  | { kind: 'uploader'; uploader: string; exclude: boolean }
  | { kind: RangeField; op: RangeOp; value: number; max?: number }
  | ExpressionGroup

/** mode 是 null 代表文字裡看不出來：群組只有一個或沒有條件時，AND／OR 沒寫在任何地方 */
export interface ExpressionGroup {
  kind: 'group'
  mode: GroupMode | null
  negate: boolean
  conditions: ExpressionNode[]
  /** 左括號在文字裡的位置，太深時報錯用 */
  at: number
}

export type ExpressionErrorKind =
  | 'unexpected' | 'end' | 'unclosed' | 'unterminated' | 'mixed'
  | 'notRange' | 'doubleNot' | 'category' | 'field' | 'number' | 'depth'

export interface ExpressionError {
  kind: ExpressionErrorKind
  /** 出錯的字在文字裡的位置（從 0 開始） */
  at: number
  text: string
}

export type ExpressionResult = { ok: true; root: ExpressionGroup } | { ok: false; error: ExpressionError }

const FIELD_WORDS: Record<RangeField, string> = { rating: 'stars', pages: 'pages' }
const FIELDS_BY_WORD: Record<string, RangeField> = { stars: 'rating', pages: 'pages' }
const OP_SYMBOLS: Record<Exclude<RangeOp, 'between'>, string> = { eq: '=', lt: '<', lte: '<=', gt: '>', gte: '>=' }
const OPS_BY_SYMBOL: Record<string, Exclude<RangeOp, 'between'>> = { '=': 'eq', '<': 'lt', '<=': 'lte', '>': 'gt', '>=': 'gte' }
const MODES_BY_KEYWORD: Record<string, GroupMode> = { AND: 'all', OR: 'any' }
const NUMBER = /^\d+(?:\.\d+)?$/
/** 不加引號的字裡不能出現的字元：會被當成括號、引號或比較符號 */
const SPECIAL = /[\s()"<>=]/
const CATEGORY_PREFIX = 'category:'
const UPLOADER_PREFIX = 'uploader:'

/** 查表的 key 是使用者打的字，constructor 之類的名字不能撈到 Object.prototype 上的東西 */
function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

// === 印出來 ===

// 印出來的標籤都轉成小寫了，不會撞到大寫的 AND／OR／NOT
function bareSafe(text: string): boolean {
  return text !== '' && !SPECIAL.test(text) && !text.startsWith('-')
}

function printTag(raw: string): string {
  const tag = normalizeTag(raw)
  const colon = tag.indexOf(':')
  if (colon < 0) return bareSafe(tag) ? tag : `"${tag}"`
  const namespace = tag.slice(0, colon)
  const name = tag.slice(colon + 1)
  if (!bareSafe(namespace)) return `"${tag}"`
  // 不加引號的 category:xxx 是分類條件、uploader:xxx 是上傳者條件；剛好叫這兩個 namespace 的標籤要另外寫，
  // 讀回來才不會變成分類或上傳者。uploader:"名稱" 也是上傳者，所以那種標籤整段包進引號
  if (namespace === 'uploader') return `"${tag}"`
  if (namespace === 'category' || name === '' || SPECIAL.test(name)) return `${namespace}:"${name}"`
  return tag
}

const negation = (exclude: boolean) => (exclude ? 'NOT ' : '')

function printItem(item: FixedConditionItem): string {
  if (item.kind === 'tag') return negation(item.exclude) + printTag(item.tag)
  if (item.kind === 'category') return `${negation(item.exclude)}${CATEGORY_PREFIX}${item.category}`
  if (item.kind === 'uploader') {
    const name = item.uploader === '' || SPECIAL.test(item.uploader) ? `"${item.uploader}"` : item.uploader
    return `${negation(item.exclude)}${UPLOADER_PREFIX}${name}`
  }
  if (item.kind === 'group') {
    const body = item.conditions.map(printItem).join(` ${GROUP_MODE_OPERATORS[item.mode]} `)
    return `${negation(item.negate)}(${body})`
  }
  const field = FIELD_WORDS[item.kind]
  if (item.op !== 'between') return `${field} ${OP_SYMBOLS[item.op]} ${item.value}`
  // 沒有上限的介於只寫下限那一側，跟 pages >= n 是不同的條件，讀回來也要分得開
  return item.max === undefined ? `${item.value} <= ${field}` : `${item.value} <= ${field} <= ${item.max}`
}

/** 根群組一行一個條件，AND／OR 接在行首；有 NOT 時整段包在 NOT ( ) 裡，NOT 的範圍不必靠讀的人去猜 */
export function printConditions(root: ConditionGroup): string {
  const lines = root.conditions.map(printItem)
  const joiner = GROUP_MODE_OPERATORS[root.mode]
  if (root.negate) return lines.length ? `NOT (\n  ${lines.join(`\n  ${joiner} `)}\n)` : 'NOT ()'
  return lines.map((line, index) => (index ? `${joiner} ${line}` : line)).join('\n')
}

// === 讀回來 ===

type Token =
  | { type: '(' | ')' | 'not' | 'end'; at: number; text: string }
  | { type: 'mode'; at: number; text: string; mode: GroupMode }
  | { type: 'op'; at: number; text: string }
  | { type: 'word' | 'string'; at: number; text: string }
  | { type: 'tag'; at: number; text: string; tag: string }

class Failure extends Error {
  constructor(readonly detail: ExpressionError) {
    super(detail.kind)
  }
}

function fail(kind: ExpressionErrorKind, token: { at: number; text: string }): never {
  throw new Failure({ kind, at: token.at, text: token.text })
}

function readQuoted(source: string, start: number): { value: string; end: number } {
  const close = source.indexOf('"', start + 1)
  if (close < 0) fail('unterminated', { at: start, text: source.slice(start) })
  return { value: source.slice(start + 1, close), end: close + 1 }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (/\s/.test(char)) {
      index += 1
    } else if (char === '(' || char === ')') {
      tokens.push({ type: char, at: index, text: char })
      index += 1
    } else if (char === '-') {
      // E 站搜尋列的排除寫法，跟 NOT 是同一件事
      tokens.push({ type: 'not', at: index, text: char })
      index += 1
    } else if (char === '<' || char === '>' || char === '=') {
      const text = (char !== '=' && source[index + 1] === '=') ? `${char}=` : char
      tokens.push({ type: 'op', at: index, text })
      index += text.length
    } else if (char === '"') {
      const { value, end } = readQuoted(source, index)
      tokens.push({ type: 'string', at: index, text: value })
      index = end
    } else {
      let end = index
      while (end < source.length && !SPECIAL.test(source[end])) end += 1
      const word = source.slice(index, end)
      if (word.endsWith(':') && source[end] === '"') {
        const { value, end: close } = readQuoted(source, end)
        tokens.push({ type: 'tag', at: index, text: source.slice(index, close), tag: word + value })
        end = close
      } else if (word === 'NOT') {
        tokens.push({ type: 'not', at: index, text: word })
      } else {
        const mode = lookup(MODES_BY_KEYWORD, word)
        tokens.push(mode ? { type: 'mode', at: index, text: word, mode } : { type: 'word', at: index, text: word })
      }
      index = end
    }
  }
  tokens.push({ type: 'end', at: source.length, text: '' })
  return tokens
}

class Parser {
  private index = 0
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.index] }
  private next(): Token { return this.tokens[this.index++] }

  /** 讀到右括號或結尾為止；兩個條件之間沒寫運算子就是 AND，跟 E 站搜尋列一樣 */
  sequence(): { mode: GroupMode | null; conditions: ExpressionNode[] } {
    const conditions: ExpressionNode[] = []
    let mode: GroupMode | null = null
    while (this.peek().type !== ')' && this.peek().type !== 'end') {
      if (conditions.length) {
        const operator = this.peek()
        const joined = operator.type === 'mode' ? operator.mode : 'all'
        if (mode && mode !== joined) fail('mixed', operator)
        mode = joined
        if (operator.type === 'mode') {
          this.next()
          if (this.peek().type === ')' || this.peek().type === 'end') fail('end', this.peek())
        }
      } else if (this.peek().type === 'mode') {
        fail('unexpected', this.peek())
      }
      conditions.push(this.unary())
    }
    return { mode: conditions.length > 1 ? mode : null, conditions }
  }

  private unary(): ExpressionNode {
    if (this.peek().type !== 'not') return this.atom()
    this.next()
    if (this.peek().type === 'not') fail('doubleNot', this.peek())
    const start = this.peek()
    const node = this.atom()
    if (node.kind === 'group') return { ...node, negate: true }
    if (node.kind === 'tag' || node.kind === 'category' || node.kind === 'uploader') return { ...node, exclude: true }
    return fail('notRange', start)
  }

  private number(): number {
    const token = this.next()
    if (token.type !== 'word' || !NUMBER.test(token.text)) fail(token.type === 'end' ? 'end' : 'number', token)
    return Number(token.text)
  }

  private field(): RangeField {
    const token = this.next()
    const field = token.type === 'word' ? lookup(FIELDS_BY_WORD, token.text) : undefined
    if (!field) return fail(token.type === 'end' ? 'end' : 'field', token)
    return field
  }

  private atom(): ExpressionNode {
    const token = this.next()
    if (token.type === '(') {
      const { mode, conditions } = this.sequence()
      if (this.next().type !== ')') fail('unclosed', token)
      return { kind: 'group', mode, negate: false, conditions, at: token.at }
    }
    if (token.type === 'string') return { kind: 'tag', tag: token.text, exclude: false }
    if (token.type === 'tag') {
      return token.tag.startsWith(UPLOADER_PREFIX)
        ? { kind: 'uploader', uploader: token.tag.slice(UPLOADER_PREFIX.length), exclude: false }
        : { kind: 'tag', tag: token.tag, exclude: false }
    }
    if (token.type !== 'word') return fail(token.type === 'end' ? 'end' : 'unexpected', token)

    const following = this.peek()
    if (following.type === 'op') {
      // 數字在前的只有介於：n <= 欄位，後面可以再接 <= 上限
      if (NUMBER.test(token.text)) {
        if (following.text !== '<=') fail('unexpected', following)
        this.next()
        const field = this.field()
        if (this.peek().type !== 'op') return { kind: field, op: 'between', value: Number(token.text) }
        if (this.peek().text !== '<=') fail('unexpected', this.peek())
        this.next()
        return { kind: field, op: 'between', value: Number(token.text), max: this.number() }
      }
      const field = lookup(FIELDS_BY_WORD, token.text) ?? fail('field', token)
      this.next()
      return { kind: field, op: lookup(OPS_BY_SYMBOL, following.text) ?? fail('unexpected', following), value: this.number() }
    }
    if (token.text.startsWith(CATEGORY_PREFIX)) {
      const category = token.text.slice(CATEGORY_PREFIX.length)
      if (!isGalleryCategory(category)) fail('category', token)
      return { kind: 'category', category, exclude: false }
    }
    if (token.text.startsWith(UPLOADER_PREFIX)) return { kind: 'uploader', uploader: token.text.slice(UPLOADER_PREFIX.length), exclude: false }
    return { kind: 'tag', tag: token.text, exclude: false }
  }

  /** 有沒讀完的右括號就是多出來的 */
  finish(): void {
    if (this.peek().type !== 'end') fail('unexpected', this.peek())
  }
}

function checkDepth(group: ExpressionGroup, depth: number): void {
  if (depth > MAX_GROUP_DEPTH) fail('depth', { at: group.at, text: '(' })
  for (const child of group.conditions) if (child.kind === 'group') checkDepth(child, depth + 1)
}

export function parseConditions(source: string): ExpressionResult {
  try {
    const parser = new Parser(tokenize(source))
    const { mode, conditions } = parser.sequence()
    parser.finish()
    // 整段只有一個 NOT ( ) 時讀成根群組本身的 NOT：printConditions 就是這樣寫根群組的 NOT
    const only = conditions.length === 1 ? conditions[0] : null
    const root: ExpressionGroup = only?.kind === 'group' && only.negate
      ? { ...only, at: 0 }
      : { kind: 'group', mode, negate: false, conditions, at: 0 }
    for (const child of root.conditions) if (child.kind === 'group') checkDepth(child, 1)
    return { ok: true, root }
  } catch (error) {
    if (error instanceof Failure) return { ok: false, error: error.detail }
    throw error
  }
}

// === 換回條件樹 ===

/**
 * 照位置跟原本的樹對齊：同一個位置還是同一種條件就沿用它的 id，畫面上的列不會整排換掉；
 * 文字裡看不出 AND／OR 的群組（只有一個或沒有條件）也沿用原本的判定模式
 */
function buildItem(node: ExpressionNode, previous: FixedConditionItem | undefined): FixedConditionItem {
  const id = previous?.kind === node.kind ? previous.id : nextEntityId()
  if (node.kind !== 'group') return { ...node, id }
  return buildGroup(node, previous?.kind === 'group' ? previous : undefined, id)
}

function buildGroup(node: ExpressionGroup, previous: ConditionGroup | undefined, id: number): ConditionGroup {
  return {
    id,
    kind: 'group',
    mode: node.mode ?? previous?.mode ?? 'all',
    negate: node.negate,
    conditions: node.conditions.map((child, index) => buildItem(child, previous?.conditions[index])),
  }
}

export function applyConditions(root: ExpressionGroup, previous: ConditionGroup): ConditionGroup {
  return buildGroup(root, previous, previous.id)
}
