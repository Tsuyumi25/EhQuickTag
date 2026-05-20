<script setup lang="ts">
import { reactive, ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import { type QuickTag, type TagMode, splitMultiTag } from '@/types'
import { t, isCJKLocale } from '@/composables/useI18n'
import { loadTagDb, searchTags, type TagEntry, ALL_NAMESPACES } from '@/services/tagDb'
import { loadNhPopularity } from '@/services/nhPopularity'
import {
  parseToken, serializeToken, type SearchToken, type Prefix, type Suffix, type Qualifier,
  NS_TO_SHORT, QUALIFIER_SET,
} from '@/services/searchSyntax'

const props = defineProps<{
  tag: QuickTag
  isAdd?: boolean
  useNhWeight?: boolean
  nsOrder?: string[]
  nsFormat?: 'long' | 'short'
  defaultExactMatch?: boolean
}>()

const emit = defineEmits<{
  'save': [value: QuickTag]
  'delete': []
  'close': []
}>()

// --- state ---

interface RowState {
  id: symbol
  token: SearchToken
  rawText: string
  suggestions: TagEntry[]
  selectedIdx: number
}

const label = ref('')
const rows = reactive<RowState[]>([])
const tagInputRefs = ref<HTMLInputElement[]>([])
const dbReady = ref(false)
const orEnabled = ref(true)
const excludeEnabled = ref(true)
const activeRow = ref(-1)

// --- init from props ---

watch(() => props.tag, (t) => {
  label.value = t.label ?? ''
  const parts = t.tag ? splitMultiTag(t.tag) : []
  rows.splice(0, rows.length, ...parts.map(makeRow))
  if (props.isAdd || !parts.length) rows.push(makeRow(''))
  const disabled = new Set(t.disabledModes ?? [])
  orEnabled.value = !disabled.has('or')
  excludeEnabled.value = !disabled.has('exclude')
  nextTick(() => rows.forEach((_, i) => renderHighlight(i)))
}, { immediate: true })

function makeRow(raw: string): RowState {
  return {
    id: Symbol(),
    token: parseToken(raw),
    rawText: raw,
    suggestions: [],
    selectedIdx: -1,
  }
}

// --- DB loading ---

onMounted(async () => {
  document.addEventListener('keydown', onGlobalKeydown)
  const loads: Promise<unknown>[] = [loadTagDb()]
  if (props.useNhWeight) loads.push(loadNhPopularity())
  await Promise.all(loads)
  dbReady.value = true
  if (props.isAdd) {
    nextTick(() => {
      tagInputRefs.value[0]?.focus()
    })
  }
})

onUnmounted(() => {
  clearTimeout(searchTimer)
  document.removeEventListener('keydown', onGlobalKeydown)
})

// --- bidirectional sync ---

let _syncing = false

function onStructuredChange(rowIdx: number) {
  if (_syncing) return
  _syncing = true
  const row = rows[rowIdx]
  row.rawText = serializeToken(row.token)
  _syncing = false
  nextTick(() => renderHighlight(rowIdx))
}

// --- contenteditable raw input ---

const rawRefMap = new Map<symbol, HTMLElement>()
let isComposing = false

function setRawRef(row: RowState, el: HTMLElement | null) {
  if (el) rawRefMap.set(row.id, el)
  else rawRefMap.delete(row.id)
}

function getRawEl(rowIdx: number): HTMLElement | undefined {
  return rawRefMap.get(rows[rowIdx]?.id)
}

function getCursorOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return 0
  const range = sel.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
  return range.toString().length
}

