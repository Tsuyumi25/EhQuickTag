<script setup lang="ts">
import { ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { TagEntry } from '@/services/tagDb'
import type { Qualifier } from '@/services/searchSyntax'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'

const props = defineProps<{
  query: string
  qualifier: Qualifier | null
  useNhWeight: boolean
  // input element ref（由 parent 傳入）—— autocomplete 自己掛 keydown listener
  // 處理上下鍵 + Enter，因為鍵盤事件源頭一定是 focused input
  inputEl: HTMLInputElement | null
}>()

const emit = defineEmits<{
  pick: [entry: TagEntry]
}>()

const { dbReady, suggestions } = useTagSuggestions({
  query: () => props.query,
  qualifier: () => props.qualifier,
  useNhWeight: () => props.useNhWeight,
})

const selectedIdx = ref(-1)

watch(suggestions, () => { selectedIdx.value = -1 })

// === 鍵盤導覽：autocomplete 自己掛 keydown listener 到 input ===
// 之所以不放在 SearchTermEditor：autocomplete 知道 suggestions 長度與否，
// 才能決定是否要 preventDefault 攔截方向鍵。
useEventListener(() => props.inputEl, 'keydown', (e: KeyboardEvent) => {
  if (!suggestions.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (e.key === 'Enter') {
    if (selectedIdx.value >= 0 && suggestions.value[selectedIdx.value]) {
      e.preventDefault()
      emit('pick', suggestions.value[selectedIdx.value])
    }
  }
})
</script>

<template>
  <div
    v-if="dbReady && query.trim() && !suggestions.length && !qualifier"
    class="eqt-popup__no-result"
  >
    {{ t('tagConfig.noResult') }}
  </div>
  <SuggestionList
    v-else-if="suggestions.length"
    class="eqt-popup__suggestions"
    :suggestions="suggestions"
    :selected-idx="selectedIdx"
    @update:selected-idx="selectedIdx = $event"
    @pick="emit('pick', $event)"
  />
</template>
