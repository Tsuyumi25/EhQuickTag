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

/**
 * Token 的「身份」= 它指向的 (qualifier, namespace, tag) tuple，剝掉前綴
 * `-` / `~` 跟後綴 `$` / `*` / `%`。
 *
 * 模型：search 欄裡同 identity 的 token 只能有一個。點按鈕 = 該按鈕**搶下**
 * 它管轄的身份戳，把舊的踢出去蓋上自己的 view（前綴 + 後綴）。
 *
 * 為什麼 `$` 也不入身份：實務上使用者不會同時想要「精確 chinese$」跟
 * 「模糊 chinese」並存——點按鈕的心智模型是 update / replace，不是 coexist。
 * 後綴是「我這次想用什麼比對方式」的 view，跟前綴一樣由最後點的按鈕決定。
 *
 * 大小寫：tag 部分 lowercase 化，容錯 e站不同來源產生的大小寫差異。
 * parseError 的 token 回 null（不屬於任何身份，removeTag 不會誤刪、
 * getState 也不會誤判）。
 */
const _identityCache = new Map<string, string | null>()
export function tokenIdentity(tokenStr: string): string | null {
  if (_identityCache.has(tokenStr)) return _identityCache.get(tokenStr)!
  const parsed = parseTerm(tokenStr)
  let result: string | null
  if (parsed.parseError) {
    result = null
  } else {
    const q = parsed.qualifier ?? ''
    const ns = parsed.namespace ?? ''
    const tag = parsed.tag.toLowerCase()
    result = `${q}|${ns}|${tag}`
  }
  _identityCache.set(tokenStr, result)
  return result
}

export type ButtonShape =
  | 'empty'
  | 'positive-single'
  | 'positive-multi'
  | 'negative-single'
  | 'negative-multi'
  | 'all-or'
  | 'mixed'

/**
 * 按鈕內 tags 的前綴一致性 + 數量分類。
 * 規則細節跟禁用理由詳見 isStateShapeAllowed。
 */
export function getButtonShape(tags: string[]): ButtonShape {
  if (!tags.length) return 'empty'
  const allPos = tags.every(t => !t.startsWith('-') && !t.startsWith('~'))
  if (allPos) return tags.length === 1 ? 'positive-single' : 'positive-multi'
  const allNeg = tags.every(t => t.startsWith('-'))
  if (allNeg) return tags.length === 1 ? 'negative-single' : 'negative-multi'
  const allOr = tags.every(t => t.startsWith('~'))
  if (allOr) return 'all-or'
  return 'mixed'
}

/**
 * Per-token state 轉換。**假設按鈕只有這一個 tag**。多 tag 按鈕的特殊翻轉
 * （如 multi-neg 的 De Morgan）由 computeEmission / addTag 在按鈕層級處理。
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
    if (neg) return part.slice(1)
    if (or) return `-${part.slice(1)}`
    return `-${part}`
  }
  return part
}

/**
 * 此 state 是否邏輯上能在此 shape 下存在。
 *
 * 規則架構（單層 + 一致性）：
 *   Exclude / Or 統一定義為 Include 集合的嚴格補集（de Morgan inverse）。
 *   當補集寫成 e站文法必須含 `~-X` 或 `-~X`（兩者皆不合法），該態禁用。
 *
 * 禁用 case：
 *   - empty：沒 tag
 *   - positive-multi 的 Exclude：補集 `~-X1 ~-X2` 不合法
 *   - negative-* 的 Or：補集 `~-X` 不合法
 *   - all-or 的 Or：`~X` 在 Or 態下跟 Include 同 token 形式，無 distinct view
 *   - mixed 的 Or / Exclude：補集都含 `~-X` 不合法
 */
export function isStateShapeAllowed(shape: ButtonShape, state: TagState): boolean {
  if (state === TagState.Include) return true
  if (state === TagState.Or) {
    return shape === 'positive-single' || shape === 'positive-multi'
  }
  if (state === TagState.Exclude) {
    return shape === 'positive-single' ||
           shape === 'negative-single' ||
           shape === 'negative-multi' ||
           shape === 'all-or'
  }
  return false
}

/**
 * 按鈕在 state X 下會 emit 的 token list（raw 形式，保留 user button tag 的
 * ns format / 引號等等）。
 *
 * 共用給：
 *   - addTag：直接 push 到 search 尾巴
 *   - setTagState：in-place 替換同身份 token、剩下補尾巴
 *   - computeEmission：normalize 後給 getState 做身份比對
 */
function rawEmission(tags: string[], shape: ButtonShape, state: TagState): string[] {
  if (shape === 'negative-multi' && state === TagState.Exclude) {
    return tags.map(p => `~${p.slice(1)}`)
  }
  return tags.map(p => applyState(p, state))
}

function computeEmission(tags: string[], shape: ButtonShape, state: TagState): string[] {
  return rawEmission(tags, shape, state).map(normalizeNs)
}

/**
 * 把 search 的 tokens 依身份索引。重複身份視為 ambiguous（map value = null），
 * 任何 emission 對它都 match 失敗 → 那個身份「壞了」，按鈕只能回 Off。
 *
 * 純函數。呼叫端應在 input 不變的範圍內 memo 結果並共用，避免熱路徑重建。
 */
export function buildIdentityIndex(tokens: Iterable<string>): Map<string, string | null> {
  const map = new Map<string, string | null>()
  for (const t of tokens) {
    const id = tokenIdentity(t)
    if (!id) continue
    const norm = normalizeNs(t)
    const existing = map.get(id)
    if (existing === undefined) {
      map.set(id, norm)
    } else if (existing !== norm) {
      map.set(id, null)
    }
  }
  return map
}