function setCursorOffset(el: HTMLElement, offset: number) {
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
    // cursor was past the end — place at end of last text node
    range.setStart(lastNode, lastLen)
    range.collapse(true)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

function renderHighlight(rowIdx: number) {
  const el = getRawEl(rowIdx)
  if (!el) return
  const row = rows[rowIdx]
  if (!row.rawText) {
    el.innerHTML = ''
    return
  }

  let segs = buildExplain(row.token)

  // if reconstructed text doesn't match rawText, fall back to raw display
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

function onRawEditableInput(rowIdx: number, event: Event) {
  if (isComposing) return
  const el = event.target as HTMLElement
  const text = el.textContent ?? ''
  syncRawText(rowIdx, text)
}

function onCompositionEnd(rowIdx: number) {
  isComposing = false
  const el = getRawEl(rowIdx)
  if (!el) return
  const text = el.textContent ?? ''
  syncRawText(rowIdx, text)
}

function onCompositionStart() {
  isComposing = true
}

function onRawKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') e.preventDefault()
}

function syncRawText(rowIdx: number, text: string) {
  if (_syncing) return
  _syncing = true
  const row = rows[rowIdx]
  row.rawText = text
  row.token = parseToken(text.trim())
  _syncing = false
  renderHighlight(rowIdx)

  // close any open autocomplete when editing raw syntax
  row.suggestions = []
  row.selectedIdx = -1
  activeRow.value = -1
}

// --- structured control handlers ---

function cyclePrefix(current: Prefix): Prefix {
  if (current === null) return '-'
  if (current === '-') return '~'
  return null
}

function setPrefix(rowIdx: number, prefix: Prefix) {
  rows[rowIdx].token.prefix = prefix
  onStructuredChange(rowIdx)
}

function rowPrefersShort(row: RowState): boolean {
  return row.token.namespace && row.token.namespaceRaw
    ? row.token.namespaceRaw !== row.token.namespace
    : (props.nsFormat ?? 'long') === 'short'
}

function setColonPrefix(rowIdx: number, value: string) {
  const row = rows[rowIdx]
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
    const prefersShort = rowPrefersShort(row)
    row.token.qualifier = null
    row.token.namespace = ns
    row.token.namespaceRaw = prefersShort ? (nsToShort(ns) ?? ns) : ns
  }
  onStructuredChange(rowIdx)
}

function setTagValue(rowIdx: number, value: string) {
  const row = rows[rowIdx]
  row.token.tag = value
  row.token.quoted = value.includes(' ')
  onStructuredChange(rowIdx)
}

function cycleSuffix(current: Suffix): Suffix {
  if (current === null) return '$'
  if (current === '$') return '*'
  return null
}

function onCycleSuffix(rowIdx: number) {
  const row = rows[rowIdx]
  row.token.suffix = cycleSuffix(row.token.suffix)
  onStructuredChange(rowIdx)
}

const nsToShort = (ns: string) => NS_TO_SHORT[ns] as string | undefined

function cycleNsFormat(rowIdx: number) {
  const row = rows[rowIdx]
  if (!row.token.namespace) return
  const ns = row.token.namespace
  const short = nsToShort(ns)
  if (!short) return // no short form (e.g. "temp"), nothing to cycle

  // toggle: if currently short → long, if currently long → short
  row.token.namespaceRaw = row.token.namespaceRaw === ns ? short : ns
  onStructuredChange(rowIdx)
}

function getNsFormatLabel(token: SearchToken): string {
  if (!token.namespace) return ''
  const short = nsToShort(token.namespace)
  if (!short) return '-'
  return token.namespaceRaw === token.namespace ? t('settings.nsFormatLong') : t('settings.nsFormatShort')
}

// --- autocomplete ---

let searchTimer = 0

function triggerSearch(rowIdx: number) {
  clearTimeout(searchTimer)
  const row = rows[rowIdx]
  const q = row.token.tag.trim()

  // don't search if a qualifier (not namespace) is selected
  if (row.token.qualifier) {
    row.suggestions = []
    row.selectedIdx = -1
    return
  }

  if (!dbReady.value || !q) {
    row.suggestions = []
    row.selectedIdx = -1
    return
  }

  searchTimer = window.setTimeout(() => {
    row.suggestions = searchTags(q, { useNhWeight: props.useNhWeight, nsOrder: props.nsOrder })
    row.selectedIdx = -1
  }, 80)
}

function onTagInputFocus(rowIdx: number) {
  activeRow.value = rowIdx
  triggerSearch(rowIdx)
}

function onTagInput(rowIdx: number, value: string) {
  activeRow.value = rowIdx
  setTagValue(rowIdx, value)
  triggerSearch(rowIdx)
}

function pickSuggestion(entry: TagEntry, rowIdx: number) {
  const row = rows[rowIdx]
  const prefersShort = rowPrefersShort(row)
  row.token.namespace = entry.ns
  row.token.namespaceRaw = prefersShort ? (nsToShort(entry.ns) ?? entry.ns) : entry.ns
  row.token.qualifier = null
  row.token.tag = entry.raw
  row.token.quoted = entry.raw.includes(' ')
  if (row.token.suffix === null && (props.defaultExactMatch ?? true)) {
    row.token.suffix = '$'
  }
  onStructuredChange(rowIdx)
  row.suggestions = []
  row.selectedIdx = -1
  activeRow.value = -1
}

