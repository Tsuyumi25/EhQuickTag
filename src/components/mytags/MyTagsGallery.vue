<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/composables/useI18n'
import { useTagLabel } from '@/composables/useTagLabel'
import TagChip from '@/components/TagChip.vue'
import {
  myTagsGalleryColorsEnabled, myTagsGalleryScoresEnabled, myTagsGalleryMarksEnabled,
} from '@/services/store'
import type { GalleryDetail } from '@/composables/useEhGalleryPreview'
import type { TagColors } from '@/services/mytags/mytagsColors'
import type { Verdict } from '@/services/mytags/mytagsSamples'
import type { Outcome } from '@/services/mytags/mytagsScore'

const props = defineProps<{
  detail: GalleryDetail
  /** 這本的去向，跟格子上顯示的是同一份 */
  outcome: Outcome | null
  /** 編輯器裡此刻的配色與 watch；不在清單裡、或正要刪掉的標籤不在這份裡 */
  appearance: Map<string, { colors: TagColors; watch: boolean }>
  verdict: Verdict | undefined
  loading: boolean
  threshold: number | null
}>()

const emit = defineEmits<{
  close: []
  setVerdict: [Verdict | null]
  pickTag: [string]
}>()

/** 在使用者清單裡的標籤要標出來——那是它為什麼落在這一邊的原因 */
const weighted = computed(() => new Map(
  (props.outcome?.parts ?? []).map((p) => [p.tag, p.weight])))

const hidden = computed(() => new Set(props.outcome?.hiddenBy ?? []))

const { label } = useTagLabel()

const chips = computed(() => props.detail.tags.map((tag) => {
  const view = label.value(tag.full)
  const at = props.appearance.get(tag.full)
  return {
    full: tag.full,
    tier: tag.tier,
    // 跨 ns 混排，不標前綴會分不出來
    display: `${view.nsLabel}:${view.display}`,
    iconUrl: view.iconUrl,
    colors: myTagsGalleryColorsEnabled.value ? at?.colors : undefined,
    watch: at?.watch ?? false,
    weight: weighted.value.get(tag.full) ?? undefined,
    hidden: hidden.value.has(tag.full),
  }
}))

function url(): string {
  return `${location.origin}/g/${props.detail.gid}/${props.detail.token}/`
}
</script>

<template>
  <section class="eqt-gal">
    <header class="eqt-gal__head">
      <button
        type="button"
        class="eqt-panel__btn eqt-gal__verdict"
        :class="{ 'eqt-gal__verdict--block': verdict === 'block' }"
        @click="emit('setVerdict', verdict === 'block' ? null : 'block')"
      >{{ t('preview.shouldBlock') }}</button>
      <button
        type="button"
        class="eqt-panel__btn eqt-gal__verdict"
        :class="{ 'eqt-gal__verdict--keep': verdict === 'keep' }"
        @click="emit('setVerdict', verdict === 'keep' ? null : 'keep')"
      >{{ t('preview.shouldKeep') }}</button>
      <a :href="url()" target="_blank" rel="noopener" class="eqt-panel__btn eqt-gal__open">
        {{ t('gallery.open') }}
      </a>
      <button
        type="button"
        class="eqt-panel__btn eqt-gal__close"
        :aria-label="t('settings.close')"
        @click="emit('close')"
      >X</button>
    </header>

    <div class="eqt-gal__scroll">
      <div class="eqt-gal__body">
        <aside class="eqt-gal__side">
          <!-- 封面和縮圖都是 EH 算好的 background 定位，整段照抄 -->
          <div class="eqt-gal__cover" :style="detail.coverStyle" />
          <div class="eqt-gal__titles">
            <strong>{{ detail.title }}</strong>
            <p v-if="detail.titleJp" class="eqt-panel__hint">{{ detail.titleJp }}</p>
          </div>
          <p class="eqt-panel__hint">
            {{ detail.category }}<template v-if="detail.uploader"> · {{ detail.uploader }}</template>
          </p>
          <p v-if="detail.rating" class="eqt-panel__hint">{{ detail.rating }}</p>
          <dl class="eqt-gal__facts">
            <template v-for="f in detail.facts" :key="f.label">
              <dt>{{ f.label }}</dt><dd>{{ f.value }}</dd>
            </template>
          </dl>
        </aside>

        <div class="eqt-gal__main">
          <!-- ⭐ 沿用畫廊頁那套 chip：原生的 gt / gtl / gtw 外框（EH 用它表示這個標籤
               確不確定），加上翻譯過的名稱。在你清單裡的另外帶權重 -->
          <div class="eqt-gal__tags">
            <TagChip
              v-for="chip in chips"
              :key="chip.full"
              :full="chip.full"
              :display="chip.display"
              :icon-url="chip.iconUrl"
              :tier="chip.tier"
              :colors="chip.colors"
              :weight="chip.weight"
              :hidden="chip.hidden"
              :watch="chip.watch"
              :show-score="myTagsGalleryScoresEnabled"
              :show-marks="myTagsGalleryMarksEnabled"
              :title="chip.full"
              @pick="emit('pickTag', chip.full)"
            />
          </div>

          <!-- popup 收掉之後，加總和門檻只剩這裡講得到 -->
          <p v-if="outcome" class="eqt-gal__sum">
            <span v-if="outcome.hiddenBy.length" class="eqt-preview__neg">
              {{ t('marked.hiddenBy', { tags: outcome.hiddenBy.join(' · ') }) }}
            </span>
            <span v-else>
              {{ t('preview.sum', { n: outcome.score }) }}
              <template v-if="threshold !== null"> · {{ t('preview.threshold', { n: threshold }) }}</template>
            </span>
          </p>

          <p v-if="loading" class="eqt-panel__hint">{{ t('gallery.loading') }}</p>
          <div v-else class="eqt-gal__thumbs">
            <a
              v-for="thumb in detail.thumbs"
              :key="thumb.href"
              :href="thumb.href" target="_blank" rel="noopener"
              :title="thumb.label"
            ><span :style="thumb.style" /></a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
