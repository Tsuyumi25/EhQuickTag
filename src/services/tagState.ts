import { TagState, type QuickTag, splitMultiTag } from '@/types'

const TOKEN_RE = /[^"\s]*"[^"]*"[^\s]*|[^\s"]+/g

export function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
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
  if (part.startsWith('-')) return [part, part.slice(1)]
  if (part.startsWith('~')) return [part, `-${part.slice(1)}`]
  return [part, `~${part}`, `-${part}`]
}

export function detectState(part: string, tokens: Set<string>): TagState | null {
  const neg = part.startsWith('-')
  const or = part.startsWith('~')
  const base = (neg || or) ? part.slice(1) : part
  if (neg) {
    if (tokens.has(base)) return TagState.Exclude
    if (tokens.has(part)) return TagState.Include
  } else if (or) {
    if (tokens.has(`-${base}`)) return TagState.Exclude
    if (tokens.has(part)) return TagState.Include
  } else {
    if (tokens.has(`-${part}`)) return TagState.Exclude
    if (tokens.has(`~${part}`)) return TagState.Or
    if (tokens.has(part)) return TagState.Include
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
  return tokens.filter(t => !forms.has(t)).join(' ')
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
  return idx === -1 ? modifiers[0] : modifiers[(idx + 1) % modifiers.length]
}
