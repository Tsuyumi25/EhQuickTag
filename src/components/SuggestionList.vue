<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TagEntry } from '@/services/tagDb'
import { isCJKLocale, locale, t } from '@/composables/useI18n'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { useTextMeasure } from '@/composables/useTextMeasure'
import { TagState } from '@/types'

const props = defineProps<{
  suggestions: TagEntry[]
  selectedIdx: number
  // 可選 state map（key = entry.fullTag）：SearchPopup toggle 模式用，控制 chip
  // 上色（include/or/exclude）。TagAutocomplete dropdown 模式不傳，項目維持中性
  entryStates?: Map<string, TagState>
}>()

const emit = defineEmits<{
  'update:selectedIdx': [value: number]
  // 左鍵：dropdown 模式視為「選中此 entry」；toggle 模式視為「切 Include↔Off」
  pick: [entry: TagEntry]
  // 右鍵：toggle 模式用——cycle 到下一個 Or/Exclude 態。dropdown 模式 caller
  // 不掛 listener、預設不擋瀏覽器選單
  ctxmenu: [entry: TagEntry]
}>()

// state → class 對照表：Off 不列（Off 視同無 state、不上色），所以用 Partial
// 而非 Record——比舊版「Off 條目掛在 map 上但 stateClassOf 短路掉」乾淨
const STATE_CLASS: Partial<Record<TagState, string>> = {
  [TagState.Include]: 'eqt-popup__suggestion--include',
  [TagState.Or]:      'eqt-popup__suggestion--or',
  [TagState.Exclude]: 'eqt-popup__suggestion--exclude',
}

function stateClassOf(entry: TagEntry): string | undefined {
  if (!props.entryStates) return undefined
  const s = props.entryStates.get(entry.fullTag)
  return s !== undefined ? STATE_CLASS[s] : undefined
}

// mousedown 路徑：只接 left button。右鍵 mousedown 在某些平台也會 fire，這裡
// filter 掉避免雙觸發（contextmenu 那條另外處理）
function onItemMousedown(entry: TagEntry, e: MouseEvent): void {
  if (e.button !== 0) return
  emit('pick', entry)
}

function onItemContextMenu(entry: TagEntry): void {
  emit('ctxmenu', entry)
}

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

// ns 欄寬：用 useTextMeasure 量「當前 list 出現的 ns 翻譯字串中最寬的」。
// 量出的寬度設成 --ns-col-width，outer grid 第一欄寬度跟著走，name 起始點對齊
const { getWidth, version } = useTextMeasure({
  containerRef: listEl,
  itemSelector: '.eqt-popup__suggestion-ns',
  itemsSignal: () => props.suggestions,
})

const nsColWidth = computed(() => {
  void version.value
  void locale.value
  if (!props.suggestions.length) return 0
  const nsSet = new Set(props.suggestions.map(s => s.ns))
  let max = 0
  for (const ns of nsSet) {
    const w = getWidth(t('ns.' + ns) + '：')
    if (w > max) max = w
  }
  return max
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

// cjkDisplay 跟 SearchPanel 共用 useDisplayConfig 的繁化邏輯（'auto' = zh-TW on、
// 其他 off）。SuggestionList 不參考 SearchPanel 的 showCJK toggle——下拉建議純由
// UI locale 決定要不要顯示 CJK 翻譯（isCJK 那條），與 chip 顯示語言獨立
const { cjkDisplay } = useDisplayConfig()
</script>

<template>
  <div
    ref="listEl"
    class="eqt-suggestion-list"
    :style="nsColWidth > 0 ? { '--ns-col-width': nsColWidth + 'px' } : undefined"
    @scroll="onScroll"
  >
    <div :style="wrapperStyle">
      <div
        v-for="{ data: entry, index: si } in virtualSuggestions"
        :key="entry.fullTag"
        class="eqt-popup__suggestion"
        :class="[
          { 'eqt-popup__suggestion--active': si === selectedIdx },
          stateClassOf(entry),
        ]"
        @mousedown.prevent="onItemMousedown(entry, $event)"
        @contextmenu.prevent="onItemContextMenu(entry)"
        @mouseenter="onItemMouseenter(si)"
      >
        <span class="eqt-popup__suggestion-ns">{{ t('ns.' + entry.ns) }}：</span>
        <span class="eqt-popup__suggestion-name">{{ isCJK ? cjkDisplay(entry.name) : entry.raw }}</span>
        <span class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// 純清單呈現：背景、邊框、捲動、文字對齊。位置交給 caller 給的 class
// （TagAutocomplete 套 .eqt-popup__suggestions 做 absolute dropdown；
//   SearchPopup 不套，直接 in-flow 撐滿 popup 主體高度）
.eqt-suggestion-list {
  background: var(--eqt-bg-elevated);
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-sm);
  overflow-y: auto;
  text-align: left;

}
</style>
