<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { t } from '@/composables/useI18n'
import { useTagLabel } from '@/composables/useTagLabel'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import type { MyTagRow, TagSetRef } from '@/composables/useEhMyTagsHost'
import type { EditMap, TagState } from '@/services/mytagsEdits'
import { effective } from '@/services/mytagsEdits'
import type { TagImpact } from '@/services/mytagsScore'
import { tagColors } from '@/services/mytagsColors'
import type { TagFilter } from '@/services/mytagsEditStore'

const props = defineProps<{
  rows: MyTagRow[]
  edits: EditMap
  selected: string | null
  sets: TagSetRef[]
  currentSet: string
  /** 每個標籤在目前樣本裡的去向分佈 */
  impact: Map<string, TagImpact>
  /** 有 fixture 的時候的全庫分佈，只放進 tooltip */
  wholeDb: Map<string, TagImpact> | null
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

const { label } = useTagLabel()

function view(row: MyTagRow): TagState {
  return effective(row, props.edits)
}

function dirty(row: MyTagRow): boolean {
  return props.edits[row.id] !== undefined
}

/**
 * 標籤的外觀，照 EH 自己的規則算（見 mytagsColors）。
 *
 * ⛔ 不用原生 radial-gradient 的那兩個顏色。EH 的標籤是貼合文字的小方塊，漸層在
 * 那個尺寸下幾乎看不出來；這裡的標籤佔滿一整行，同一個漸層會變成中間一塊橢圓。
 * 取它的中心色當實色，外圈色只留給邊框。
 */
function chipStyle(row: MyTagRow): Record<string, string> {
  const v = view(row)
  const c = tagColors({
    color: v.color,
    setColor: props.setColors[row.tagSet] ?? '',
    weight: v.weight,
    hidden: v.hidden,
  })
  return { color: `#${c.text}`, background: `#${c.face}`, borderColor: `#${c.edge}` }
}

/**
 * 順序凍結在這裡：只在「篩選 / 標籤增減」時重算一次，編輯、套用、選取都不動它。
 *
 * ⛔ 不要改成即時重排。調一格權重那一列就會從眼前跑掉。
 */
const order = ref(new Map<number, number>())

function reorder(): void {
  // 最負的排最前面：擋掉最多東西的那些最常要調
  const sorted = [...props.rows]
    .sort((a, b) => a.weight - b.weight || a.full.localeCompare(b.full))
  order.value = new Map(sorted.map((r, i) => [r.id, i]))
}

watch(
  () => [props.filter.set, props.filter.status, props.rows.length],
  reorder,
  { immediate: true },
)

const visible = computed(() => {
  const at = order.value
  return props.rows.filter((row) => {
    const v = view(row)
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

// 換篩選之後留在原本的捲動位置多半會落在清單之外，直接回頂
watch(() => [props.filter.set, props.filter.status], () => {
  scrollTop.value = 0
  if (scroller.value) scroller.value.scrollTop = 0
})

function onWeight(row: MyTagRow, e: Event): void {
  const n = parseInt((e.target as HTMLInputElement).value, 10)
  if (Number.isNaN(n)) return          // 打到一半的 "-" 不該讓整片翻面
  emit('patch', row, { weight: Math.max(-99, Math.min(99, n)) })
}

/**
 * ⚠️ ColorPicker 吐的是 8 位 hex（帶 alpha），EH 的 tagcolor 欄位是 maxlength="7"。
 * 多出來的兩位要切掉，不然存回去會被截斷成別的顏色。
 */
function onColor(row: MyTagRow, v: string | undefined): void {
  emit('patch', row, { color: v ? v.slice(0, 7).toUpperCase() : '' })
}

function pct(part: number, total: number): string {
  return total ? `${(part / total * 100).toFixed(1)}%` : '0%'
}

function impactTitle(row: MyTagRow): string {
  const here = props.impact.get(row.full)
  const all = props.wholeDb?.get(row.full)
  const one = here
    ? t('taglist.impact', { left: here.left, right: here.right })
    : t('taglist.impactNone')
  return all
    ? `${one}\n${t('taglist.wholeDb', {
      left: all.left.toLocaleString(), right: all.right.toLocaleString(),
    })}`
    : one
}
</script>

<template>
  <div class="eqt-taglist">
    <div class="eqt-taglist__head">
      <label>
        <input
          type="checkbox" :checked="allPicked"
          @change="toggleAll(($event.target as HTMLInputElement).checked)"
        >
        {{ t('taglist.headLeft', { n: visible.length }) }}
      </label>
      <select
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

        <div class="eqt-taglist__body">
          <!-- 第一行：標籤獨佔一整行，長名字才不會被右邊的控制項擠掉 -->
          <div class="eqt-taglist__top">
            <button
              type="button" class="eqt-taglist__chip"
              :style="chipStyle(row)"
              :title="row.full"
              @click="emit('select', row.full)"
            >
              <span class="eqt-taglist__ns">{{ label(row.full).nsLabel }}:</span>
              <span>{{ label(row.full).display }}</span>
            </button>

            <LineColorSwatch
              :model-value="view(row).color || undefined"
              :title="t('panel.colorHint')"
              @update:model-value="onColor(row, $event)"
            />
          </div>

          <!-- 第二行：可以動的三個東西 -->
          <div class="eqt-taglist__controls">
            <label class="eqt-taglist__flag" :title="t('panel.toggleWatch')">
              <input
                type="checkbox" :checked="view(row).watch"
                @change="emit('patch', row, { watch: ($event.target as HTMLInputElement).checked })"
              >
              {{ t('panel.labelWatch') }}
            </label>
            <label class="eqt-taglist__flag" :title="t('panel.toggleHidden')">
              <input
                type="checkbox" :checked="view(row).hidden"
                @change="emit('patch', row, { hidden: ($event.target as HTMLInputElement).checked })"
              >
              {{ t('panel.labelHidden') }}
            </label>

            <span class="eqt-panel__spacer" />

            <!-- chip 上不再印權重：這一格就是權重，同一件事不用講兩次 -->
            <input
              class="eqt-taglist__weight"
              type="number" min="-99" max="99" step="1"
              :value="view(row).weight" :disabled="view(row).hidden"
              :title="t('panel.weightHint')"
              @input="onWeight(row, $event)"
            >
          </div>

          <!-- 第三行：這個標籤在樣本裡把東西分到哪一邊 -->
          <span class="eqt-taglist__bar" :title="impactTitle(row)">
            <i
              class="eqt-taglist__neg"
              :style="{ width: pct(impact.get(row.full)?.left ?? 0, impact.get(row.full)?.total ?? 0) }"
            />
            <i
              class="eqt-taglist__pos"
              :style="{ width: pct(impact.get(row.full)?.right ?? 0, impact.get(row.full)?.total ?? 0) }"
            />
          </span>
        </div>
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
        type="button" class="eqt-panel__btn eqt-panel__btn--reload"
        @click="emit('remove', pickedRows)"
      >{{ t('panel.labelDelete') }}</button>
      <button type="button" class="eqt-panel__link" @click="picked = new Set()">
        {{ t('taglist.clearPicks') }}
      </button>
    </div>
  </div>
</template>
