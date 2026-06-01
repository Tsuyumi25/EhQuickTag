<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSearchTerm, type RowState, cyclePrefix, nsToShort } from '@/composables/useSearchTerm'
import { ALL_NAMESPACES, type TagEntry } from '@/services/tagDb'
import { QUALIFIER_SET } from '@/services/searchSyntax'
import TagAutocomplete from '@/components/TagAutocomplete.vue'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  rowState: RowState
  defaultExactMatch?: boolean
  nsFormat?: 'long' | 'short'
  dbReady: boolean
  useNhWeight: boolean
  nsOrder: string[]
  active: boolean
}>()

const emit = defineEmits<{
  'update:active': [value: boolean]
  remove: []
}>()

const rawEl = ref<HTMLElement | null>(null)
const tagInputEl = ref<HTMLInputElement | null>(null)

const term = useSearchTerm(props.rowState, rawEl, {
  defaultExactMatch: props.defaultExactMatch,
  nsFormat: props.nsFormat,
})

onMounted(() => {
  term.refreshHighlight()
})

// 暴露 focus 方法給 parent — parent 在初次開啟 (isAdd) 或 addRowAfter 時主動呼叫
defineExpose({
  focus: () => tagInputEl.value?.focus(),
})

// parent 可透過 v-model:active 強制關閉（譬如 Esc）→ blur input
watch(() => props.active, (val) => {
  if (!val) tagInputEl.value?.blur()
})

// === handlers ===
function onPrefixCycle(): void {
  term.setPrefix(cyclePrefix(props.rowState.token.prefix))
}
function onColonPrefixChange(e: Event): void {
  term.setColonPrefix((e.target as HTMLSelectElement).value)
}
function onTagInput(e: Event): void {
  term.setTagValue((e.target as HTMLInputElement).value)
}
function onSuffixCycle(): void {
  term.onCycleSuffix()
}
function onNsFormatToggle(): void {
  term.cycleNsFormat()
}
function onTagFocus(): void {
  emit('update:active', true)
}
function onTagBlur(): void {
  // 延遲：讓 blur A → focus B 的瞬間 B 的 focus event 先跑，
  // 避免 selection 短暫斷層導致 autocomplete 閃滅。
  requestAnimationFrame(() => {
    if (document.activeElement !== tagInputEl.value) {
      emit('update:active', false)
    }
  })
}
function onPickSuggestion(entry: TagEntry): void {
  term.applySuggestionPick(entry)
  emit('update:active', false)
}

// === contenteditable raw editor ===
let isComposing = false
function onRawInput(e: Event): void {
  if (isComposing) return
  const text = (e.target as HTMLElement).textContent ?? ''
  term.updateFromRaw(text)
}
function onCompositionStart(): void {
  isComposing = true
}
function onCompositionEnd(e: CompositionEvent): void {
  isComposing = false
  const text = (e.target as HTMLElement).textContent ?? ''
  term.updateFromRaw(text)
}
function onRawKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') { e.preventDefault(); return }
  const key = e.key.toLowerCase()
  const isUndo = (e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey
  const isRedo = (e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))
  if (!isUndo && !isRedo) return
  e.preventDefault()
  if (isUndo) term.undo()
  else term.redo()
}

// === dropdown options ===
const nsOptions = ALL_NAMESPACES.map(ns => {
  const short = nsToShort(ns)
  return { value: `ns:${ns}`, label: short ? `${ns} (${short})` : ns }
})
const qualifierOptions = Array.from(QUALIFIER_SET).map(q => ({ value: `q:${q}`, label: `${q}:` }))
</script>