/**
 * 偵測按鈕的當前 state——「身份完整檢查」。
 *
 * 對 shape 允許的每個 state 依序試：computeEmission 算出該 state 應該在
 * search 出現的 token 集合，逐個跟 identity index 比對，全 match 就是該
 * state。試完都 fail 回 Off。
 *
 * 順序 Exclude → Or → Include 是 defensive ordering：emission 集合在
 * isStateShapeAllowed 規則下不會重疊（每 state 用不同前綴），但若搜尋
 * 欄被外力弄成詭異狀態，較強的 state 優先勝出比較直覺。
 */
export function getState(tags: string[], identityIndex: Map<string, string | null>): TagState {
  if (!tags.length) return TagState.Off
  const shape = getButtonShape(tags)
  if (shape === 'empty') return TagState.Off

  const candidates: TagState[] = [TagState.Exclude, TagState.Or, TagState.Include]
  for (const state of candidates) {
    if (!isStateShapeAllowed(shape, state)) continue
    const expected = computeEmission(tags, shape, state)
    const allMatch = expected.every(e => {
      const id = tokenIdentity(e)
      if (!id) return false
      return identityIndex.get(id) === e
    })
    if (allMatch) return state
  }
  return TagState.Off
}

/**
 * 把按鈕管轄的所有身份從 search 踢出。**身份 = ns:tag**，不管 token 前綴後綴：
 * 不論 search 裡是 `~chinese$` / `-chinese$` / `language:chinese`，只要身份
 * 是 `language:chinese`，都被驅逐。
 *
 * 這個是「update / replace」心智模型的核心：點按鈕 = 該按鈕宣告它要當這些
 * 身份的當家，舊住戶不論態度（include/or/exclude）一律請走，再蓋上自己的 view。
 */
export function removeTag(text: string, tags: string[]): string {
  if (!tags.length) return text
  const identities = new Set<string>()
  for (const t of tags) {
    const id = tokenIdentity(t)
    if (id) identities.add(id)
  }
  if (!identities.size) return text
  return tokenize(text)
    .filter(t => {
      const id = tokenIdentity(t)
      return !id || !identities.has(id)
    })
    .join(' ')
}

export function addTag(text: string, tags: string[], state: TagState): string {
  const tokens = tokenize(text)
  const shape = getButtonShape(tags)
  for (const t of rawEmission(tags, shape, state)) tokens.push(t)
  return tokens.join(' ')
}

/**
 * 把按鈕 set 到指定 state，**位置守恆 in-place 替換**：
 *   - search 裡已有同身份的 token → 原地換成新 emission view（位置不變）
 *   - search 裡沒有的身份 → emission 補在尾巴
 *   - state === Off → 等同 removeTag（只驅逐沒蓋新的）
 *
 * 用途：取代 `removeTag + addTag` 兩步驟組合。後者會讓 token 在 search bar
 * 裡跳位（既存的順位往前擠、新的加在尾巴），位置守恆對 user 比較友善。
 *
 * 重複身份的 search token（罕見、通常是手動編輯產生）：第一個 in-place 替換、
 * 後續同身份的 token 直接丟掉（順帶把身份唯一性 invariant 修好）。
 */
export function setTagState(text: string, tags: string[], state: TagState): string {
  if (!tags.length) return text
  if (state === TagState.Off) return removeTag(text, tags)

  const shape = getButtonShape(tags)
  const emission = rawEmission(tags, shape, state)
  const emissionByIdentity = new Map<string, string>()
  for (const e of emission) {
    const id = tokenIdentity(e)
    if (id) emissionByIdentity.set(id, e)
  }

  const tokens = tokenize(text)
  const placed = new Set<string>()
  const result: string[] = []
  for (const t of tokens) {
    const id = tokenIdentity(t)
    if (id && emissionByIdentity.has(id)) {
      if (!placed.has(id)) {
        result.push(emissionByIdentity.get(id)!)
        placed.add(id)
      }
      // duplicate identity in search → drop (順帶修 invariant)
    } else {
      result.push(t)
    }
  }
  for (const [id, e] of emissionByIdentity) {
    if (!placed.has(id)) result.push(e)
  }
  return result.join(' ')
}

const MODE_TO_STATE: Record<string, TagState> = { or: TagState.Or, exclude: TagState.Exclude }

/**
 * 哪些 modifier state 對這個按鈕**邏輯上能存在**。
 *
 * 規則速查：
 * - empty：兩態皆 ✗
 * - positive-single：Or ✓ Exclude ✓
 * - positive-multi：Or ✓ Exclude ✗
 * - negative-single / negative-multi：Or ✗ Exclude ✓
 * - all-or：Or ✗ Exclude ✓
 * - mixed：Or ✗ Exclude ✗
 *
 * disabledModes 提供 user-level 覆蓋。
 */
export function getEffectiveModifiers(tags: string[], disabledModes?: readonly TagMode[]): TagState[] {
  const disabled = new Set((disabledModes ?? []).map(m => MODE_TO_STATE[m]))
  const shape = getButtonShape(tags)
  const result: TagState[] = []
  if (isStateShapeAllowed(shape, TagState.Or) && !disabled.has(TagState.Or)) {
    result.push(TagState.Or)
  }
  if (isStateShapeAllowed(shape, TagState.Exclude) && !disabled.has(TagState.Exclude)) {
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
