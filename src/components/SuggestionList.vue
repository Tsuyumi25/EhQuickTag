<script setup lang="ts">
import { ref, computed, watch, type CSSProperties } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useVirtualizer, type VirtualItem, type Virtualizer } from '@tanstack/vue-virtual'
import { DEFAULT_NS_ORDER, type TagEntry } from '@/services/tags/tagDb'
import { isZhLocale, locale, t } from '@/composables/useI18n'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { useTextMeasure } from '@/composables/useTextMeasure'
import { TagState } from '@/types'

const props = defineProps<{
  suggestions: TagEntry[]
  selectedIdx: number
  // 可選 state lookup function：SearchPopup toggle 模式傳入，控制 chip 上色
  // （include/or/exclude）。TagAutocomplete dropdown 模式不傳，項目維持中性。
  //
  // 為什麼是 function 而不是 Map：caller 端要避免「對全部 suggestions iterate
  // 一遍預算 Map」的 O(N) 開銷——function 形式只對 v-for 實際 render 出來的
  // visible items（虛擬滾動切片後 ~20 個）call，跟著虛擬化一起省成本
  stateOf?: (entry: TagEntry) => TagState
  styleOf?: (entry: TagEntry) => CSSProperties | undefined
  // 可選：限制 ns 欄寬 measure 的 ns 集合。caller 知道篩選態（譬如 SearchPopup
  // 的 selectedNs）時傳入單一 ns 可省 measure 次數；不傳時用 DEFAULT_NS_ORDER
  // 全 13 個量出穩定 col width（不會隨 suggestions 變動而抖動）
  nsList?: readonly string[]
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
  if (!props.stateOf) return undefined
  return STATE_CLASS[props.stateOf(entry)]
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

// 列高隨內容變（長名稱把 fullTag 擠到第二行），實際高度在 render 後量；
// 這個值只用在還沒 render 過的列，取單行列的高度
const EST_ITEM_HEIGHT = 32
const OVERSCAN = 10

const listEl = ref<HTMLElement | null>(null)
const leadingEl = ref<HTMLElement | null>(null)
const rowsEl = ref<HTMLElement | null>(null)
// leading slot 的列排在虛擬列前面、不虛擬化；虛擬列的位置要從它們底下開始算
const rowsOffset = ref(0)

// virtualizer 的座標（scrollTop、ResizeObserver 回報的尺寸）是元素自己未縮放的 CSS px，
// getBoundingClientRect 卻是乘過祖先 CSS zoom 的畫面 px。SearchPopup 整個掛著
// zoom: 1.15、MyTagsPanel 有使用者設定的 zoom，從 rect 換算的值都要除回來，
// 不然同一列兩條量測路徑報出兩種高度，捲動一停就互相修正、清單跳一下
function layoutHeight(el: Element, rectHeight: number): number {
  return rectHeight / ((el as HTMLElement).currentCSSZoom || 1)
}

function measureRowsOffset(): void {
  if (!rowsEl.value || !listEl.value) return
  const list = listEl.value
  const delta = rowsEl.value.getBoundingClientRect().top - list.getBoundingClientRect().top
  rowsOffset.value = layoutHeight(list, delta) - list.clientTop + list.scrollTop
}
useResizeObserver(leadingEl, measureRowsOffset)
// RuleMaterialPanel 切到「全部」「素材」以外的篩選時 leading 整塊不 render；元素消失
// ResizeObserver 不會回報，舊的 offset 留著會讓 virtualizer 把可視範圍整段往下算、清單下半空白
watch(leadingEl, measureRowsOffset, { flush: 'post' })

const virtualizer = useVirtualizer(computed(() => {
  // 在 computed 裡讀 suggestions，換清單時（即使筆數相同）getItemKey 跟著換，
  // 量過的高度才不會套到別的 entry 上
  const list = props.suggestions
  return {
    count: list.length,
    getScrollElement: () => listEl.value,
    estimateSize: () => EST_ITEM_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin: rowsOffset.value,
    getItemKey: (index: number) => list[index].fullTag,
    // 預設量法把列高四捨五入成整數，但列在文件流裡的實際高度帶小數（26.19px 這類），
    // 往下累積幾十列就差出好幾 px，鍵盤捲到的項目底部會被切掉；這裡回報原值。
    //
    // RuleMaterialPanel 拖曳時 Sortable 會把列本身搬進條件區、原位放一個複本，
    // 列在那邊縮成 chip，量到的高度不屬於清單；沿用快取，免得清單在拖曳中跳動
    measureElement: (el: Element, entry: ResizeObserverEntry | undefined, instance: Virtualizer<HTMLElement, Element>) => {
      if (rowsEl.value?.contains(el)) return entry?.borderBoxSize[0]?.blockSize ?? layoutHeight(el, el.getBoundingClientRect().height)
      return instance.itemSizeCache.get(instance.options.getItemKey(instance.indexFromElement(el))) ?? EST_ITEM_HEIGHT
    },
  }
}))

function measureRow(el: unknown): void {
  virtualizer.value.measureElement(el as Element | null)
}

const virtualSuggestions = computed(() =>
  virtualizer.value.getVirtualItems().map((item: VirtualItem) => {
    const data = props.suggestions[item.index]
    return { data, index: item.index, style: props.styleOf?.(data) }
  }),
)

const wrapperStyle = computed(() => {
  const first = virtualizer.value.getVirtualItems()[0]
  return {
    height: `${virtualizer.value.getTotalSize()}px`,
    paddingTop: `${first ? first.start - rowsOffset.value : 0}px`,
    boxSizing: 'border-box' as const,
  }
})

// 換新 suggestions 清單時把 scroll 拉回頂端
watch(() => props.suggestions, () => {
  if (listEl.value) listEl.value.scrollTop = 0
})

// ns 欄寬：用 useTextMeasure 量「當前 list 出現的 ns 翻譯字串中最寬的」。
// 量出的寬度設成 --ns-col-width，ns 欄寬度跟著走，name 起始點對齊
const { getWidth, version } = useTextMeasure({
  containerRef: listEl,
  itemSelector: '.eqt-popup__suggestion-ns',
  itemsSignal: () => props.suggestions,
})

const nsColWidth = computed(() => {
  void version.value
  void locale.value
  // 依賴源是常數陣列（或 caller 傳的小集合），不再 walk suggestions——避免
  // 「suggestions 變動就 O(N) iterate + Set 重建」的無謂工作。getWidth 內部
  // 有 cache，第一輪後 ns label 的量測都是 hit
  const nsList = props.nsList ?? DEFAULT_NS_ORDER
  let max = 0
  for (const ns of nsList) {
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

// 不用 virtualizer.scrollToIndex：它拿 scroll event 回報的 offset 判斷要不要捲，
// 連按方向鍵時那個值還停在上一格，最後一次捲動會落在錯的位置；這裡直接讀 DOM 的 scrollTop
watch(() => props.selectedIdx, () => {
  if (mouseDriven) {
    mouseDriven = false
    return
  }
  const list = listEl.value
  const item = virtualizer.value.measurementsCache[props.selectedIdx]
  if (!list || !item) return
  if (item.start < list.scrollTop) {
    list.scrollTop = item.start
  } else if (item.end > list.scrollTop + list.clientHeight) {
    list.scrollTop = item.end - list.clientHeight
  }
})

const isZh = computed(isZhLocale)

// zhDisplay 跟 SearchPanel 共用 useDisplayConfig 的繁化邏輯（'auto' = zh-TW on、
// 其他 off）。SuggestionList 不參考 SearchPanel 的 showZh toggle——下拉建議純由
// UI locale 決定要不要顯示中文翻譯（isZh 那條），與 chip 顯示語言獨立
const { zhDisplay } = useDisplayConfig()
</script>

<template>
  <div
    ref="listEl"
    class="eqt-suggestion-list"
    :style="{ '--ns-col-width': nsColWidth > 0 ? nsColWidth + 'px' : undefined, '--eqt-suggestion-row-height': EST_ITEM_HEIGHT + 'px' }"
    @mouseleave="emit('update:selectedIdx', -1)"
  >
    <div v-if="$slots.leading" ref="leadingEl" class="eqt-suggestion-list__leading"><slot name="leading" /></div>
    <div ref="rowsEl" class="eqt-suggestion-list__rows" :style="wrapperStyle">
      <div
        v-for="{ data: entry, index: si, style } in virtualSuggestions"
        :key="entry.fullTag"
        :ref="measureRow"
        :data-index="si"
        :data-tag="entry.fullTag"
        class="eqt-popup__suggestion"
        :style="style"
        :class="[
          { 'eqt-popup__suggestion--active': si === selectedIdx, 'eqt-popup__suggestion--styled': !!style },
          stateClassOf(entry),
        ]"
        @mousedown.prevent="onItemMousedown(entry, $event)"
        @contextmenu.prevent="onItemContextMenu(entry)"
        @mouseenter="onItemMouseenter(si)"
      >
        <span class="eqt-popup__suggestion-ns">{{ t('ns.' + entry.ns) }}：</span>
        <span class="eqt-popup__suggestion-name"><img v-if="entry.iconUrl" :src="entry.iconUrl" class="eqt-tag-icon" alt="" />{{ isZh ? zhDisplay(entry.name) : entry.raw }}</span>
        <span v-if="isZh" class="eqt-popup__suggestion-tag">{{ entry.fullTag }}</span>
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
  overscroll-behavior: contain;
  text-align: left;
}
</style>
