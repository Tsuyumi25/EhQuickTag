<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TagEntry } from '@/services/tagDb'
import { isCJKLocale, isTWLocale, t } from '@/composables/useI18n'
import { toTW } from '@/services/cjkDict'
import { convertToTraditional } from '@/services/store'

const props = defineProps<{
  suggestions: TagEntry[]
  selectedIdx: number
}>()

const emit = defineEmits<{
  'update:selectedIdx': [value: number]
  pick: [entry: TagEntry]
}>()

// 跟舊版 TagAutocomplete 同等值，behaviour 一致
const EST_ITEM_HEIGHT = 32
const OVERSCAN = 10

const listEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

const visibleRange = computed(() => {
  const total = props.suggestions.length
  if (!total) return { start: 0, end: 0 }
  const containerH = listEl.value?.clientHeight ?? 300
  const start = Math.max(0, Math.floor(scrollTop.value / EST_ITEM_HEIGHT) - OVERSCAN)
  const end = Math.min(total, Math.ceil((scrollTop.value + containerH) / EST_ITEM_HEIGHT) + OVERSCAN)
  return { start, end }
})

const virtualSuggestions = computed(() =>
  props.suggestions.slice(visibleRange.value.start, visibleRange.value.end).map((data, i) => ({
    data,
    index: visibleRange.value.start + i,
  })),
)

const wrapperStyle = computed(() => ({
  height: `${props.suggestions.length * EST_ITEM_HEIGHT}px`,
  paddingTop: `${visibleRange.value.start * EST_ITEM_HEIGHT}px`,
  boxSizing: 'border-box' as const,
}))

function onScroll(e: Event): void {
  const top = (e.target as HTMLElement).scrollTop
  if (top !== scrollTop.value) scrollTop.value = top
}

// 換新 suggestions 清單時把 scroll 拉回頂端
watch(() => props.suggestions, () => {
  scrollTop.value = 0
  if (listEl.value) listEl.value.scrollTop = 0
})

// 分辨 selectedIdx 變動來源：mouseenter 觸發時設旗標，watch 看到旗標就跳過 scroll。
// 否則會卡 feedback loop：hover 部分露出的 item → watch 滾起來讓它整個入視野 →
// 內容上移、滑鼠 screen 座標不變、游標下方換成下一個 item → 又 mouseenter → 一直滑。
// 鍵盤導覽路徑沒設這旗標，scroll-to-selected 正常運作。
let mouseDriven = false

function onItemMouseenter(si: number): void {
  mouseDriven = true
  emit('update:selectedIdx', si)
}

watch(() => props.selectedIdx, () => {
  if (mouseDriven) {
    mouseDriven = false
    return
  }
  if (!listEl.value || props.selectedIdx < 0) return
  const targetTop = props.selectedIdx * EST_ITEM_HEIGHT
  const targetBottom = targetTop + EST_ITEM_HEIGHT
  const visibleTop = scrollTop.value
  const visibleBottom = visibleTop + listEl.value.clientHeight
  if (targetTop < visibleTop) {
    listEl.value.scrollTop = targetTop
  } else if (targetBottom > visibleBottom) {
    listEl.value.scrollTop = targetBottom - listEl.value.clientHeight
  }
})

const isCJK = computed(isCJKLocale)

// CJK locale + convertToTraditional 'on'（或 'auto' 在 zh-TW）→ 簡 entry.name 過 toTW
const effectiveConvertTW = computed(() => {
  if (convertToTraditional.value === 'auto') return isTWLocale()
  return convertToTraditional.value === 'on'
})

function cjkName(name: string): string {
  return effectiveConvertTW.value ? toTW(name) : name
}
</script>

<template>
  <div
    ref="listEl"
    class="eqt-suggestion-list"
    @scroll="onScroll"
  >
    <div :style="wrapperStyle">
      <div
        v-for="{ data: entry, index: si } in virtualSuggestions"
        :key="entry.fullTag"
        class="eqt-popup__suggestion"
        :class="{ 'eqt-popup__suggestion--active': si === selectedIdx }"
        @mousedown.prevent="emit('pick', entry)"
        @mouseenter="onItemMouseenter(si)"
      >
        <span class="eqt-popup__suggestion-ns">{{ t('ns.' + entry.ns) }}：</span>
        <span class="eqt-popup__suggestion-name">{{ isCJK ? cjkName(entry.name) : entry.raw }}</span>
        <span class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// 純清單呈現：背景、邊框、捲動、文字對齊。位置交給 caller 給的 class
// （TagAutocomplete 套 .eqt-popup__suggestions 做 absolute dropdown；
//   AddTagPopup 不套，直接 in-flow 撐滿 popup 主體高度）
.eqt-suggestion-list {
  background: var(--eqt-bg-elevated);
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-sm);
  overflow-y: auto;
  text-align: left;
}
</style>
