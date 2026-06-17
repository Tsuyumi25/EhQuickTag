import { parseTerm, serializeTerm, NS_TO_SHORT } from './searchSyntax'
import type { SearchTerm, Prefix, Suffix, Qualifier } from './searchSyntax'

// === useSearchTerm composable 的純函數層 ===
//
// 所有 token 轉換邏輯都在這——SearchTerm → 新 SearchTerm（immutable style）。
// 不依賴 vue / DOM。useSearchTerm 內部負責呼叫這些 + 接 Vue 排程 + DOM 渲染。

// === parse / serialize 薄包裝（同名 re-export 順便補空白 trim 慣例）===

export function parseRawText(text: string): SearchTerm {
  return parseTerm(text.trim())
}

export function serializeToken(token: SearchTerm): string {
  return serializeTerm(token)
}

// === cycle 函式（已純）===

export function cyclePrefix(current: Prefix): Prefix {
  if (current === null) return '-'
  if (current === '-') return '~'
  return null
}

export function cycleSuffix(current: Suffix): Suffix {
  if (current === null) return '$'
  if (current === '$') return '*'
  return null
}

export const nsToShort = (ns: string): string | undefined => NS_TO_SHORT[ns] as string | undefined

// === SearchTerm transform（all return new token，不 mutate input）===

/**
 * 判斷 row 該採用 short 或 long 命名空間表記。
 * 既有 namespaceRaw 不同於 namespace（顯式短碼）→ short；否則 fallback default。
 */
export function rowPrefersShort(token: SearchTerm, defaultNsFormat: 'long' | 'short' = 'long'): boolean {
  return token.namespace && token.namespaceRaw
    ? token.namespaceRaw !== token.namespace
    : defaultNsFormat === 'short'
}

export function applyPrefix(token: SearchTerm, prefix: Prefix): SearchTerm {
  return { ...token, prefix }
}

/**
 * Colon select 變動：分 q:xxx / ns:xxx / 空 三條路徑。
 * 對 ns 路徑用 rowPrefersShort 推導 namespaceRaw（短碼 vs 長碼）。
 */
export function applyColonPrefix(
  token: SearchTerm,
  value: string,
  defaultNsFormat: 'long' | 'short' = 'long',
): SearchTerm {
  if (!value) {
    return { ...token, qualifier: null, namespace: null, namespaceRaw: null }
  }
  if (value.startsWith('q:')) {
    return {
      ...token,
      qualifier: value.slice(2) as Qualifier,
      namespace: null,
      namespaceRaw: null,
    }
  }
  if (value.startsWith('ns:')) {
    const ns = value.slice(3)
    const prefersShort = rowPrefersShort(token, defaultNsFormat)
    return {
      ...token,
      qualifier: null,
      namespace: ns,
      namespaceRaw: prefersShort ? (nsToShort(ns) ?? ns) : ns,
    }
  }
  return token
}

export function applyTagValue(token: SearchTerm, value: string): SearchTerm {
  return { ...token, tag: value, quoted: value.includes(' ') }
}

export function applyCycleSuffix(token: SearchTerm): SearchTerm {
  return { ...token, suffix: cycleSuffix(token.suffix) }
}

export function applyCycleNsFormat(token: SearchTerm): SearchTerm {
  if (!token.namespace) return token
  const ns = token.namespace
  const short = nsToShort(ns)
  if (!short) return token
  return { ...token, namespaceRaw: token.namespaceRaw === ns ? short : ns }
}

export interface SuggestionEntry { ns: string; raw: string }

export interface SuggestionPickOptions {
  defaultExactMatch?: boolean
  defaultNsFormat?: 'long' | 'short'
}

export function applySuggestionPick(
  token: SearchTerm,
  entry: SuggestionEntry,
  options: SuggestionPickOptions = {},
): SearchTerm {
  const prefersShort = rowPrefersShort(token, options.defaultNsFormat ?? 'long')
  return {
    ...token,
    namespace: entry.ns,
    namespaceRaw: prefersShort ? (nsToShort(entry.ns) ?? entry.ns) : entry.ns,
    qualifier: null,
    tag: entry.raw,
    quoted: entry.raw.includes(' '),
    suffix: token.suffix === null && (options.defaultExactMatch ?? true) ? '$' : token.suffix,
  }
}

// === 讀取性質純函數 ===

export function getColonPrefixValue(token: SearchTerm): string {
  if (token.qualifier) return `q:${token.qualifier}`
  if (token.namespace) return `ns:${token.namespace}`
  return ''
}

/**
 * 取 ns format 切換按鈕的 label。需要 i18n t 函數注入。
 */
export function getNsFormatLabel(
  token: SearchTerm,
  t: (key: string) => string,
): string {
  if (!token.namespace) return ''
  const short = nsToShort(token.namespace)
  if (!short) return '-'
  return token.namespaceRaw === token.namespace
    ? t('settings.nsFormatLong')
    : t('settings.nsFormatShort')
}

// === Explain segments（純函數，i18n t 注入）===

export interface ExplainSegment { text: string; cls: string; label: string }

export const EXPLAIN_CLASSES = {
  prefix: 'eqt-explain--prefix',
  ns: 'eqt-explain--ns',
  qualifier: 'eqt-explain--qualifier',
  tag: 'eqt-explain--tag',
  suffix: 'eqt-explain--suffix',
  error: 'eqt-explain--error',
  punct: 'eqt-explain--punct',
} as const

export function buildExplain(token: SearchTerm, t: (key: string) => string): ExplainSegment[] {
  if (token.parseError && token.tag === token.raw) {
    return [{ text: token.raw, cls: EXPLAIN_CLASSES.error, label: t('tagConfig.explainError') }]
  }

  const segs: ExplainSegment[] = []
  if (token.prefix) {
    segs.push({ text: token.prefix, cls: EXPLAIN_CLASSES.prefix, label: t('tagConfig.explainPrefix') })
  }
  if (token.qualifier) {
    segs.push({ text: token.qualifier, cls: EXPLAIN_CLASSES.qualifier, label: t('tagConfig.explainQualifier') })
    segs.push({ text: ':', cls: EXPLAIN_CLASSES.punct, label: '' })
  } else if (token.namespace) {
    const nsDisplay = token.namespaceRaw ?? token.namespace
    segs.push({ text: nsDisplay, cls: EXPLAIN_CLASSES.ns, label: t('tagConfig.explainNs') })
    segs.push({ text: ':', cls: EXPLAIN_CLASSES.punct, label: '' })
  }
  const needsQuotes = token.tag.includes(' ')
  if (needsQuotes) {
    segs.push({ text: '"', cls: EXPLAIN_CLASSES.punct, label: '' })
    segs.push({ text: token.tag, cls: EXPLAIN_CLASSES.tag, label: t('tagConfig.explainTag') })
    if (token.suffix) {
      segs.push({ text: token.suffix, cls: EXPLAIN_CLASSES.suffix, label: t('tagConfig.explainSuffix') })
    }
    segs.push({ text: '"', cls: EXPLAIN_CLASSES.punct, label: '' })
  } else if (token.tag) {
    segs.push({ text: token.tag, cls: EXPLAIN_CLASSES.tag, label: t('tagConfig.explainTag') })
    if (token.suffix) {
      segs.push({ text: token.suffix, cls: EXPLAIN_CLASSES.suffix, label: t('tagConfig.explainSuffix') })
    }
  }
  return segs
}
