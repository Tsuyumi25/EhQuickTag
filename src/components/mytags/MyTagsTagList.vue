<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import MyTagsTagBody from '@/components/mytags/MyTagsTagBody.vue'
import { t } from '@/composables/useI18n'
import { tagSetLabel, type MyTagRow, type TagSetRef } from '@/composables/useEhMyTagsHost'
import type { EditMap, TagPatch, TagState } from '@/services/mytags/mytagsEdits'
import { effective } from '@/services/mytags/mytagsEdits'
import { emptyBulkDraft, type BulkDraft } from '@/services/mytags/mytagsBulk'
import type { TagImpact } from '@/services/mytags/mytagsScore'
import type { TagFilter } from '@/services/mytags/mytagsEditStore'
import { itemsWithin, layoutList, stickyHead } from '@/services/mytags/tagListLayout'

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
  bulkDraft: BulkDraft
  busy: boolean
}>()

const emit = defineEmits<{
  patch: [MyTagRow, Partial<TagState>]
  select: [string]
  'update:filter': [TagFilter]
  'update:bulkDraft': [BulkDraft]
}>()

/**
 * 每一列與分組標題的高度。JS 和 CSS 只有這一個來源——虛擬捲動要靠它換算位置，對不上就會
 * 抖動或空一塊。一列三行：標籤 / 旗標與權重 / 比率條。
 */
const ROW_H = 84
const HEAD_H = 28
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
  if (props.filter.sort === 'set') {
    return setOrder(a.tagSet) - setOrder(b.tagSet)
      || av.weight - bv.weight || a.full.localeCompare(b.full)
  }
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

/** 照 EH 上標籤集的順序；不認得的組排最後 */
function setOrder(tagSet: string): number {
  const at = props.sets.findIndex((set) => set.value === tagSet)
  return at < 0 ? Infinity : at
}

function setName(tagSet: string): string {
  return props.sets.find((set) => set.value === tagSet)?.name ?? tagSet
}

function reorder(): void {
  order.value = new Map([...props.rows].sort(compareRows).map((r, i) => [r.id, i]))
}

watch(
  () => [
    props.filter.set,
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
    switch (props.filter.status) {
      case 'watch': return v.watch
      case 'hidden': return v.hidden
      // 隱藏的標籤權重不進加總，算進哪一邊都會誤導
      case 'negative': return !v.hidden && v.weight < 0
      case 'zero': return !v.hidden && v.weight === 0
      case 'positive': return !v.hidden && v.weight > 0
      case 'uncolored': return v.color === ''
      case 'pending': return dirty(row)
      default: return true
    }
  // 沒排到的（剛載進來的）沉到最後，下一次重排就會歸位
  }).sort((a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity))
})

const pickedIds = computed(() => new Set(props.bulkDraft.ids))

const allPicked = computed(() =>
  visible.value.length > 0 && visible.value.every((r) => pickedIds.value.has(r.id)))

function stageDraft(change: Partial<BulkDraft>): void {
  emit('update:bulkDraft', { ...props.bulkDraft, ...change })
}

function stageIds(next: Set<number>): void {
  if (next.size) stageDraft({ ids: [...next] })
  else emit('update:bulkDraft', emptyBulkDraft())
}

function togglePick(row: MyTagRow, on: boolean): void {
  const next = new Set(props.bulkDraft.ids)
  if (on) next.add(row.id)
  else next.delete(row.id)
  stageIds(next)
}

function clearPicks(): void {
  emit('update:bulkDraft', emptyBulkDraft())
}

function toggleAll(on: boolean): void {
  const next = new Set(props.bulkDraft.ids)
  for (const row of visible.value) {
    if (on) next.add(row.id)
    else next.delete(row.id)
  }
  stageIds(next)
}

const bulkFlag = computed<'watch' | 'hidden' | null>(() => {
  if (props.bulkDraft.patch.watch) return 'watch'
  if (props.bulkDraft.patch.hidden) return 'hidden'
  return null
})

function toggleFlag(flag: 'watch' | 'hidden'): void {
  const patch: TagPatch = bulkFlag.value === flag
    ? {}
    : flag === 'watch'
      ? { watch: true, hidden: false }
      : { hidden: true, watch: false }
  // 設旗標 → 取消刪除（刪都要刪了改旗標沒意義）
  const clearDelete = Object.keys(patch).length && deleting.value
  stageDraft({ patch, ...(clearDelete ? { action: null } : {}) })
}

const deleting = computed(() => props.bulkDraft.action?.kind === 'delete')

const moveTarget = computed(() =>
  props.bulkDraft.action?.kind === 'move' ? props.bulkDraft.action.tagSet : '')

function toggleDelete(): void {
  // 刪除 → 清掉旗標草稿（互斥）
  stageDraft(deleting.value
    ? { action: null }
    : { action: { kind: 'delete' }, patch: {} })
}

// 這裡只排草稿，送不送由底部的套用決定——選一個目的地不該打到伺服器
function pickMove(tagSet: string): void {
  stageDraft({ action: tagSet ? { kind: 'move', tagSet } : null })
}

const layout = computed(() => layoutList(
  visible.value,
  { row: ROW_H, head: HEAD_H },
  props.filter.sort === 'set' ? (row) => row.tagSet : undefined,
))

const stuck = computed(() => stickyHead(layout.value.heads, scrollTop.value))

/**
 * 只畫看得到的那幾列。
 *
 * ⚠️ 一列有七個表單控制項（含原生的 `<input type="color">`），一百多列就是近千個。
 * 卡頓的來源是控制項數量，不是資料量。
 */
