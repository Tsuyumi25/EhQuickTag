import { TagState, type TagMode } from '@/types'
import { parseTerm, serializeTerm, TERM_RE } from './searchSyntax'

export function tokenize(text: string): string[] {
  return text.match(TERM_RE) ?? []
}

/** Normalize namespace to long form for comparison. Preserves prefix, suffix, quoting. */
const _nsCache = new Map<string, string>()
export function normalizeNs(tokenStr: string): string {
  let result = _nsCache.get(tokenStr)
  if (result !== undefined) return result
  const parsed = parseTerm(tokenStr)
  // namespaceRaw: null forces serializeTerm to use nsFormat fallback instead of preserving raw form
  result = parsed.parseError ? tokenStr : serializeTerm({ ...parsed, namespaceRaw: null }, { nsFormat: 'long' })
  _nsCache.set(tokenStr, result)
  return result
}

export type ButtonShape = 'all-positive' | 'all-negative' | 'all-or' | 'mixed'

/**
 * 按鈕內 tags 的前綴一致性分類。決定三態翻轉的可表達性：
 * - all-positive：純正向 tag（無 prefix）
 * - all-negative：所有 tag 都 `-` prefix
 * - all-or：所有 tag 都 `~` prefix
 * - mixed：多種 prefix 混雜，三態翻轉無法用 e 站文法漂亮表達
 */
export function getButtonShape(tags: string[]): ButtonShape {
  if (!tags.length) return 'all-positive'
  const allPos = tags.every(t => !t.startsWith('-') && !t.startsWith('~'))
  if (allPos) return 'all-positive'
  const allNeg = tags.every(t => t.startsWith('-'))
  if (allNeg) return 'all-negative'
  const allOr = tags.every(t => t.startsWith('~'))
  if (allOr) return 'all-or'
  return 'mixed'
}

/**
 * Per-token state 轉換。**假設按鈕只有這一個 tag**（single-tag button context）。
 * 多 tag 按鈕的特殊翻轉（如 multi-neg 的 De Morgan）由 addTag 在按鈕層級處理。
 *
 * single-tag 翻轉規則：
 * - X    →  Include: X    | Or: ~X | Exclude: -X
 * - -X   →  Include: -X   | Or: -X (absorbed) | Exclude: X (雙否定)
 * - ~X   →  Include: ~X   | Or: ~X (維持) | Exclude: -X
 */
export function applyState(part: string, state: TagState): string {
  const neg = part.startsWith('-')
  const or = part.startsWith('~')
  if (state === TagState.Include) return part
  if (state === TagState.Or) return (neg || or) ? part : `~${part}`
  if (state === TagState.Exclude) {
    if (neg) return part.slice(1)         // -X → X (雙否定)
    if (or) return `-${part.slice(1)}`    // ~X → -X
    return `-${part}`                      // X → -X
  }
  return part
}

export function allForms(part: string): string[] {
  const p = normalizeNs(part)
  // 負 tag 可能以三種形式存在於 search：
  //   -X (Include / single-neg button assumes)
  //    X (雙否定 Exclude，single-neg button)
  //   ~X (De Morgan 形式，multi-neg button 的 Exclude）
  // 都得讓 removeTag 認得才能乾淨清理
  if (p.startsWith('-')) return [p, p.slice(1), `~${p.slice(1)}`]
  if (p.startsWith('~')) return [p, `-${p.slice(1)}`]
  return [p, `~${p}`, `-${p}`]
}

const _normSetCache = new WeakMap<Set<string>, Set<string>>()
function normSet(tokens: Set<string>): Set<string> {
  let norm = _normSetCache.get(tokens)
  if (norm) return norm
  norm = new Set([...tokens].map(normalizeNs))
  _normSetCache.set(tokens, norm)
  return norm
}

/**
 * Per-token state 偵測。**假設按鈕只有這一個 tag**（single-tag button context）。
 * 多 tag 按鈕的 De Morgan 形式由 getState 在按鈕層級處理。
 */
export function detectState(part: string, tokens: Set<string>): TagState | null {
  const nt = normSet(tokens)
  const p = normalizeNs(part)
  const neg = p.startsWith('-')
  const or = p.startsWith('~')
  const base = (neg || or) ? p.slice(1) : p
  if (neg) {
    // single-neg 按鈕：Exclude = 雙否定 = positive base
    if (nt.has(base)) return TagState.Exclude
    if (nt.has(p)) return TagState.Include
  } else if (or) {
    if (nt.has(`-${base}`)) return TagState.Exclude
    if (nt.has(p)) return TagState.Include
  } else {
    if (nt.has(`-${p}`)) return TagState.Exclude
    if (nt.has(`~${p}`)) return TagState.Or
    if (nt.has(p)) return TagState.Include
  }
  return null
}

