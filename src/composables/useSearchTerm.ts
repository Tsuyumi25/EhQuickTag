import { nextTick, type Ref } from 'vue'
import type { SearchTerm } from '@/services/searchSyntax'
import {
  parseRawText, serializeToken,
  applyPrefix, applyColonPrefix, applyTagValue,
  applyCycleSuffix, applyCycleNsFormat, applySuggestionPick,
  buildExplain, getColonPrefixValue, getNsFormatLabel,
  EXPLAIN_CLASSES,
  type SuggestionEntry,
} from '@/services/searchTermState'
import type { Prefix } from '@/services/searchSyntax'
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
    token: parseRawText(raw),
    rawText: raw,
    undoStack: [],
    redoStack: [],
  }
}

export { cyclePrefix, nsToShort } from '@/services/searchTermState'

// === file-private contenteditable DOM 操作 ===

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

function renderHighlight(el: HTMLElement, row: RowState): void {
  if (!row.rawText) {
    el.innerHTML = ''
    return
  }

  let segs = buildExplain(row.token, t)
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

// === main hook ===
// rawEl 由 caller 透過 template ref 提供。hook 內負責 token ↔ rawText 同步、
// undo/redo、highlight render 排程、structured field setter。

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
    row.rawText = serializeToken(row.token)
    syncing = false
    refreshHighlight()
  }

  function updateFromRaw(text: string): void {
    if (syncing) return
    row.undoStack.push(row.rawText)
    row.redoStack.length = 0
    syncing = true
    row.rawText = text
    row.token = parseRawText(text)
    syncing = false
    refreshHighlight()
  }

  function applyText(text: string): void {
    syncing = true
    row.rawText = text
    row.token = parseRawText(text)
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

  const nsFormat = options.nsFormat ?? 'long'
  const suggestionOpts = {
    defaultExactMatch: options.defaultExactMatch,
    defaultNsFormat: nsFormat,
  }

  function setPrefix(prefix: Prefix): void {
    row.token = applyPrefix(row.token, prefix)
    updateFromStructured()
  }

  function setColonPrefix(value: string): void {
    row.token = applyColonPrefix(row.token, value, nsFormat)
    updateFromStructured()
  }

  function setTagValue(value: string): void {
    row.token = applyTagValue(row.token, value)
    updateFromStructured()
  }

  function onCycleSuffix(): void {
    row.token = applyCycleSuffix(row.token)
    updateFromStructured()
  }

  function cycleNsFormat(): void {
    row.token = applyCycleNsFormat(row.token)
    updateFromStructured()
  }

  function applyPickSuggestion(entry: SuggestionEntry): void {
    row.token = applySuggestionPick(row.token, entry, suggestionOpts)
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
    getNsFormatLabel: () => getNsFormatLabel(row.token, t),
    getColonPrefixValue: () => getColonPrefixValue(row.token),
    applySuggestionPick: applyPickSuggestion,
  }
}
