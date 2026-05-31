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

/**
 * 此 state 是否邏輯上能在此 shape + tag 數量下存在。
 * shape-level 規則的單一真理來源——getState（防偵測撒謊）、getEffectiveModifiers
 * （UI cycle 限制）、TagConfigPopup（chip 啟用判斷）都從這裡讀，避免規則漂移。
 *
 * 規則架構（單層 + 一致性）：
 *   Exclude / Or 統一定義為 Include 集合的嚴格補集（de Morgan inverse）。
 *   當補集寫成 e站文法必須含 `~-X` 或 `-~X`（兩者皆不合法），該態禁用。
 *
 * 不接受 per-tag 翻轉（symbol flip）作為補集 fallback——那會把 multi-tag 按鈕
 * 的「視覺撒謊 bug」加回來（per-tag 翻轉抓到的是另一個小集合，不是補集）。
 * 例如 mixed [A, -B] 的 per-tag 翻轉 -A B 是 ¬A ∩ B，並非補集 ¬A ∪ B。
 *
 * Include 永遠允許（所有 shape 的左鍵預設態）。
 * 禁用 case（全部來自上面那一條規則）：
 *   - all-positive (N≥2) 的 Exclude：補集 `~-X1 ~-X2` 不合法
 *   - all-negative 的 Or：補集 `~-X` 不合法
 *   - mixed 的 Or / Exclude：補集都含 `~-X` 不合法
 *
 * 採 fail-fast：禁用該態，UI 文案引導用戶拆按鈕。詳見 tagConfig.cycleSkipReason*
 * 系列 i18n key。
 */
export function isStateShapeAllowed(shape: ButtonShape, count: number, state: TagState): boolean {
  if (state === TagState.Include) return true
  if (state === TagState.Or) {
    return shape === 'all-positive' || shape === 'all-or'
  }
  if (state === TagState.Exclude) {
    return shape === 'all-negative' ||
           shape === 'all-or' ||
           (shape === 'all-positive' && count === 1)
  }
  return false
}

export function getState(tags: string[], tokens: Set<string>): TagState {
  if (!tags.length) return TagState.Off
  const shape = getButtonShape(tags)
  const count = tags.length

  // multi-neg 按鈕：Exclude 走 De Morgan，偵測 ~base 形式
  if (shape === 'all-negative' && count >= 2) {
    const nt = normSet(tokens)
    const normTags = tags.map(normalizeNs)
    if (normTags.every(p => nt.has(p))) return TagState.Include
    if (normTags.every(p => nt.has(`~${p.slice(1)}`))) return TagState.Exclude
    return TagState.Off
  }

  // 其他形狀：每 tag 用 single-tag context 偵測，全 consistent 才算
  const [first, ...rest] = tags
  const state = detectState(first, tokens)
  if (state === null) return TagState.Off
  if (!rest.every(p => detectState(p, tokens) === state)) return TagState.Off

  // shape-level 防撒謊：mixed / multi-positive 按 token 湊出 Exclude / Or 形式時，
  // detectState 全 consistent 但此 state 的嚴格補集在 shape 規則上禁用（補集寫不出來，
  // 詳見 isStateShapeAllowed）——視為 Off，避免 search 欄偶然湊到反向 token（per-tag
  // 翻轉等等）時把按鈕亮成 Exclude 之類的視覺謊言。
  if (!isStateShapeAllowed(shape, count, state)) return TagState.Off

  return state
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
 * 共用 isStateShapeAllowed 推導——shape-level 規則的細節跟禁用理由詳見那裡。
 *
 * 規則速查：
 * - all-positive (N=1)：Or ✓ Exclude ✓
 * - all-positive (N≥2)：Or ✓ Exclude ✗
 * - all-negative (任意 N)：Or ✗ Exclude ✓
 * - all-or (任意 N)：Or ✓ Exclude ✓
 * - mixed：Or ✗ Exclude ✗
 *
 * disabledModes 提供 user-level 覆蓋，可進一步強制禁用。
 */
export function getEffectiveModifiers(tags: string[], disabledModes?: readonly TagMode[]): TagState[] {
  const disabled = new Set((disabledModes ?? []).map(m => MODE_TO_STATE[m]))
  const shape = getButtonShape(tags)
  const count = tags.length

  const result: TagState[] = []
  if (isStateShapeAllowed(shape, count, TagState.Or) && !disabled.has(TagState.Or)) {
    result.push(TagState.Or)
  }
  if (isStateShapeAllowed(shape, count, TagState.Exclude) && !disabled.has(TagState.Exclude)) {
    result.push(TagState.Exclude)
  }
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