<template>
  <!-- Builder row -->
  <div class="eqt-row__builder">
    <button
      class="eqt-row__prefix-cycle"
      :class="{
        'eqt-row__prefix-cycle--exclude': rowState.token.prefix === '-',
        'eqt-row__prefix-cycle--or': rowState.token.prefix === '~',
      }"
      type="button"
      :title="t('tagConfig.prefix')"
      @click="onPrefixCycle"
    >{{ rowState.token.prefix ?? ' ' }}</button>

    <div class="eqt-row__colon-split">
      <button
        class="eqt-row__colon-toggle"
        :class="{ 'eqt-row__colon-toggle--disabled': !rowState.token.namespace || !nsToShort(rowState.token.namespace) }"
        type="button"
        :disabled="!rowState.token.namespace || !nsToShort(rowState.token.namespace)"
        :title="term.getNsFormatLabel()"
        @click="onNsFormatToggle"
      ><span :class="{ 'eqt-row__colon-toggle-hidden': !rowState.token.namespace || !nsToShort(rowState.token.namespace) || rowState.token.namespaceRaw !== rowState.token.namespace }">{{ t('tagConfig.nsLong') }}</span><span :class="{ 'eqt-row__colon-toggle-hidden': !rowState.token.namespace || !nsToShort(rowState.token.namespace) || rowState.token.namespaceRaw === rowState.token.namespace }">{{ t('tagConfig.nsShort') }}</span></button>
      <select
        class="eqt-row__select eqt-row__select--colon"
        :value="term.getColonPrefixValue()"
        @change="onColonPrefixChange"
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
        ref="tagInputEl"
        :value="rowState.token.tag"
        class="eqt-popup__input eqt-row__tag-input"
        :placeholder="dbReady ? t('tagConfig.searchPlaceholder') : t('tagConfig.loadingPlaceholder')"
        :disabled="!dbReady"
        @input="onTagInput"
        @focus="onTagFocus"
        @blur="onTagBlur"
      />
      <TagAutocomplete
        v-if="active && dbReady"
        :query="rowState.token.tag.trim()"
        :qualifier="rowState.token.qualifier"
        :use-nh-weight="useNhWeight"
        :ns-order="nsOrder"
        :input-el="tagInputEl"
        @pick="onPickSuggestion"
      />
    </div>

    <button
      class="eqt-row__suffix-cycle"
      :class="{
        'eqt-row__suffix-cycle--exact': rowState.token.suffix === '$',
        'eqt-row__suffix-cycle--wild': rowState.token.suffix === '*',
      }"
      type="button"
      :title="rowState.token.suffix === '$' ? t('tagConfig.exactMatch') : rowState.token.suffix === '*' ? t('tagConfig.wildcard') : ' '"
      @click="onSuffixCycle"
    >{{ rowState.token.suffix ?? ' ' }}</button>

    <button
      class="eqt-popup__tag-remove"
      type="button"
      :title="t('tagConfig.removeRow')"
      @click="emit('remove')"
    >&times;</button>
  </div>

  <!-- Raw syntax with inline syntax highlighting -->
  <div class="eqt-row__raw-line">
    <label class="eqt-row__raw-label">{{ t('tagConfig.rawSyntax') }}</label>
    <div
      ref="rawEl"
      class="eqt-row__raw-editable"
      contenteditable="plaintext-only"
      spellcheck="false"
      @input="onRawInput"
      @keydown="onRawKeydown"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    ></div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-row__builder {
  display: flex;
  align-items: stretch;
  gap: 4px;
  font-size: 12px;
  line-height: 1.4;
}

.eqt-row__prefix-cycle {
  @include btn-outlined;
  flex-shrink: 0;
  min-width: 2.2em;
  padding: 0 6px;
  color: var(--eqt-text-hint);
  font-weight: bold;

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

.eqt-row__select {
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

.eqt-row__colon-split {
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

.eqt-row__colon-toggle {
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

.eqt-row__colon-toggle-hidden {
  visibility: hidden;
}

.eqt-row__tag-wrap {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
}

.eqt-row__tag-input {
  width: 100%;
  flex: 1;
}

.eqt-row__suffix-cycle {
  @include btn-outlined;
  flex-shrink: 0;
  min-width: 2.2em;
  padding: 0 6px;
  color: var(--eqt-text-hint);
  font-weight: bold;

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

.eqt-row__raw-line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.eqt-row__raw-label {
  font-size: 10px;
  color: var(--eqt-text-hint);
  flex-shrink: 0;
  min-width: 4em;
}

.eqt-row__raw-editable {
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
