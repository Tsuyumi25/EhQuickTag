<script setup lang="ts">
import { reactive, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { type QuickTag, NS_LABEL, splitMultiTag } from '@/types'
import { loadTagDb, searchTags, type TagEntry } from '@/services/tagDb'
import { loadNhPopularity } from '@/services/nhPopularity'

const props = defineProps<{
  tag: QuickTag
  isAdd?: boolean
  useNhWeight?: boolean
  nsOrder?: string[]
}>()

const emit = defineEmits<{
  'save': [value: QuickTag]
  'delete': []
  'close': []
}>()

const label = ref('')
const tagRows = reactive<string[]>([])
const tagInputs = ref<HTMLInputElement[]>([])
const dbReady = ref(false)

// Per-row search state
const activeRow = ref(-1)
const searchQuery = ref('')
const suggestions = ref<TagEntry[]>([])
const selectedIdx = ref(-1)

watch(() => props.tag, (t) => {
  label.value = t.label ?? ''
  const parts = t.tag ? splitMultiTag(t.tag) : []
  tagRows.splice(0, tagRows.length, ...parts)
  tagRows.push('')
}, { immediate: true })

onMounted(async () => {
  document.addEventListener('keydown', onGlobalKeydown)
  const loads: Promise<unknown>[] = [loadTagDb()]
  if (props.useNhWeight) loads.push(loadNhPopularity())
  await Promise.all(loads)
  dbReady.value = true
  nextTick(() => {
    tagInputs.value[tagInputs.value.length - 1]?.focus()
  })
})

let searchTimer = 0

watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  if (!dbReady.value || !q.trim()) {
    suggestions.value = []
    selectedIdx.value = -1
    return
  }
  searchTimer = window.setTimeout(() => {
    suggestions.value = searchTags(q, { useNhWeight: props.useNhWeight, nsOrder: props.nsOrder })
    selectedIdx.value = -1
  }, 80)
})

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    onSave()
  } else if (e.key === 'Escape') {
    if (suggestions.value.length) {
      suggestions.value = []
    } else {
      emit('close')
    }
  }
}

onUnmounted(() => {
  clearTimeout(searchTimer)
  document.removeEventListener('keydown', onGlobalKeydown)
})

function formatSearchTag(fullTag: string): string {
  const col = fullTag.indexOf(':')
  if (col === -1) return `"${fullTag}"$`
  const ns = fullTag.slice(0, col)
  const name = fullTag.slice(col + 1)
  return `${ns}:"${name}"$`
}

function pickSuggestion(entry: TagEntry, rowIdx: number) {
  tagRows[rowIdx] = formatSearchTag(entry.fullTag)
  searchQuery.value = ''
  suggestions.value = []
  activeRow.value = -1
}

function onRowInput(rowIdx: number, value: string) {
  tagRows[rowIdx] = value
  activeRow.value = rowIdx
  searchQuery.value = value
}

function onRowFocus(rowIdx: number) {
  activeRow.value = rowIdx
  searchQuery.value = tagRows[rowIdx]
}

function addRowAfter(idx: number) {
  tagRows.splice(idx + 1, 0, '')
  nextTick(() => {
    tagInputs.value[idx + 1]?.focus()
  })
}

function removeRow(idx: number) {
  if (tagRows.length <= 1) {
    tagRows[0] = ''
    return
  }
  tagRows.splice(idx, 1)
}

function onRowKeydown(e: KeyboardEvent, rowIdx: number) {
  if (suggestions.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (selectedIdx.value > 0) selectedIdx.value--
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIdx.value >= 0 && suggestions.value[selectedIdx.value]) {
        pickSuggestion(suggestions.value[selectedIdx.value], rowIdx)
      }
    }
  } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    addRowAfter(rowIdx)
  }
}

function onSave() {
  const joined = tagRows.map(t => t.trim()).filter(Boolean).join(', ')
  if (!joined) return
  emit('save', { tag: joined, label: label.value.trim() || undefined })
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')">
    <div class="eqt-popup">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">顯示名稱</label>
        <input
          v-model="label"
          class="eqt-popup__input"
          placeholder="（留空則顯示 tag 原文）"
        />
      </div>

      <hr class="eqt-popup__divider" />

      <div class="eqt-popup__field">
        <label class="eqt-popup__label">標籤語法</label>
        <div
          v-for="(row, i) in tagRows"
          :key="i"
          class="eqt-popup__tag-row"
        >
          <input
            ref="tagInputs"
            :value="row"
            class="eqt-popup__input eqt-popup__tag-input"
            :placeholder="dbReady ? '輸入中文或英文搜尋…' : '載入中…'"
            :disabled="!dbReady"
            @input="onRowInput(i, ($event.target as HTMLInputElement).value)"
            @focus="onRowFocus(i)"
            @keydown="onRowKeydown($event, i)"
          />
          <button
            class="eqt-popup__tag-remove"
            type="button"
            title="移除"
            @click="removeRow(i)"
          >&times;</button>
          <div v-if="activeRow === i && dbReady && searchQuery.trim() && !suggestions.length" class="eqt-popup__no-result">
            找不到符合的標籤
          </div>
          <ul v-if="activeRow === i && suggestions.length" class="eqt-popup__suggestions">
            <li
              v-for="(entry, si) in suggestions"
              :key="entry.fullTag"
              class="eqt-popup__suggestion"
              :class="{ 'eqt-popup__suggestion--active': si === selectedIdx }"
              @mousedown.prevent="pickSuggestion(entry, i)"
              @mouseenter="selectedIdx = si"
            >
              <span class="eqt-popup__suggestion-ns">{{ NS_LABEL[entry.ns] ?? entry.ns }}：</span>
              <span class="eqt-popup__suggestion-name">{{ entry.name }}</span>
              <span class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="eqt-popup__actions">
        <button v-if="!isAdd" class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          刪除
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          取消 <kbd class="eqt-popup__kbd">Esc</kbd>
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          儲存 <kbd class="eqt-popup__kbd">Ctrl+Enter</kbd>
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

  &__label {
    display: block;
    margin-bottom: 3px;
    font-weight: bold;
    font-size: 12px;
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

  &__tag-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
    position: relative;

    .eqt-popup__input {
      flex: 1;
    }
  }

  &__tag-remove {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    border-radius: 3px;

    &:hover {
      background: var(--eqt-bg-hover);
      color: #8c3333;
    }
  }

  &__no-result {
    position: absolute;
    left: 0;
    right: 28px;
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
    right: 28px;
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
</style>
