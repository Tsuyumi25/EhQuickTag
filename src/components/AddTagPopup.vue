<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { loadTagDb, getNhRankedEntries, type TagEntry } from '@/services/tagDb'
import { useNhWeight, nsOrder } from '@/services/store'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'

const emit = defineEmits<{
  pick: [entry: TagEntry]
  close: []
}>()

const TOP_N = 500

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)
const selectedIdx = ref(0)
const topNh = ref<TagEntry[]>([])

// 跟其他 popup 同套：onClickOutside + Escape + useScrollLock 一條龍，
// 避免 AddTagPopup 開啟時滾輪穿透到背景 EH 列表
usePopupBehavior({ popupEl, onClose: () => emit('close') })

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  useNhWeight: () => useNhWeight.value,
  nsOrder: () => nsOrder.value,
  emptyFallback: () => topNh.value,
})

// suggestions 換新清單時拉回頂端，避免過濾完按 Enter 拿到 undefined / 高亮看不見
watch(suggestions, () => { selectedIdx.value = 0 })

onMounted(async () => {
  await loadTagDb()
  topNh.value = getNhRankedEntries().slice(0, TOP_N).map(r => r.entry)
  inputEl.value?.focus()
})

// Escape 走 usePopupBehavior 統一處理；這裡只 handle 清單導覽 + Enter pick
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const entry = suggestions.value[selectedIdx.value]
    if (entry) emit('pick', entry)
  }
}
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup eqt-add-popup" @keydown="onKeydown">
      <input
        ref="inputEl"
        v-model="query"
        class="eqt-popup__input eqt-add-popup__input"
        type="text"
        :placeholder="t('tagConfig.searchPlaceholder')"
        autocomplete="off"
        spellcheck="false"
      />
      <SuggestionList
        v-if="suggestions.length"
        class="eqt-add-popup__list"
        :suggestions="suggestions"
        :selected-idx="selectedIdx"
        @update:selected-idx="selectedIdx = $event"
        @pick="emit('pick', $event)"
      />
      <div v-else-if="dbReady" class="eqt-add-popup__empty">
        {{ t('tagConfig.noResult') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// fzf 風的窄版 popup：input 在頂、清單在下、Esc/overlay 點外都能關
.eqt-add-popup {
  display: flex;
  flex-direction: column;
  width: clamp(24rem, 50vw, 44rem);
  min-height: auto;
  max-height: 70vh;
  padding: 10px;
  gap: 8px;
  overflow: hidden;
}

.eqt-add-popup__input {
  flex-shrink: 0;
}

// SuggestionList 額外給的 flex 撐滿規則——SuggestionList 自帶 background / border /
// overflow-y / text-align，這裡只補「在 flex column 裡撐滿剩餘空間」的部分
.eqt-add-popup__list {
  flex: 1;
  min-height: 0;
}

.eqt-add-popup__empty {
  padding: 12px;
  color: var(--eqt-text-hint);
  font-size: var(--eqt-fs-md);
  text-align: center;
}
</style>