// --- row management ---

function addRowAfter(idx: number) {
  rows.splice(idx + 1, 0, makeRow(''))
  nextTick(() => {
    tagInputRefs.value[idx + 1]?.focus()
  })
}

function removeRow(idx: number) {
  if (rows.length <= 1) {
    rows[0] = makeRow('')
    return
  }
  rows.splice(idx, 1)
}

// --- keyboard ---

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    onSave()
  } else if (e.key === 'Escape') {
    const activeRowState = activeRow.value >= 0 ? rows[activeRow.value] : null
    if (activeRowState?.suggestions.length) {
      activeRowState.suggestions = []
      activeRowState.selectedIdx = -1
    } else {
      emit('close')
    }
  }
}

function onTagKeydown(e: KeyboardEvent, rowIdx: number) {
  const row = rows[rowIdx]
  if (row.suggestions.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row.selectedIdx < row.suggestions.length - 1) row.selectedIdx++
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row.selectedIdx > 0) row.selectedIdx--
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (row.selectedIdx >= 0 && row.suggestions[row.selectedIdx]) {
        pickSuggestion(row.suggestions[row.selectedIdx], rowIdx)
      }
    }
  }
}

// --- colon prefix dropdown value ---

function getColonPrefixValue(token: SearchToken): string {
  if (token.qualifier) return `q:${token.qualifier}`
  if (token.namespace) return `ns:${token.namespace}`
  return ''
}

// --- explain panel helpers ---

const EXPLAIN_CLASSES: Record<string, string> = {
  prefix: 'eqt-explain--prefix',
  ns: 'eqt-explain--ns',
  qualifier: 'eqt-explain--qualifier',
  tag: 'eqt-explain--tag',
  suffix: 'eqt-explain--suffix',
  error: 'eqt-explain--error',
  punct: 'eqt-explain--punct',
}

interface ExplainSegment {
  text: string
  cls: string
  label: string
}

