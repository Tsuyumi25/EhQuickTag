<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { t } from '@/composables/useI18n'
import { useTagLabel } from '@/composables/useTagLabel'
import type { SampleGallery, Verdict } from '@/services/mytagsSamples'
import { EH_CATEGORIES } from '@/services/ehSearchParams'
import { mismatchOf, type PreviewItem } from '@/services/mytagsScore'
import { myTagsPreviewCoverScale } from '@/services/store'

/**
 * EH API 回傳的 category 顯示名稱。key 與 `EH_CATEGORIES` 的 `key` 一致，
 * value 是 gdata API 實際回傳的字串（不保證跟 camelCase 拆開相同）。
 */
const CAT_NAME_OF: Record<string, string> = {
  doujinshi: 'Doujinshi', manga: 'Manga', artistCg: 'Artist CG',
  gameCg: 'Game CG', western: 'Western', nonH: 'Non-H',
  imageSet: 'Image Set', cosplay: 'Cosplay', asianPorn: 'Asian Porn',
  misc: 'Misc',
}

const props = defineProps<{
  left: PreviewItem[]
  right: PreviewItem[]
  verdicts: Record<string, Verdict>
  selected: string | null
  selectedStyle: Record<string, string> | null
  refreshBusy: string
  markedOnly: boolean
  threshold: number | null
  /** 已經攤開在下面的那一本 */
  openedGid: number | null
}>()

const emit = defineEmits<{
  /** 點封面 = 把整本載進來攤開，不是離開這一頁 */
  open: [SampleGallery]
  clearTag: []
  refresh: []
  setVerdict: [number, Verdict | null]
  'update:markedOnly': [boolean]
}>()

/** 一次多顯示幾本。捲到底自動再加一批，見 watchMore */
const FLOW_STEP = 12

const limit = ref({ left: FLOW_STEP, right: FLOW_STEP })

// ---- 分類篩選 ----

/** 被排除的分類名稱（API 字串）。預設全選 = 空集合 */
const excludedCategories = ref(new Set<string>())

const allCatsIncluded = computed(() => excludedCategories.value.size === 0)

function toggleCategory(name: string): void {
  const next = new Set(excludedCategories.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  excludedCategories.value = next
}


// ---- 語言篩選 ----

const allLanguages = ref(true)

// ---- 篩選與分頁 ----

function filterByCategory(list: PreviewItem[]): PreviewItem[] {
  if (allCatsIncluded.value) return list
  return list.filter((item) => !excludedCategories.value.has(item.gallery.category))
}

// 換標籤、換篩選之後從頭看起——已經展開的那幾十本跟新的一批沒有關係
watch(() => [props.selected, props.markedOnly, excludedCategories.value, allLanguages.value], () => {
  limit.value = { left: FLOW_STEP, right: FLOW_STEP }
})

const labels = computed(() => ({
  icon: ['−', '+'], left: t('preview.filterLeft'), right: t('preview.filterRight'),
}))

const total = computed(() => items('left').length + items('right').length)
const { label } = useTagLabel()
const selectedLabel = computed(() => props.selected ? label.value(props.selected) : null)

function items(side: 'left' | 'right'): PreviewItem[] {
  return filterByCategory(side === 'left' ? props.left : props.right)
}

function shown(side: 'left' | 'right'): PreviewItem[] {
  return items(side).slice(0, limit.value[side])
}

function more(side: 'left' | 'right'): void {
  limit.value = { ...limit.value, [side]: limit.value[side] + FLOW_STEP }
}

// 「繼續往下看」捲進視野就自動載入。
// ⚠️ root 必須指到那一欄自己的捲動容器：兩欄各捲各的，用預設的 viewport 當 root
// 的話，另一欄根本沒動也會被判定成「看得到了」
const observers: IntersectionObserver[] = []
function watchMore(el: Element | null, side: 'left' | 'right'): void {
  if (!(el instanceof Element)) return
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) more(side)
  }, { root: el.closest('.eqt-preview__colbody') })
  io.observe(el)
  observers.push(io)
}
onBeforeUnmount(() => observers.forEach((io) => io.disconnect()))

function outcomeClass(item: PreviewItem): string {
  return mismatchOf(item.outcome.side, props.verdicts[String(item.gallery.gid)]) ?? 'none'
}

function metric(item: PreviewItem): string {
  const s = item.outcome.score
  return t('preview.sum', { n: s > 0 ? `+${s}` : s })
}

</script>

