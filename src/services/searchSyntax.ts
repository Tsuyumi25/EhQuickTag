// ---- types ----

export type Prefix = '-' | '~' | null
export type Suffix = '$' | '*' | '%' | null
export type Qualifier = 'tag' | 'weak' | 'title' | 'uploader' | 'uploaduid' | 'gid' | 'comment' | 'favnote'

export interface SearchToken {
  prefix: Prefix
  qualifier: Qualifier | null
  namespace: string | null
  namespaceRaw: string | null
  tag: string
  quoted: boolean
  suffix: Suffix
  raw: string
  parseError?: string
}

// ---- constants (duplicated from tagDb.ts to keep parser dependency-free) ----

const QUALIFIER_SET = new Set<string>([
  'tag', 'weak', 'title', 'uploader', 'uploaduid', 'gid', 'comment', 'favnote',
])

const NS_ALIASES: Record<string, string> = {
  r: 'reclass', g: 'group', a: 'artist', cos: 'cosplayer',
  p: 'parody', c: 'character', f: 'female', m: 'male',
  x: 'mixed', l: 'language', o: 'other', loc: 'location',
  char: 'character', circle: 'group', lang: 'language', series: 'parody',
}

const ALL_NS = new Set([
  'female', 'male', 'other', 'mixed', 'location',
  'parody', 'character', 'artist', 'cosplayer', 'group', 'language',
  'reclass', 'temp',
])

const NS_TO_SHORT: Record<string, string> = {}
for (const [short, full] of Object.entries(NS_ALIASES)) {
  // prefer shortest alias
  if (!NS_TO_SHORT[full] || short.length < NS_TO_SHORT[full].length) {
    NS_TO_SHORT[full] = short
  }
}

export { ALL_NS, NS_ALIASES, NS_TO_SHORT, QUALIFIER_SET }

// ---- scanner ----

function resolveColonPrefix(candidate: string): { qualifier: Qualifier | null; namespace: string | null; namespaceRaw: string | null } {
  const lower = candidate.toLowerCase()
  if (QUALIFIER_SET.has(lower)) {
    return { qualifier: lower as Qualifier, namespace: null, namespaceRaw: null }
  }
  if (ALL_NS.has(lower)) {
    return { qualifier: null, namespace: lower, namespaceRaw: candidate }
  }
  const resolved = NS_ALIASES[lower]
  if (resolved) {
    return { qualifier: null, namespace: resolved, namespaceRaw: candidate }
  }
  return { qualifier: null, namespace: null, namespaceRaw: null }
}

export function parseToken(raw: string): SearchToken {
  const token: SearchToken = {
    prefix: null, qualifier: null, namespace: null, namespaceRaw: null,
    tag: '', quoted: false, suffix: null, raw,
  }

  let pos = 0
  const input = raw
  const len = input.length

  function peek(): string { return pos < len ? input[pos] : '' }
  function advance(): string { return input[pos++] }

  // 1. prefix
  if (peek() === '-' || peek() === '~') {
    token.prefix = advance() as '-' | '~'
  }

  // 2. find colon — scan ahead to determine if there's a namespace/qualifier
  //    look for ':' before any '"' or end of string
  let colonIdx = -1
  for (let i = pos; i < len; i++) {
    if (input[i] === '"') break
    if (input[i] === ':') { colonIdx = i; break }
  }

  if (colonIdx >= 0 && colonIdx > pos) {
    const candidate = input.slice(pos, colonIdx)
    const resolved = resolveColonPrefix(candidate)

    if (resolved.qualifier || resolved.namespace) {
      token.qualifier = resolved.qualifier
      token.namespace = resolved.namespace
      token.namespaceRaw = resolved.namespaceRaw
      pos = colonIdx + 1 // skip past ':'
    }
    // else: unknown prefix before colon, treat whole thing as tag value
  }

  // 3. tag value — quoted or bare
  if (peek() === '"') {
    advance() // consume opening "
    let buf = ''
    while (pos < len && peek() !== '"') {
      buf += advance()
    }
    if (peek() === '"') advance() // consume closing "
    token.tag = buf
    token.quoted = true
  } else {
    // bare word — read until end; suffix chars at the very end will be stripped later
    let buf = ''
    while (pos < len) {
      buf += advance()
    }
    token.tag = buf
    token.quoted = false
  }

  // 4. suffix — check for trailing $, *, %
  //    Canonical form: suffix inside quotes ("big breasts$")
  //    Also handles legacy form: suffix after closing quote ("big breasts"$)
  if (token.quoted && token.tag.length > 0) {
    const lastChar = token.tag[token.tag.length - 1]
    if (lastChar === '$' || lastChar === '*' || lastChar === '%') {
      token.suffix = lastChar as Suffix
      token.tag = token.tag.slice(0, -1)
    }
  }
  if (pos < len) {
    // characters remain after quoted value (legacy suffix or unexpected chars)
    const remaining = input.slice(pos)
    const suffixChar = remaining[0]
    if (!token.suffix && (suffixChar === '$' || suffixChar === '*' || suffixChar === '%')) {
      token.suffix = suffixChar as Suffix
      pos++
    }
    if (pos < len) {
      token.parseError = `Unexpected characters after suffix: "${input.slice(pos)}"`
    }
  } else if (!token.quoted && token.tag.length > 0) {
    // for bare words, check if last char is a suffix
    const lastChar = token.tag[token.tag.length - 1]
    if (lastChar === '$' || lastChar === '*' || lastChar === '%') {
      token.suffix = lastChar as Suffix
      token.tag = token.tag.slice(0, -1)
    }
  }

  // 5. if we have no qualifier, no namespace, and colonIdx was found but not recognized,
  //    the colon is part of the tag itself — already handled since we didn't advance past it

  // edge case: empty tag after parsing
  if (!token.tag && !token.qualifier && !token.namespace && !token.parseError) {
    token.tag = raw
    token.parseError = 'Empty tag'
  }

  return token
}

export interface SerializeOptions {
  nsFormat?: 'long' | 'short'
}

export function serializeToken(token: SearchToken, opts?: SerializeOptions): string {
  // error tokens: emit raw for round-trip fidelity
  if (token.parseError && token.tag === token.raw) {
    return token.raw
  }

  let result = ''

  if (token.prefix) result += token.prefix

  if (token.qualifier) {
    result += token.qualifier + ':'
  } else if (token.namespace) {
    // prefer namespaceRaw (preserves user's long/short choice); fall back to opts
    let ns: string
    if (token.namespaceRaw) {
      ns = token.namespaceRaw
    } else {
      const format = opts?.nsFormat ?? 'long'
      ns = format === 'short'
        ? (NS_TO_SHORT[token.namespace] ?? token.namespace)
        : token.namespace
    }
    result += ns + ':'
  }

  const needsQuotes = token.quoted || token.tag.includes(' ')
  if (needsQuotes) {
    result += '"' + token.tag + (token.suffix ?? '') + '"'
  } else {
    result += token.tag
    if (token.suffix) result += token.suffix
  }

  return result
}

// ---- query-level functions ----

/** Tokenization regex shared with tagState.ts — handles quoted strings with spaces */
export const TOKEN_RE = /[^"\s]*"[^"]*"[^\s]*|[^\s"]+/g

export function parseQuery(input: string): SearchToken[] {
  const matches = input.match(TOKEN_RE)
  if (!matches) return []
  return matches.map(parseToken)
}

export function serializeQuery(tokens: SearchToken[], opts?: SerializeOptions): string {
  return tokens.map(t => serializeToken(t, opts)).join(' ')
}
