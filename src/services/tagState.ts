import { TagState, type QuickTag, splitMultiTag } from '@/types'
import { parseToken, serializeToken, TOKEN_RE } from './searchSyntax'

export function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

/** Normalize namespace to long form for comparison. Preserves prefix, suffix, quoting. */
const _nsCache = new Map<string, string>()
export function normalizeNs(tokenStr: string): string {
  let result = _nsCache.get(tokenStr)
  if (result !== undefined) return result
  const parsed = parseToken(tokenStr)
  // namespaceRaw: null forces serializeToken to use nsFormat fallback instead of preserving raw form
  result = parsed.parseError ? tokenStr : serializeToken({ ...parsed, namespaceRaw: null }, { nsFormat: 'long' })
  _nsCache.set(tokenStr, result)
  return result
}

export function applyState(part: string, state: TagState): string {
  const neg = part.startsWith('-')
  const or = part.startsWith('~')
  if (state === TagState.Include) return part
  if (state === TagState.Or) return (neg || or) ? part : `~${part}`
  if (state === TagState.Exclude) {
    if (neg) return part.slice(1)       // -foo → foo (double negative)
    if (or) return `-${part.slice(1)}`  // ~foo → -foo (negate underlying)
    return `-${part}`                    // foo → -foo
  }
  return part
}

export function allForms(part: string): string[] {
  const p = normalizeNs(part)
  if (p.startsWith('-')) return [p, p.slice(1)]
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

export function detectState(part: string, tokens: Set<string>): TagState | null {
  const nt = normSet(tokens)
  const p = normalizeNs(part)
  const neg = p.startsWith('-')
  const or = p.startsWith('~')
  const base = (neg || or) ? p.slice(1) : p
  if (neg) {
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

export function getState(tag: string, tokens: Set<string>): TagState {
  const [first, ...rest] = splitMultiTag(tag)
  if (!first) return TagState.Off

  const state = detectState(first, tokens)
  if (state === null) return TagState.Off
  if (rest.every(p => detectState(p, tokens) === state)) return state
  return TagState.Off
}

export function removeTag(text: string, tag: string): string {
  const tokens = tokenize(text)
  const forms = new Set(splitMultiTag(tag).flatMap(allForms))
  return tokens.filter(t => !forms.has(normalizeNs(t))).join(' ')
}

export function addTag(text: string, tag: string, state: TagState): string {
  const tokens = tokenize(text)
  for (const p of splitMultiTag(tag)) {
    tokens.push(applyState(p, state))
  }
  return tokens.join(' ')
}

const MODE_TO_STATE: Record<string, TagState> = { or: TagState.Or, exclude: TagState.Exclude }

export function getEffectiveModifiers(qt: QuickTag): TagState[] {
  const disabled = new Set((qt.disabledModes ?? []).map(m => MODE_TO_STATE[m]))
  const hasPrefix = splitMultiTag(qt.tag).some(p => p.startsWith('-') || p.startsWith('~'))
  return [TagState.Or, TagState.Exclude]
    .filter(s => !disabled.has(s))
    .filter(s => !(hasPrefix && s === TagState.Or))
}

export function getNextRightClickState(qt: QuickTag, currentState: TagState): TagState | null {
  const modifiers = getEffectiveModifiers(qt)
  if (!modifiers.length) return null

  if (currentState === TagState.Off || currentState === TagState.Include) {
    return modifiers[0]
  }
  const idx = modifiers.indexOf(currentState)
  if (idx === -1) return modifiers[0]
  return idx === modifiers.length - 1 ? TagState.Off : modifiers[idx + 1]
}