function buildExplain(token: SearchToken): ExplainSegment[] {
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

// --- save ---

function onSave() {
  const parts = rows.map(r => r.rawText.trim()).filter(Boolean)
  if (!parts.length) return
  const joined = parts.join(', ')
  const disabled: TagMode[] = []
  if (!orEnabled.value) disabled.push('or')
  if (!excludeEnabled.value) disabled.push('exclude')

  emit('save', {
    tag: joined,
    label: label.value.trim() || undefined,
    disabledModes: disabled.length ? disabled : undefined,
  })
}

// --- namespace list for dropdown ---

const isCJK = computed(isCJKLocale)
const syntaxHelpUrl = computed(() =>
  isCJK.value
    ? 'https://ehwiki.org/wiki/Gallery_Searching/Chinese'
    : 'https://ehwiki.org/wiki/Gallery_Searching'
)

const nsOptions = computed(() =>
  ALL_NAMESPACES.map(ns => {
    const short = nsToShort(ns)
    return { value: `ns:${ns}`, label: short ? `${ns} (${short})` : ns }
  })
)

const qualifierOptions = Array.from(QUALIFIER_SET).map(q => ({ value: `q:${q}`, label: `${q}:` }))
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')">
    <div class="eqt-popup">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('tagConfig.displayName') }}</label>
        <input
          v-model="label"
          class="eqt-popup__input"
          :placeholder="t('tagConfig.displayNameHint')"
        />
      </div>

      <hr class="eqt-popup__divider" />

      <div class="eqt-popup__field">
        <div class="eqt-popup__label-row">
          <label class="eqt-popup__label">{{ t('tagConfig.tagSyntax') }}</label>
          <a class="eqt-popup__syntax-help" :href="syntaxHelpUrl" target="_blank" rel="noopener"><ExternalLink :size="12" /> Wiki</a>
          <button
            class="eqt-popup__add-btn"
            type="button"
            @click="addRowAfter(rows.length - 1)"
          >+ {{ t('tagbar.addTag') }}</button>
        </div>

        <div
          v-for="(row, i) in rows"
          :key="row.id"
          class="eqt-row"
        >
          <!-- Builder row -->
          <div class="eqt-row__builder">
            <button
              class="eqt-row__prefix-cycle"
              :class="{
                'eqt-row__prefix-cycle--exclude': row.token.prefix === '-',
                'eqt-row__prefix-cycle--or': row.token.prefix === '~',
              }"
              type="button"
              :title="t('tagConfig.prefix')"
              @click="setPrefix(i, cyclePrefix(row.token.prefix))"
            >{{ row.token.prefix ?? '\u00A0' }}</button>

            <div class="eqt-row__colon-split">
              <button
                class="eqt-row__colon-toggle"
                :class="{ 'eqt-row__colon-toggle--disabled': !row.token.namespace || !nsToShort(row.token.namespace) }"
                type="button"
                :disabled="!row.token.namespace || !nsToShort(row.token.namespace)"
                :title="getNsFormatLabel(row.token)"
                @click="cycleNsFormat(i)"
              ><span :class="{ 'eqt-row__colon-toggle-hidden': !row.token.namespace || !nsToShort(row.token.namespace) || row.token.namespaceRaw !== row.token.namespace }">{{ t('tagConfig.nsLong') }}</span><span :class="{ 'eqt-row__colon-toggle-hidden': !row.token.namespace || !nsToShort(row.token.namespace) || row.token.namespaceRaw === row.token.namespace }">{{ t('tagConfig.nsShort') }}</span></button>
              <select
                class="eqt-row__select eqt-row__select--colon"
                :value="getColonPrefixValue(row.token)"
                @change="setColonPrefix(i, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">{{ t('tagConfig.colonPrefixNone') }}</option>
                <optgroup :label="t('tagConfig.colonPrefixNsGroup')">
                  <option v-for="opt in nsOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </optgroup>
                <optgroup :label="t('tagConfig.colonPrefixQGroup')">
                  <option v-for="opt in qualifierOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </optgroup>
              </select>
            </div>

            <div class="eqt-row__tag-wrap">
              <input
                ref="tagInputRefs"
                :value="row.token.tag"
                class="eqt-popup__input eqt-row__tag-input"
                :placeholder="dbReady ? t('tagConfig.searchPlaceholder') : t('tagConfig.loadingPlaceholder')"
                :disabled="!dbReady"
                @input="onTagInput(i, ($event.target as HTMLInputElement).value)"
                @focus="onTagInputFocus(i)"
                @keydown="onTagKeydown($event, i)"
              />
              <div v-if="activeRow === i && dbReady && row.token.tag.trim() && !row.suggestions.length && !row.token.qualifier" class="eqt-popup__no-result">
                {{ t('tagConfig.noResult') }}
              </div>
              <ul v-if="activeRow === i && row.suggestions.length" class="eqt-popup__suggestions">
                <li
                  v-for="(entry, si) in row.suggestions"
                  :key="entry.fullTag"
                  class="eqt-popup__suggestion"
                  :class="{ 'eqt-popup__suggestion--active': si === row.selectedIdx }"
                  @mousedown.prevent="pickSuggestion(entry, i)"
                  @mouseenter="row.selectedIdx = si"
                >
                  <span class="eqt-popup__suggestion-ns">{{ t('ns.' + entry.ns) }}：</span>
                  <span class="eqt-popup__suggestion-name">{{ isCJK ? entry.name : entry.raw }}</span>
                  <span class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
                </li>
              </ul>
            </div>

            <button
              class="eqt-row__suffix-cycle"
              :class="{
                'eqt-row__suffix-cycle--exact': row.token.suffix === '$',
                'eqt-row__suffix-cycle--wild': row.token.suffix === '*',
              }"
              type="button"
              :title="row.token.suffix === '$' ? t('tagConfig.exactMatch') : row.token.suffix === '*' ? t('tagConfig.wildcard') : '\u00A0'"
              @click="onCycleSuffix(i)"
            >{{ row.token.suffix ?? '\u00A0' }}</button>

            <button
              class="eqt-popup__tag-remove"
              type="button"
              :title="t('tagConfig.removeRow')"
              @click="removeRow(i)"
            >&times;</button>
          </div>

          <!-- Raw syntax with inline syntax highlighting -->
          <div class="eqt-row__raw-line">
            <label class="eqt-row__raw-label">{{ t('tagConfig.rawSyntax') }}</label>
            <div
              :ref="el => setRawRef(row, el as HTMLElement)"
              class="eqt-row__raw-editable"
              contenteditable="plaintext-only"
              spellcheck="false"
              @input="onRawEditableInput(i, $event)"
              @keydown="onRawKeydown($event)"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd(i)"
            ></div>
          </div>
        </div>
      </div>

      <hr class="eqt-popup__divider" />

      <!-- Right-click mode -->
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('tagConfig.rightClickMode') }}</label>
        <div class="eqt-popup__modes">
          <label class="eqt-popup__mode">
            <input type="checkbox" v-model="orEnabled" />
            <span>Or（~）</span>
          </label>
          <label class="eqt-popup__mode">
            <input type="checkbox" v-model="excludeEnabled" />
            <span>Exclude（-）</span>
          </label>
        </div>
      </div>

      <div class="eqt-popup__actions">
        <button v-if="!isAdd" class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          {{ t('tagConfig.delete') }}
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          {{ t('tagConfig.cancel') }} <kbd class="eqt-popup__kbd">Esc</kbd>
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          {{ t('tagConfig.save') }} <kbd class="eqt-popup__kbd">Ctrl+Enter</kbd>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--eqt-overlay);
}