<template>
  <section class="eqt-preview" :style="{ '--eqt-preview-cover-scale': myTagsPreviewCoverScale / 100 }">
    <!-- 分類按鈕常駐最上方 -->
    <div class="eqt-preview__cats">
      <button
        v-for="c in EH_CATEGORIES"
        :key="c.bit"
        class="eqt-url-builder__cat cs"
        :class="c.nativeClass"
        :data-disabled="excludedCategories.has(CAT_NAME_OF[c.key]) ? '1' : undefined"
        type="button"
        :aria-pressed="!excludedCategories.has(CAT_NAME_OF[c.key])"
        @click="toggleCategory(CAT_NAME_OF[c.key])"
      >{{ t(`category.${c.key}`) }}</button>
    </div>

    <header class="eqt-preview__toolbar">
      <div class="eqt-preview__titlerow">
        <h3 class="eqt-preview__title">{{ t('preview.title') }}</h3>
        <button
          v-if="selected && selectedLabel"
          type="button"
          class="eqt-taglist__chip"
          :style="selectedStyle"
          :title="selected"
          @click="emit('clearTag')"
        >
          <span class="eqt-taglist__ns">{{ selectedLabel.nsLabel }}:</span>
          <span class="eqt-taglist__label">{{ selectedLabel.display }}</span>
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div class="eqt-preview__controls">
        <label class="eqt-panel__field">
          <input
            type="checkbox"
            :checked="allLanguages"
            @change="allLanguages = ($event.target as HTMLInputElement).checked"
          >
          {{ t('preview.allLanguages') }}
        </label>

        <label class="eqt-panel__field">
          <input
            type="checkbox" :checked="markedOnly"
            @change="emit('update:markedOnly', ($event.target as HTMLInputElement).checked)"
          >
          {{ t('preview.markedOnly') }}
        </label>

        <button type="button" class="eqt-panel__btn" :disabled="!!refreshBusy" @click="emit('refresh')">
          {{ refreshBusy || t('preview.refresh') }}
        </button>
      </div>
    </header>


    <div class="eqt-preview__cols">
      <section
        v-for="(side, i) in (['left', 'right'] as const)"
        :key="side"
        class="eqt-preview__col"
        :class="`eqt-preview__col--${side}`"
      >
        <header class="eqt-preview__colhead">
          <span>
            <span class="eqt-preview__icon">{{ labels.icon[i] }}</span>
            <strong>{{ t('preview.columnCount', {
              side: i === 0 ? labels.left : labels.right,
              shown: items(side).length,
              total,
            }) }}</strong>
          </span>
        </header>

        <!-- 每一欄自己捲：封面一直往下長會把整頁撐得沒完沒了，而且兩欄的量差很多，
             共用一條捲軸的話短的那邊早就到底了還被拖著走 -->
        <div class="eqt-preview__colbody">
          <p v-if="!items(side).length" class="eqt-panel__hint">{{ t('preview.sideEmpty') }}</p>
          <div v-else class="eqt-preview__grid">
            <div
              v-for="item in shown(side)"
              :key="item.gallery.gid"
              class="eqt-preview__tile"
              :class="`eqt-preview__tile--${outcomeClass(item)}`"
            >
              <!-- 點封面把整本載到下面攤開。判斷從一張封面看不出來，尤其是邊緣的那些 -->
              <button
                type="button" class="eqt-preview__cover"
                :class="{ 'eqt-preview__cover--on': openedGid === item.gallery.gid }"
                :title="`${item.gallery.category} · ${item.gallery.title}`"
                @click="emit('open', item.gallery)"
              >
                <img
                  v-if="item.gallery.thumb" :src="item.gallery.thumb"
                  :alt="item.gallery.title" loading="lazy"
                >
                <span v-else class="eqt-preview__nocover">{{ item.gallery.title }}</span>
                <span v-if="outcomeClass(item) === 'over'" class="eqt-preview__flag">
                  {{ t('marked.over') }}
                </span>
                <span v-else-if="outcomeClass(item) === 'leak'" class="eqt-preview__flag">
                  {{ t('marked.leak') }}
                </span>
              </button>

              <div class="eqt-preview__meta">{{ metric(item) }}</div>

              <!-- 再按一次同一顆就是取消，不用第三顆按鈕來清 -->
              <div class="eqt-preview__pick">
                <button
                  type="button"
                  :class="{ 'eqt-preview__pick--on': verdicts[String(item.gallery.gid)] === 'block' }"
                  @click="emit('setVerdict', item.gallery.gid,
                               verdicts[String(item.gallery.gid)] === 'block' ? null : 'block')"
                >{{ t('preview.shouldBlock') }}</button>
                <button
                  type="button"
                  :class="{ 'eqt-preview__pick--on': verdicts[String(item.gallery.gid)] === 'keep' }"
                  @click="emit('setVerdict', item.gallery.gid,
                               verdicts[String(item.gallery.gid)] === 'keep' ? null : 'keep')"
                >{{ t('preview.shouldKeep') }}</button>
              </div>
            </div>
          </div>

          <button
            v-if="limit[side] < items(side).length"
            :ref="(el) => watchMore(el as Element, side)"
            type="button" class="eqt-panel__btn eqt-preview__more"
            @click="more(side)"
            >{{ t('preview.loadMore') }}</button>
        </div>
      </section>
    </div>

    <!-- 封面大小放最底部 -->
    <label class="eqt-panel__field eqt-preview__cover-size">
      {{ t('preview.coverSize') }}
      <input
        v-model.number="myTagsPreviewCoverScale"
        class="eqt-panel__cover-slider"
        type="range"
        min="60"
        max="130"
        step="5"
        :aria-label="t('preview.coverSize')"
      >
      <output class="eqt-panel__cover-value">{{ myTagsPreviewCoverScale }}%</output>
    </label>
  </section>
</template>