const window_ = computed(() => ({
  items: itemsWithin(
    layout.value.items,
    scrollTop.value - OVERSCAN * ROW_H,
    scrollTop.value + viewport.value + OVERSCAN * ROW_H,
  ),
  total: layout.value.total,
}))

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
  () => [props.filter.set, props.filter.sort, props.filter.status],
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
            type="checkbox" :checked="allPicked" :disabled="busy"
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
          <option value="all">{{ t('taglist.allSets') }} ({{ totalCount }})</option>
          <option v-for="s in sets" :key="s.value" :value="s.value">
            {{ tagSetLabel(s) }}
          </option>
        </select>
      </div>
      <div class="eqt-taglist__head-filters">
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
          <option value="set">{{ t('taglist.sortSet') }}</option>
        </select>
        <select
          class="eqt-taglist__statuspick"
          :value="filter.status"
          @change="emit('update:filter', {
            ...filter, status: ($event.target as HTMLSelectElement).value as TagFilter['status'],
          })"
        >
          <option value="all">{{ t('taglist.statusAll') }}</option>
          <option value="watch">{{ t('taglist.statusWatch') }}</option>
          <option value="hidden">{{ t('taglist.statusHidden') }}</option>
          <option value="negative">{{ t('taglist.statusNegative') }}</option>
          <option value="zero">{{ t('taglist.statusZero') }}</option>
          <option value="positive">{{ t('taglist.statusPositive') }}</option>
          <option value="uncolored">{{ t('taglist.statusUncolored') }}</option>
          <option value="pending">{{ t('taglist.statusPending') }}</option>
        </select>
      </div>
    </div>

    <div ref="scroller" class="eqt-taglist__rows" @scroll.passive="onScroll">
      <!-- 負的 margin-bottom 抵掉自己的高度，底下的清單位置不受影響 -->
      <div
        v-if="stuck"
        class="eqt-taglist__group eqt-taglist__group--stuck"
        aria-hidden="true"
        :style="{ height: `${HEAD_H}px`, marginBottom: `-${HEAD_H}px`, transform: `translateY(${stuck.offset}px)` }"
      >
        <span class="eqt-taglist__group-swatch" :style="{ background: setColors[stuck.head.group] || undefined }" />
        <span class="eqt-taglist__group-name">{{ setName(stuck.head.group) }}</span>
        <span class="eqt-taglist__group-count">{{ stuck.head.count }}</span>
      </div>
      <p v-if="!visible.length" class="eqt-panel__hint">{{ t('taglist.empty') }}</p>

      <div v-else class="eqt-taglist__spacer" :style="{ height: `${window_.total}px` }">
      <template v-for="item in window_.items" :key="item.kind === 'head' ? `set:${item.group}` : item.row.id">
      <div
        v-if="item.kind === 'head'"
        class="eqt-taglist__group"
        :style="{ top: `${item.top}px`, height: `${HEAD_H}px` }"
      >
        <span class="eqt-taglist__group-swatch" :style="{ background: setColors[item.group] || undefined }" />
        <span class="eqt-taglist__group-name">{{ setName(item.group) }}</span>
        <span class="eqt-taglist__group-count">{{ item.count }}</span>
      </div>
      <article
        v-else
        class="eqt-taglist__row"
        :style="{ top: `${item.top}px`, height: `${ROW_H}px` }"
        :class="{
          'eqt-taglist__row--on': selected === item.row.full,
          'eqt-taglist__row--dirty': dirty(item.row),
        }"
      >
        <label class="eqt-taglist__check">
          <input
            type="checkbox" :checked="pickedIds.has(item.row.id)" :disabled="busy"
            @change="togglePick(item.row, ($event.target as HTMLInputElement).checked)"
          >
        </label>

        <MyTagsTagBody
          :full="item.row.full"
          :state="view(item.row)"
          :set-color="setColors[item.row.tagSet] ?? ''"
          :impact="impact.get(item.row.full)"
          selectable
          show-impact
          @select="emit('select', item.row.full)"
          @patch="emit('patch', item.row, $event)"
        />
      </article>
      </template>
      </div>
    </div>

    <div v-if="bulkDraft.ids.length" class="eqt-taglist__bulk">
      <div class="eqt-taglist__bulk-head">
        <strong>{{ t('taglist.picked', { n: bulkDraft.ids.length }) }}</strong>
        <button type="button" class="eqt-panel__btn" :disabled="busy" @click="clearPicks">
          {{ t('taglist.clearPicks') }}
        </button>
      </div>
      <div class="eqt-taglist__bulk-actions">
        <button
          type="button" class="eqt-panel__btn"
          :aria-pressed="bulkFlag === 'watch'"
          :disabled="busy"
          @click="toggleFlag('watch')"
        >{{ t('taglist.bulkWatch') }}</button>
        <button
          type="button" class="eqt-panel__btn"
          :aria-pressed="bulkFlag === 'hidden'"
          :disabled="busy"
          @click="toggleFlag('hidden')"
        >{{ t('taglist.bulkHide') }}</button>
      </div>
      <div class="eqt-taglist__bulk-move">
        <select
          class="eqt-panel__setpick"
          :value="moveTarget"
          :disabled="busy"
          :aria-label="t('taglist.moveTo')"
          @change="pickMove(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ t('taglist.moveTo') }}</option>
          <option v-for="s in sets.filter((x) => x.value !== currentSet)" :key="s.value" :value="s.value">
            {{ tagSetLabel(s) }}
          </option>
        </select>
      </div>
      <button
        type="button" class="eqt-panel__btn eqt-taglist__bulk-delete"
        :aria-pressed="deleting"
        :disabled="busy"
        @click="toggleDelete"
      >{{ t('panel.labelDelete') }}</button>
    </div>
  </div>
</template>
