<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import MyTagsTagBody from '@/components/mytags/MyTagsTagBody.vue'
import { t } from '@/composables/useI18n'
import { TAGSET_CAPACITY, type MyTagRow, type TagSetRef } from '@/composables/useEhMyTagsHost'
import type { EditMap, TagState } from '@/services/mytagsEdits'
import { effective } from '@/services/mytagsEdits'
import type { TagImpact } from '@/services/mytagsScore'
import type { TagFilter } from '@/services/mytagsEditStore'

const props = defineProps<{
  rows: MyTagRow[]
  totalCount: number
  edits: EditMap
  selected: string | null
  sets: TagSetRef[]
  currentSet: string
  /** 每個標籤在目前樣本裡的去向分佈 */
  impact: Map<string, TagImpact>
  setColors: Record<string, string>
  filter: TagFilter
}>()

const emit = defineEmits<{
  patch: [MyTagRow, Partial<TagState>]
  bulk: [MyTagRow[], Partial<TagState>]
  select: [string]
  remove: [MyTagRow[]]
  move: [MyTagRow[], string]
  'update:filter': [TagFilter]
}>()

const picked = ref<Set<number>>(new Set())

/**
 * 每一列的高度。JS 和 CSS 只有這一個來源——虛擬捲動要靠它換算位置，對不上就會
 * 抖動或空一塊。三行：標籤 / 旗標與權重 / 比率條。
 */
const ROW_H = 80
/** 上下各多畫幾列，快速捲動時才不會看到空白 */
const OVERSCAN = 4

const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewport = ref(600)


function view(row: MyTagRow): TagState {
  return effective(row, props.edits)
}

function dirty(row: MyTagRow): boolean {
  return props.edits[row.id] !== undefined
}


/**
 * 順序凍結在這裡：只在「篩選 / 排序 / 標籤增減」時重算一次，編輯、套用、選取都不動它。
 *
 * ⛔ 不要改成即時重排。調一格權重那一列就會從眼前跑掉。
 */
const order = ref(new Map<number, number>())

function compareRows(a: MyTagRow, b: MyTagRow): number {
  const av = view(a)
  const bv = view(b)
  if (props.filter.sort === 'positive') {
    return bv.weight - av.weight || a.full.localeCompare(b.full)
  }
  if (props.filter.sort === 'color') {
    const ac = (av.color || props.setColors[a.tagSet] || '').toLowerCase()
    const bc = (bv.color || props.setColors[b.tagSet] || '').toLowerCase()
    if (!ac && bc) return 1
    if (ac && !bc) return -1
    return ac.localeCompare(bc) || a.full.localeCompare(b.full)
  }
  return av.weight - bv.weight || a.full.localeCompare(b.full)
}

function reorder(): void {
  order.value = new Map([...props.rows].sort(compareRows).map((r, i) => [r.id, i]))
}

watch(
  () => [
    props.filter.set,
    props.filter.watch,
    props.filter.hidden,
    props.filter.sort,
    props.filter.status,
    props.rows.length,
  ],
  reorder,
  { immediate: true },
)

const visible = computed(() => {
  const at = order.value
  return props.rows.filter((row) => {
    const v = view(row)
    const flagFilterOn = props.filter.watch || props.filter.hidden
    const matchesFlag = (props.filter.watch && v.watch) || (props.filter.hidden && v.hidden)
    if (flagFilterOn && !matchesFlag) return false
    // EH 的預設權重是 10，所以「非預設」是指使用者真的動過的那些
    if (props.filter.status === 'weighted' && v.weight === 10) return false
    if (props.filter.status === 'pending' && !dirty(row)) return false
    return true
  // 沒排到的（剛載進來的）沉到最後，下一次重排就會歸位
  }).sort((a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity))
})

const pickedRows = computed(() => props.rows.filter((r) => picked.value.has(r.id)))

const allPicked = computed(() =>
  visible.value.length > 0 && visible.value.every((r) => picked.value.has(r.id)))

function togglePick(row: MyTagRow, on: boolean): void {
  const next = new Set(picked.value)
  if (on) next.add(row.id)
  else next.delete(row.id)
  picked.value = next
}

function toggleAll(on: boolean): void {
  const next = new Set(picked.value)
  for (const row of visible.value) {
    if (on) next.add(row.id)
    else next.delete(row.id)
  }
  picked.value = next
}

/**
 * 只畫看得到的那幾列。
 *
 * ⚠️ 一列有七個表單控制項（含原生的 `<input type="color">`），一百多列就是近千個。
 * 卡頓的來源是控制項數量，不是資料量。
 */
const window_ = computed(() => {
  const total = visible.value.length
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_H) - OVERSCAN)
  const count = Math.ceil(viewport.value / ROW_H) + OVERSCAN * 2
  return { start, rows: visible.value.slice(start, start + count), total }
})

