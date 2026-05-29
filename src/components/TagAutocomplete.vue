<script setup lang="ts">
import { ref, watch, computed, onMounted, onScopeDispose } from 'vue'
import { useEventListener } from '@vueuse/core'
import { loadTagDb, searchTags, type TagEntry } from '@/services/tagDb'
import type { Qualifier } from '@/services/searchSyntax'
import { isCJKLocale, t } from '@/composables/useI18n'

const props = defineProps<{
  query: string
  qualifier: Qualifier | null
  useNhWeight: boolean
  nsOrder: string[]
  // input element ref（由 parent 傳入）—— autocomplete 自己掛 keydown listener
  // 處理上下鍵 + Enter，因為鍵盤事件源頭一定是 focused input
  inputEl: HTMLInputElement | null
}>()

const emit = defineEmits<{
  pick: [entry: TagEntry]
}>()

const dbReady = ref(false)
const suggestions = ref<TagEntry[]>([])
const selectedIdx = ref(-1)

onMounted(async () => {
  await loadTagDb()
  dbReady.value = true
  triggerSearch()
})

let searchTimer = 0
onScopeDispose(() => clearTimeout(searchTimer))

function triggerSearch(): void {
  clearTimeout(searchTimer)
  if (props.qualifier) {
    suggestions.value = []
    selectedIdx.value = -1
    return
  }
  if (!dbReady.value || !props.query) {
    suggestions.value = []
    selectedIdx.value = -1
    return
  }
  searchTimer = window.setTimeout(() => {
    suggestions.value = searchTags(props.query, {
      useNhWeight: props.useNhWeight,
      nsOrder: props.nsOrder,
    })
    selectedIdx.value = -1
  }, 80)
}

watch(() => [props.query, props.qualifier, props.useNhWeight, props.nsOrder], triggerSearch, { deep: true })

// === 鍵盤導覽：autocomplete 自己掛 keydown listener 到 input ===
// 之所以不放在 SearchTermEditor：autocomplete 知道 suggestions 長度與否，
// 才能決定是否要 preventDefault 攔截方向鍵。
useEventListener(() => props.inputEl, 'keydown', (e: KeyboardEvent) => {
  if (!suggestions.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
    scrollToSelected()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
    scrollToSelected()
  } else if (e.key === 'Enter') {
    if (selectedIdx.value >= 0 && suggestions.value[selectedIdx.value]) {
      e.preventDefault()
      emit('pick', suggestions.value[selectedIdx.value])
    }
  }
})

function scrollToSelected(): void {
  if (!suggestEl.value || selectedIdx.value < 0) return
  const active = suggestEl.value.querySelector('.eqt-popup__suggestion--active') as HTMLElement | null
  active?.scrollIntoView({ block: 'nearest' })
}

// === virtual scroll ===
const EST_ITEM_HEIGHT = 32
const OVERSCAN = 10
const suggestEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

const visibleRange = computed(() => {
  const total = suggestions.value.length
  if (!total) return { start: 0, end: 0 }
  const containerH = suggestEl.value?.clientHeight ?? 300
  const start = Math.max(0, Math.floor(scrollTop.value / EST_ITEM_HEIGHT) - OVERSCAN)
  const end = Math.min(total, Math.ceil((scrollTop.value + containerH) / EST_ITEM_HEIGHT) + OVERSCAN)
  return { start, end }
})

const virtualSuggestions = computed(() =>
  suggestions.value.slice(visibleRange.value.start, visibleRange.value.end).map((data, i) => ({
    data,
    index: visibleRange.value.start + i,
  })),
)

const wrapperStyle = computed(() => ({
  height: `${suggestions.value.length * EST_ITEM_HEIGHT}px`,
  paddingTop: `${visibleRange.value.start * EST_ITEM_HEIGHT}px`,
  boxSizing: 'border-box' as const,
}))

function onSuggestScroll(e: Event): void {
  const top = (e.target as HTMLElement).scrollTop
  if (top !== scrollTop.value) scrollTop.value = top
}

watch(suggestions, () => {
  scrollTop.value = 0
  if (suggestEl.value) suggestEl.value.scrollTop = 0
})

const isCJK = computed(isCJKLocale)
</script>

<template>
  <div
    v-if="dbReady && query.trim() && !suggestions.length && !qualifier"
    class="eqt-popup__no-result"
  >
    {{ t('tagConfig.noResult') }}
  </div>
  <div
    v-else-if="suggestions.length"
    ref="suggestEl"
    class="eqt-popup__suggestions"
    @scroll="onSuggestScroll"
  >
    <div :style="wrapperStyle">
      <div
        v-for="{ data: entry, index: si } in virtualSuggestions"
        :key="entry.fullTag"
        class="eqt-popup__suggestion"
        :class="{ 'eqt-popup__suggestion--active': si === selectedIdx }"
        @mousedown.prevent="emit('pick', entry)"
        @mouseenter="selectedIdx = si"
      >
        <span class="eqt-popup__suggestion-ns">{{ t('ns.' + entry.ns) }}：</span>
        <span class="eqt-popup__suggestion-name">{{ isCJK ? entry.name : entry.raw }}</span>
        <span class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-popup__no-result {
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

.eqt-popup__suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  margin: 2px 0 0;
  padding: 0;
  background: var(--eqt-bg-elevated);
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 3px;
  max-height: 50vh;
  overflow-y: auto;
  z-index: 1;
}

.eqt-popup__suggestion {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  box-sizing: border-box;
  cursor: pointer;
  flex-wrap: wrap;
  gap: 0 8px;

  &:hover,
  &--active {
    background: var(--eqt-bg-active);
  }
}

.eqt-popup__suggestion-ns {
  font-size: 11px;
  color: var(--eqt-text-hint);
  flex-shrink: 0;
}

.eqt-popup__suggestion-name {
  font-size: 13px;
  flex: 1;
  min-width: 0;
}

.eqt-popup__suggestion-tag {
  font-size: 11px;
  color: var(--eqt-text-hint);
  flex-shrink: 0;
  margin-left: auto;
}
</style>