.eqt-popup {
  text-align: left;
  background: var(--eqt-bg);
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  width: clamp(22rem, 80vw, 60rem);
  min-height: 80vh;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--eqt-shadow);
  font-size: 13px;
  color: var(--eqt-text);

  &__field {
    margin-bottom: 10px;
    position: relative;
  }

  &__label-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 3px;
    font-weight: bold;
    font-size: 12px;
  }

  &__syntax-help {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    font-size: 12px;
    font-weight: normal;
    line-height: 1.4;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  &__add-btn {
    margin-left: auto;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  &__label {
    display: block;
    margin-bottom: 3px;
    font-weight: bold;
    font-size: 12px;

    .eqt-popup__label-row > & {
      margin-bottom: 0;
    }
  }

  &__input {
    width: 100%;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 13px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }

    &:disabled {
      background: var(--eqt-bg-disabled);
      color: var(--eqt-text-hint);
    }
  }

  &__divider {
    border: none;
    border-top: var(--eqt-border-width) solid var(--eqt-divider);
    margin: 12px 0;
  }

  &__tag-remove {
    flex-shrink: 0;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 16px;
    border-radius: 3px;

    &:hover {
      background: var(--eqt-bg-hover);
      color: #8c3333;
    }
  }

  &__no-result {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    padding: 6px 8px;
    font-size: 12px;
    color: var(--eqt-text-hint);
    background: var(--eqt-bg-elevated);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    z-index: 1;
  }

  &__suggestions {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
    background: var(--eqt-bg-elevated);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    max-height: 50vh;
    overflow-y: auto;
    z-index: 1;
  }

  &__suggestion {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    cursor: pointer;

    &:hover,
    &--active {
      background: var(--eqt-bg-active);
    }
  }

  &__suggestion-ns {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex-shrink: 0;
  }

  &__suggestion-name {
    font-size: 13px;
    flex: 1;
    min-width: 0;
  }

  &__suggestion-tag {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex-shrink: 0;
  }

  &__modes {
    display: flex;
    gap: 12px;
  }

  &__mode {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
  }

  &__spacer {
    flex: 1;
  }

  &__kbd {
    margin-left: 6px;
    font-size: 10px;
    opacity: 0.6;
    font-family: inherit;
  }

  &__btn {
    padding: 4px 12px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    cursor: pointer;
    font-size: 12px;

    &:hover {
      background: var(--eqt-bg-btn-hover);
    }

    &--primary {
      background: #4a7c59;
      border-color: #3d6b4a;
      color: #fff;

      &:hover {
        background: #3d6b4a;
      }
    }

    &--delete {
      background: #8c3333;
      border-color: #743030;
      color: #fff;

      &:hover {
        background: #743030;
      }
    }
  }
}

// --- row layout ---