export function getState(tags: string[], tokens: Set<string>): TagState {
  if (!tags.length) return TagState.Off
  const shape = getButtonShape(tags)

  // multi-neg 按鈕：Exclude 走 De Morgan，偵測 ~base 形式
  if (shape === 'all-negative' && tags.length >= 2) {
    const nt = normSet(tokens)
    const normTags = tags.map(normalizeNs)
    if (normTags.every(p => nt.has(p))) return TagState.Include
    if (normTags.every(p => nt.has(`~${p.slice(1)}`))) return TagState.Exclude
    return TagState.Off
  }

  // multi-or 按鈕：Exclude 走 De Morgan，偵測 -base 形式（每個 tag 的 Exclude = -base，
  // 跟 single-tag detectState 對 ~X 的 Exclude 一致，所以走預設路徑就行）
  // 其他形狀：每 tag 用 single-tag context 偵測，全 consistent 才算
  const [first, ...rest] = tags
  const state = detectState(first, tokens)
  if (state === null) return TagState.Off
  if (rest.every(p => detectState(p, tokens) === state)) return state
  return TagState.Off
}

export function removeTag(text: string, tags: string[]): string {
  const tokens = tokenize(text)
  const forms = new Set(tags.flatMap(allForms))
  return tokens.filter(t => !forms.has(normalizeNs(t))).join(' ')
}

export function addTag(text: string, tags: string[], state: TagState): string {
  const tokens = tokenize(text)
  const shape = getButtonShape(tags)

  // multi-neg + Exclude：De Morgan，每個 -X 翻成 ~X (OR group 形式)
  if (shape === 'all-negative' && tags.length >= 2 && state === TagState.Exclude) {
    for (const p of tags) {
      tokens.push(`~${p.slice(1)}`)
    }
  } else {
    for (const p of tags) {
      tokens.push(applyState(p, state))
    }
  }
  return tokens.join(' ')
}

const MODE_TO_STATE: Record<string, TagState> = { or: TagState.Or, exclude: TagState.Exclude }

/**
 * 哪些 modifier state 對這個按鈕**邏輯上能存在**。
 *
 * 規則（按 button shape）：
 * - all-positive (N=1)：Or ✓ Exclude ✓
 * - all-positive (N≥2)：Or ✓ Exclude ✗（嚴格 inverse 是 OR-of-negations，e站文法不支援）
 * - all-negative (任意 N)：Or ✗（OR-of-negations 不支援） Exclude ✓
 * - all-or (任意 N)：Or ✓（維持） Exclude ✓
 * - mixed：Or ✗ Exclude ✗（兩者嚴格 inverse 都含 `~-X` 等不合法形式）
 *
 * disabledModes 提供 user-level 覆蓋，可進一步強制禁用。
 */
export function getEffectiveModifiers(tags: string[], disabledModes?: readonly TagMode[]): TagState[] {
  const disabled = new Set((disabledModes ?? []).map(m => MODE_TO_STATE[m]))
  const shape = getButtonShape(tags)
  const count = tags.length

  const orAllowed = shape === 'all-positive' || shape === 'all-or'
  const excludeAllowed = shape === 'all-negative' ||
                         shape === 'all-or' ||
                         (shape === 'all-positive' && count === 1)

  const result: TagState[] = []
  if (orAllowed && !disabled.has(TagState.Or)) result.push(TagState.Or)
  if (excludeAllowed && !disabled.has(TagState.Exclude)) result.push(TagState.Exclude)
  return result
}

export function getNextRightClickState(tags: string[], disabledModes: readonly TagMode[] | undefined, currentState: TagState): TagState | null {
  const modifiers = getEffectiveModifiers(tags, disabledModes)
  if (!modifiers.length) return null

  if (currentState === TagState.Off || currentState === TagState.Include) {
    return modifiers[0]
  }
  const idx = modifiers.indexOf(currentState)
  if (idx === -1) return modifiers[0]
  return idx === modifiers.length - 1 ? TagState.Off : modifiers[idx + 1]
}