function onScroll(e: Event): void {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

let ro: ResizeObserver | null = null
onMounted(() => {
  if (!scroller.value) return
  viewport.value = scroller.value.clientHeight
  ro = new ResizeObserver(([entry]) => { viewport.value = entry.contentRect.height })
  ro.observe(scroller.value)
})
onBeforeUnmount(() => ro?.disconnect())

// 換篩選或排序之後留在原本的捲動位置多半會落在清單之外，直接回頂
watch(
  () => [props.filter.set, props.filter.watch, props.filter.hidden, props.filter.sort, props.filter.status],
  () => {
    scrollTop.value = 0
    if (scroller.value) scroller.value.scrollTop = 0
  },
)

</script>

<template>
  <div class="eqt-taglist">
    <div class="eqt-taglist__head">
      <div class="eqt-taglist__head-main">
        <label class="eqt-taglist__check-all" :title="t('taglist.headLeft', { n: visible.length })">
          <input
            type="checkbox" :checked="allPicked"
            :aria-label="t('taglist.headLeft', { n: visible.length })"
            @change="toggleAll(($event.target as HTMLInputElement).checked)"
          >
        </label>
        <select
          class="eqt-panel__setpick"
          :value="filter.set"
          @change="emit('update:filter', {
            ...filter, set: ($event.target as HTMLSelectElement).value,
          })"
        >
          <option value="all">{{ t('taglist.allSets') }}（{{ totalCount }}）</option>
          <option v-for="s in sets" :key="s.value" :value="s.value">
            {{ s.name }}{{ s.used !== null ? `（${s.used}/${TAGSET_CAPACITY}）` : '' }}
          </option>
        </select>
      </div>
      <div class="eqt-taglist__head-filters">
        <button
          type="button"
          class="eqt-taglist__flag-filter"
          :class="{ 'eqt-taglist__flag-filter--on': filter.watch }"
          :aria-pressed="filter.watch"
          @click="emit('update:filter', { ...filter, watch: !filter.watch })"
        >{{ t('taglist.filterWatch') }}</button>
        <button
          type="button"
          class="eqt-taglist__flag-filter"
          :class="{ 'eqt-taglist__flag-filter--on': filter.hidden }"
          :aria-pressed="filter.hidden"
          @click="emit('update:filter', { ...filter, hidden: !filter.hidden })"
        >{{ t('taglist.filterHidden') }}</button>
        <select
          class="eqt-taglist__sortpick"
          :value="filter.sort"
          :aria-label="t('taglist.sortLabel')"
          @change="emit('update:filter', {
            ...filter, sort: ($event.target as HTMLSelectElement).value as TagFilter['sort'],
          })"
        >
          <option value="negative">{{ t('taglist.sortNegative') }}</option>
          <option value="positive">{{ t('taglist.sortPositive') }}</option>
          <option value="color">{{ t('taglist.sortColor') }}</option>
        </select>
        <select
          class="eqt-taglist__statuspick"
          :value="filter.status"
          @change="emit('update:filter', {
            ...filter, status: ($event.target as HTMLSelectElement).value as TagFilter['status'],
          })"
        >
          <option value="all">{{ t('taglist.statusAll') }}</option>
          <option value="weighted">{{ t('taglist.statusWeighted') }}</option>
          <option value="pending">{{ t('taglist.statusPending') }}</option>
        </select>
      </div>
    </div>

    <div ref="scroller" class="eqt-taglist__rows" @scroll.passive="onScroll">
      <p v-if="!visible.length" class="eqt-panel__hint">{{ t('taglist.empty') }}</p>

      <div v-else class="eqt-taglist__spacer" :style="{ height: `${window_.total * ROW_H}px` }">
      <article
        v-for="(row, i) in window_.rows"
        :key="row.id"
        class="eqt-taglist__row"
        :style="{ top: `${(window_.start + i) * ROW_H}px`, height: `${ROW_H}px` }"
        :class="{
          'eqt-taglist__row--on': selected === row.full,
          'eqt-taglist__row--dirty': dirty(row),
        }"
      >
        <label class="eqt-taglist__check">
          <input
            type="checkbox" :checked="picked.has(row.id)"
            @change="togglePick(row, ($event.target as HTMLInputElement).checked)"
          >
        </label>

        <MyTagsTagBody
          :full="row.full"
          :state="view(row)"
          :set-color="setColors[row.tagSet] ?? ''"
          :impact="impact.get(row.full)"
          selectable
          show-impact
          @select="emit('select', row.full)"
          @patch="emit('patch', row, $event)"
        />
      </article>
      </div>
    </div>

    <div v-if="pickedRows.length" class="eqt-taglist__bulk">
      <strong>{{ t('taglist.picked', { n: pickedRows.length }) }}</strong>
      <select
        :value="''"
        @change="emit('move', pickedRows, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t('taglist.moveTo') }}</option>
        <option v-for="s in sets.filter((x) => x.value !== currentSet)" :key="s.value" :value="s.value">
          {{ s.name }}
        </option>
      </select>
      <button type="button" class="eqt-panel__btn" @click="emit('bulk', pickedRows, { watch: true })">
        {{ t('taglist.bulkWatch') }}
      </button>
      <button type="button" class="eqt-panel__btn" @click="emit('bulk', pickedRows, { hidden: true })">
        {{ t('taglist.bulkHide') }}
      </button>
      <span class="eqt-panel__spacer" />
      <button
        type="button" class="eqt-panel__btn"
        @click="emit('remove', pickedRows)"
      >{{ t('panel.labelDelete') }}</button>
      <button type="button" class="eqt-panel__link" @click="picked = new Set()">
        {{ t('taglist.clearPicks') }}
      </button>
    </div>
  </div>
</template>