.eqt-row {
  margin-bottom: 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  padding: 6px;

  &__builder {
    display: flex;
    align-items: stretch;
    gap: 4px;
    font-size: 12px;
    line-height: 1.4;
  }

  &__prefix-cycle {
    flex-shrink: 0;
    min-width: 2.2em;
    padding: 0 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--exclude {
      background: rgba(140, 51, 51, 0.15);
      color: #8c3333;
      border-color: #8c3333;

      .eqt-dark & {
        background: rgba(248, 113, 113, 0.2);
        color: #f87171;
        border-color: #f87171;
      }
    }

    &--or {
      background: rgba(184, 134, 11, 0.15);
      color: #b8860b;
      border-color: #b8860b;

      .eqt-dark & {
        background: rgba(251, 191, 36, 0.2);
        color: #fbbf24;
        border-color: #fbbf24;
      }
    }
  }

  &__select {
    padding: 0 4px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    flex-shrink: 0;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }

    &--colon {
      max-width: 11em;
    }
  }

  &__colon-split {
    display: flex;
    flex-shrink: 0;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    overflow: hidden;

    .eqt-row__select--colon {
      border: none;
      border-radius: 0;
      max-width: 10em;
    }
  }

  &__colon-toggle {
    padding: 0 6px;
    border: none;
    border-right: var(--eqt-border-width) solid var(--eqt-border);
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    flex-shrink: 0;
    display: inline-grid;
    align-items: center;
    justify-items: center;

    > * {
      grid-area: 1 / 1;
    }

    &:hover:not(:disabled) {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text);
    }

    &--disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  &__colon-toggle-hidden {
    visibility: hidden;
  }

  &__tag-wrap {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
  }

  &__tag-input {
    width: 100%;
    flex: 1;
  }

  &__suffix-cycle {
    flex-shrink: 0;
    min-width: 2.2em;
    padding: 0 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--exact {
      background: rgba(220, 38, 38, 0.1);
      color: #dc2626;
      border-color: #dc2626;

      .eqt-dark & {
        background: rgba(248, 113, 113, 0.2);
        color: #f87171;
        border-color: #f87171;
      }
    }

    &--wild {
      background: rgba(124, 58, 237, 0.1);
      color: #7c3aed;
      border-color: #7c3aed;

      .eqt-dark & {
        background: rgba(167, 139, 250, 0.2);
        color: #a78bfa;
        border-color: #a78bfa;
      }
    }
  }

  &__raw-line {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  &__raw-label {
    font-size: 10px;
    color: var(--eqt-text-hint);
    flex-shrink: 0;
    min-width: 4em;
  }

  &__raw-editable {
    flex: 1;
    min-width: 0;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
    line-height: 1.4;
    padding: 4px 6px;
    background: var(--eqt-bg-elevated);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    cursor: text;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }

    &:empty::before {
      content: attr(data-placeholder);
      color: var(--eqt-text-hint);
    }
  }

}

// --- explain colors ---

.eqt-explain {
  &--prefix {
    color: #d97706;
    background: rgba(217, 119, 6, 0.1);
    padding: 0 2px;
    border-radius: 2px;

    .eqt-dark & {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.15);
    }
  }

  &--ns {
    color: #2563eb;
    background: rgba(37, 99, 235, 0.1);
    padding: 0 2px;
    border-radius: 2px;

    .eqt-dark & {
      color: #60a5fa;
      background: rgba(96, 165, 250, 0.15);
    }
  }

  &--qualifier {
    color: #7c3aed;
    background: rgba(124, 58, 237, 0.1);
    padding: 0 2px;
    border-radius: 2px;

    .eqt-dark & {
      color: #a78bfa;
      background: rgba(167, 139, 250, 0.15);
    }
  }

  &--tag {
    color: #059669;
    background: rgba(5, 150, 105, 0.1);
    padding: 0 2px;
    border-radius: 2px;

    .eqt-dark & {
      color: #34d399;
      background: rgba(52, 211, 153, 0.15);
    }
  }

  &--suffix {
    color: #dc2626;
    background: rgba(220, 38, 38, 0.1);
    padding: 0 2px;
    border-radius: 2px;

    .eqt-dark & {
      color: #f87171;
      background: rgba(248, 113, 113, 0.15);
    }
  }

  &--error {
    color: #dc2626;
    text-decoration: wavy underline #dc2626;
    padding: 0 2px;

    .eqt-dark & {
      color: #f87171;
      text-decoration-color: #f87171;
    }
  }

  &--punct {
    color: var(--eqt-text-hint);
  }
}

</style>
