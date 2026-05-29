import { nextTick, type Ref } from 'vue'
import {
  parseTerm, serializeTerm,
  NS_TO_SHORT,
  type SearchTerm, type Prefix, type Suffix, type Qualifier,
} from '@/services/searchSyntax'
import { t } from '@/composables/useI18n'

// === RowState：每一筆 term 編輯器的狀態容器 ===
// 由 TagConfigPopup 建立陣列、各 SearchTermEditor 接管自己這筆。
// token 是結構化資料、rawText 是字串顯示，hook 內負責雙向同步。
export interface RowState {
  id: symbol
  token: SearchTerm
  rawText: string
  undoStack: string[]
  redoStack: string[]
}

export function makeRow(raw: string): RowState {
  return {
    id: Symbol(),
    token: parseTerm(raw),
    rawText: raw,
    undoStack: [],
    redoStack: [],
  }
}

// === file-private contenteditable 黑魔法 ===

function getCursorOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return 0
  const range = sel.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
  return range.toString().length
}

function setCursorOffset(el: HTMLElement, offset: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  let remaining = offset
  let lastNode: Node | null = null
  let lastLen = 0

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      lastNode = node
      lastLen = len
      if (remaining <= len) {
        range.setStart(node, remaining)
        range.collapse(true)
        return true
      }
      remaining -= len
      return false
    }
    for (const child of node.childNodes) {
      if (walk(child)) return true
    }
    return false
  }

  if (!walk(el) && lastNode) {
    range.setStart(lastNode, lastLen)
    range.collapse(true)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

const EXPLAIN_CLASSES: Record<string, string> = {
  prefix: 'eqt-explain--prefix',
  ns: 'eqt-explain--ns',
  qualifier: 'eqt-explain--qualifier',
  tag: 'eqt-explain--tag',
  suffix: 'eqt-explain--suffix',
  error: 'eqt-explain--error',
  punct: 'eqt-explain--punct',
}

interface ExplainSegment { text: string; cls: string; label: string }

function buildExplain(token: SearchTerm): ExplainSegment[] {
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

function renderHighlight(el: HTMLElement, row: RowState): void {
  if (!row.rawText) {
    el.innerHTML = ''
    return
  }

  let segs = buildExplain(row.token)
  // 重組後若跟 rawText 對不起來（解析誤差），退回 raw 顯示避免文字消失
  const reconstructed = segs.map(s => s.text).join('')
  if (reconstructed !== row.rawText.trim()) {
    segs = [{ text: row.rawText, cls: EXPLAIN_CLASSES.tag, label: '' }]
  }

  const isFocused = document.activeElement === el
  const offset = isFocused ? getCursorOffset(el) : 0
  el.innerHTML = ''
  for (const seg of segs) {
    const span = document.createElement('span')
    span.className = seg.cls
    if (seg.label) span.title = seg.label
    span.textContent = seg.text
    el.appendChild(span)
  }
  if (isFocused) setCursorOffset(el, offset)
}

export function cyclePrefix(current: Prefix): Prefix {
  if (current === null) return '-'
  if (current === '-') return '~'
  return null
}

function cycleSuffix(current: Suffix): Suffix {
  if (current === null) return '$'
  if (current === '$') return '*'
  return null
}

export const nsToShort = (ns: string): string | undefined => NS_TO_SHORT[ns] as string | undefined

// === main hook ===
// rawEl 由 caller 透過 template ref 提供。hook 內負責所有 token ↔ rawText 同步、
// undo/redo、highlight render、structured field setter。
export function useSearchTerm(
  row: RowState,
  rawEl: Ref<HTMLElement | null>,
  options: {
    defaultExactMatch?: boolean
    nsFormat?: 'long' | 'short'
  } = {},
) {
  let syncing = false

  function refreshHighlight(): void {
    nextTick(() => {
      if (rawEl.value) renderHighlight(rawEl.value, row)
    })
  }

  function updateFromStructured(): void {
    if (syncing) return
    syncing = true
    row.rawText = serializeTerm(row.token)
    syncing = false
    refreshHighlight()
  }

  function updateFromRaw(text: string): void {
    if (syncing) return
    row.undoStack.push(row.rawText)
    row.redoStack.length = 0
    syncing = true
    row.rawText = text
    row.token = parseTerm(text.trim())
    syncing = false
    refreshHighlight()
  }

  function applyText(text: string): void {
    syncing = true
    row.rawText = text
    row.token = parseTerm(text.trim())
    syncing = false
    refreshHighlight()
    nextTick(() => {
      if (rawEl.value) setCursorOffset(rawEl.value, text.length)
    })
  }

  function undo(): void {
    if (!row.undoStack.length) return
    row.redoStack.push(row.rawText)
    applyText(row.undoStack.pop()!)
  }

  function redo(): void {
    if (!row.redoStack.length) return
    row.undoStack.push(row.rawText)
    applyText(row.redoStack.pop()!)
  }

  function rowPrefersShort(): boolean {
    return row.token.namespace && row.token.namespaceRaw
      ? row.token.namespaceRaw !== row.token.namespace
      : (options.nsFormat ?? 'long') === 'short'
  }

  function setPrefix(prefix: Prefix): void {
    row.token.prefix = prefix
    updateFromStructured()
  }

  function setColonPrefix(value: string): void {
    if (!value) {
      row.token.qualifier = null
      row.token.namespace = null
      row.token.namespaceRaw = null
    } else if (value.startsWith('q:')) {
      const q = value.slice(2)
      row.token.qualifier = q as Qualifier
      row.token.namespace = null
      row.token.namespaceRaw = null
    } else if (value.startsWith('ns:')) {
      const ns = value.slice(3)
      const prefersShort = rowPrefersShort()
      row.token.qualifier = null
      row.token.namespace = ns
      row.token.namespaceRaw = prefersShort ? (nsToShort(ns) ?? ns) : ns
    }
    updateFromStructured()
  }

  function setTagValue(value: string): void {
    row.token.tag = value
    row.token.quoted = value.includes(' ')
    updateFromStructured()
  }

  function onCycleSuffix(): void {
    row.token.suffix = cycleSuffix(row.token.suffix)
    updateFromStructured()
  }

  function cycleNsFormat(): void {
    if (!row.token.namespace) return
    const ns = row.token.namespace
    const short = nsToShort(ns)
    if (!short) return
    row.token.namespaceRaw = row.token.namespaceRaw === ns ? short : ns
    updateFromStructured()
  }

  function getNsFormatLabel(): string {
    if (!row.token.namespace) return ''
    const short = nsToShort(row.token.namespace)
    if (!short) return '-'
    return row.token.namespaceRaw === row.token.namespace
      ? t('settings.nsFormatLong')
      : t('settings.nsFormatShort')
  }

  function getColonPrefixValue(): string {
    if (row.token.qualifier) return `q:${row.token.qualifier}`
    if (row.token.namespace) return `ns:${row.token.namespace}`
    return ''
  }

  function applySuggestionPick(entry: { ns: string; raw: string }): void {
    const prefersShort = rowPrefersShort()
    row.token.namespace = entry.ns
    row.token.namespaceRaw = prefersShort ? (nsToShort(entry.ns) ?? entry.ns) : entry.ns
    row.token.qualifier = null
    row.token.tag = entry.raw
    row.token.quoted = entry.raw.includes(' ')
    if (row.token.suffix === null && (options.defaultExactMatch ?? true)) {
      row.token.suffix = '$'
    }
    updateFromStructured()
  }

  return {
    refreshHighlight,
    updateFromRaw,
    undo,
    redo,
    setPrefix,
    setColonPrefix,
    setTagValue,
    onCycleSuffix,
    cycleNsFormat,
    getNsFormatLabel,
    getColonPrefixValue,
    applySuggestionPick,
  }
}
