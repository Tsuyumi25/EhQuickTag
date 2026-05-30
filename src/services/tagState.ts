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

export function getState(tags: string[], tokens: Set<string>): TagState {
  const [first, ...rest] = tags
  if (!first) return TagState.Off

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
  for (const p of tags) {
    tokens.push(applyState(p, state))
  }
  return tokens.join(' ')
}

const MODE_TO_STATE: Record<string, TagState> = { or: TagState.Or, exclude: TagState.Exclude }

export function getEffectiveModifiers(tags: string[], disabledModes?: readonly TagMode[]): TagState[] {
  const disabled = new Set((disabledModes ?? []).map(m => MODE_TO_STATE[m]))
  const hasPrefix = tags.some(p => p.startsWith('-') || p.startsWith('~'))
  return [TagState.Or, TagState.Exclude]
    .filter(s => !disabled.has(s))
    .filter(s => !(hasPrefix && s === TagState.Or))
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
