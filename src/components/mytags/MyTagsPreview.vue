<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { t } from '@/composables/useI18n'
import type { SampleGallery, Verdict } from '@/services/mytagsSamples'
import {
  mismatchOf, type PreviewItem, type EffectSummary,
} from '@/services/mytagsScore'

const props = defineProps<{
  left: PreviewItem[]
  right: PreviewItem[]
  verdicts: Record<string, Verdict>
  selected: string | null
  effect: (EffectSummary & { label: string }) | null
  busy: string
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

// 換標籤、換篩選之後從頭看起——已經展開的那幾十本跟新的一批沒有關係
watch(() => [props.selected, props.markedOnly], () => {
  limit.value = { left: FLOW_STEP, right: FLOW_STEP }
})

const labels = computed(() => ({
  icon: ['−', '+'], left: t('preview.filterLeft'), right: t('preview.filterRight'),
}))

const total = computed(() => props.left.length + props.right.length)
const flippedSet = computed(() => new Set(props.effect?.moved ?? []))

function items(side: 'left' | 'right'): PreviewItem[] {
  return side === 'left' ? props.left : props.right
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
  <section class="eqt-preview">
    <header class="eqt-preview__toolbar">
      <div>
        <div class="eqt-preview__titlerow">
          <h3 class="eqt-preview__title">{{ t('preview.title') }}</h3>
          <button v-if="selected" type="button" class="eqt-preview__chip" @click="emit('clearTag')">
            {{ selected }} ✕
          </button>
        </div>
        <p class="eqt-panel__hint">
          {{ selected
            ? t('preview.summaryTag', { tag: selected, n: total })
            : t('preview.summaryAll', { n: total }) }}
        </p>
      </div>

      <div class="eqt-preview__controls">
        <label class="eqt-panel__field">
          <input
            type="checkbox" :checked="markedOnly"
            @change="emit('update:markedOnly', ($event.target as HTMLInputElement).checked)"
          >
          {{ t('preview.markedOnly') }}
        </label>
        <button type="button" class="eqt-panel__btn" :disabled="!!busy" @click="emit('refresh')">
          {{ busy || t('preview.refresh') }}
        </button>
      </div>
    </header>

    <!-- ⭐ 只講「N 本換邊」不夠：修好幾本和弄壞幾本是相反的訊號 -->
    <p v-if="effect && effect.moved.length" class="eqt-preview__effect">
      <strong>{{ effect.label }}</strong>
      · {{ t('preview.moved', { n: effect.moved.length }) }}
      <template v-if="effect.fixed || effect.introduced">
        · {{ t('preview.diagnostic', { fixed: effect.fixed, introduced: effect.introduced }) }}
      </template>
    </p>

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
            <strong>{{ i === 0 ? labels.left : labels.right }} {{ items(side).length }}</strong>
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
              :class="{
                [`eqt-preview__tile--${outcomeClass(item)}`]: true,
                'eqt-preview__tile--flipped': flippedSet.has(item.gallery.gid),
              }"
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

  </section>
</template>
