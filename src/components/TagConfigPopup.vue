<script setup lang="ts">
import { reactive, ref, watch, onMounted, onUnmounted } from 'vue'
import type { QuickTag } from '@/types'
import { loadTagDb, searchTags, type TagEntry } from '@/services/tagDb'
import { loadNhPopularity } from '@/services/nhPopularity'

const NS_LABEL: Record<string, string> = {
  female: '女', male: '男', mixed: '混', other: '其他',
  location: '地點', language: '語言', parody: '原作',
  character: '角色', artist: '繪師', cosplayer: 'Coser',
  group: '團體', reclass: '分類', temp: '臨時',
}

const props = defineProps<{
  tag: QuickTag
  useNhWeight?: boolean
}>()

const emit = defineEmits<{
  'save': [value: QuickTag]
  'delete': []
  'close': []
}>()

const form = reactive({ tag: '', label: '' })
const searchQuery = ref('')
const suggestions = ref<TagEntry[]>([])
const dbReady = ref(false)
const selectedIdx = ref(-1)

watch(() => props.tag, (t) => {
  form.tag = t.tag
  form.label = t.label ?? ''
}, { immediate: true })

onMounted(async () => {
  const loads: Promise<unknown>[] = [loadTagDb()]
  if (props.useNhWeight) loads.push(loadNhPopularity())
  await Promise.all(loads)
  dbReady.value = true
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
    suggestions.value = searchTags(q, props.useNhWeight)
    selectedIdx.value = -1
  }, 80)
})

onUnmounted(() => { clearTimeout(searchTimer) })

/** Convert fullTag (e.g. female:big breasts) to search syntax (female:"big breasts"$) */
function formatSearchTag(fullTag: string): string {
  const col = fullTag.indexOf(':')
  if (col === -1) return `"${fullTag}"$`
  const ns = fullTag.slice(0, col)
  const name = fullTag.slice(col + 1)
  return `${ns}:"${name}"$`
}

function pickSuggestion(entry: TagEntry) {
  form.tag = formatSearchTag(entry.fullTag)
  form.label = entry.name
  searchQuery.value = ''
  suggestions.value = []
}

function onSave() {
  if (!form.tag.trim()) return
  emit('save', { tag: form.tag.trim(), label: form.label.trim() || undefined })
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (suggestions.value.length) {
      suggestions.value = []
      e.stopPropagation()
    } else {
      emit('close')
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedIdx.value >= 0 && suggestions.value[selectedIdx.value]) {
      pickSuggestion(suggestions.value[selectedIdx.value])
    }
  }
}

function onFieldKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Enter') onSave()
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')">
    <div class="eqt-popup">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">搜尋標籤</label>
        <input
          v-model="searchQuery"
          class="eqt-popup__input"
          :placeholder="dbReady ? '輸入中文或英文搜尋…' : '載入標籤資料庫中…'"
          :disabled="!dbReady"
          @keydown="onSearchKeydown"
        />
        <ul v-if="suggestions.length" class="eqt-popup__suggestions">
          <li
            v-for="(entry, i) in suggestions"
            :key="entry.fullTag"
            class="eqt-popup__suggestion"
            :class="{ 'eqt-popup__suggestion--active': i === selectedIdx }"
            @click="pickSuggestion(entry)"
            @mouseenter="selectedIdx = i"
          >
            <span class="eqt-popup__suggestion-ns">{{ NS_LABEL[entry.ns] ?? entry.ns }}：</span>
            <span class="eqt-popup__suggestion-name">{{ entry.name }}</span>
            <span class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
          </li>
        </ul>
      </div>

      <hr class="eqt-popup__divider" />

      <div class="eqt-popup__field">
        <label class="eqt-popup__label">Tag</label>
        <input
          v-model="form.tag"
          class="eqt-popup__input"
          placeholder="female:stockings"
          @keydown="onFieldKeydown"
        />
      </div>
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">Label</label>
        <input
          v-model="form.label"
          class="eqt-popup__input"
          placeholder="（留空則顯示 tag 原文）"
          @keydown="onFieldKeydown"
        />
      </div>
      <div class="eqt-popup__actions">
        <button class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          刪除
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          取消
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          儲存
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
  background: rgba(0, 0, 0, 0.4);
}

.eqt-popup {
  text-align: left;
  background: #edebdf;
  border: 1px solid #8a8271;
  border-radius: 6px;
  padding: 16px;
  min-width: 340px;
  max-width: 420px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  font-size: 13px;
  color: #34353b;

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
    border: 1px solid #8a8271;
    border-radius: 3px;
    font-size: 13px;
    background: #fff;
    color: #34353b;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: #4a7c59;
    }

    &:disabled {
      background: #e8e6da;
      color: #8a8271;
    }
  }

  &__divider {
    border: none;
    border-top: 1px solid #c5c0b0;
    margin: 12px 0;
  }

  &__suggestions {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
    background: #fff;
    border: 1px solid #8a8271;
    border-radius: 3px;
    max-height: 200px;
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
      background: #ddd8c8;
    }
  }

  &__suggestion-ns {
    font-size: 11px;
    color: #8a8271;
    flex-shrink: 0;
  }

  &__suggestion-name {
    font-size: 13px;
    flex: 1;
    min-width: 0;
  }

  &__suggestion-tag {
    font-size: 11px;
    color: #8a8271;
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

  &__btn {
    padding: 4px 12px;
    border: 1px solid #8a8271;
    border-radius: 3px;
    background: #ddd8c8;
    color: #34353b;
    cursor: pointer;
    font-size: 12px;

    &:hover {
      background: #cfc9b5;
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
