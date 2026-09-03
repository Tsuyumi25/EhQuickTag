<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/composables/useI18n'
import MyTagsChip from '@/components/mytags/MyTagsChip.vue'
import type { GalleryDetail } from '@/composables/useEhGalleryPreview'
import type { Verdict } from '@/services/mytagsSamples'
import type { Outcome } from '@/services/mytagsScore'

const props = defineProps<{
  detail: GalleryDetail
  /** 這本的去向，跟格子上顯示的是同一份 */
  outcome: Outcome | null
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

function url(): string {
  return `${location.origin}/g/${props.detail.gid}/${props.detail.token}/`
}
</script>

<template>
  <section class="eqt-gal">
    <header class="eqt-gal__head">
      <div class="eqt-gal__titles">
        <strong>{{ detail.title }}</strong>
        <p v-if="detail.titleJp" class="eqt-panel__hint">{{ detail.titleJp }}</p>
      </div>
      <a :href="url()" target="_blank" rel="noopener" class="eqt-panel__btn">↗</a>
      <button type="button" class="eqt-panel__btn" @click="emit('close')">✕</button>
    </header>

    <div class="eqt-gal__body">
      <aside class="eqt-gal__side">
        <!-- 封面和縮圖都是 EH 算好的 background 定位，整段照抄 -->
        <div class="eqt-gal__cover" :style="detail.coverStyle" />
        <p class="eqt-panel__hint">
          {{ detail.category }}<template v-if="detail.uploader"> · {{ detail.uploader }}</template>
        </p>
        <p v-if="detail.rating" class="eqt-panel__hint">{{ detail.rating }}</p>
        <dl class="eqt-gal__facts">
          <template v-for="f in detail.facts" :key="f.label">
            <dt>{{ f.label }}</dt><dd>{{ f.value }}</dd>
          </template>
        </dl>

        <div class="eqt-gal__pick">
          <button
            type="button"
            :class="{ 'eqt-gal__pick--block': verdict === 'block' }"
            @click="emit('setVerdict', verdict === 'block' ? null : 'block')"
          >{{ t('preview.shouldBlock') }}</button>
          <button
            type="button"
            :class="{ 'eqt-gal__pick--keep': verdict === 'keep' }"
            @click="emit('setVerdict', verdict === 'keep' ? null : 'keep')"
          >{{ t('preview.shouldKeep') }}</button>
        </div>
      </aside>

      <div class="eqt-gal__main">
        <!-- ⭐ 沿用畫廊頁那套 chip：原生的 gt / gtl / gtw 外框（EH 用它表示這個標籤
             確不確定），加上翻譯過的名稱。在你清單裡的另外帶權重 -->
        <div class="eqt-gal__tags">
          <MyTagsChip
            v-for="tag in detail.tags"
            :key="tag.full"
            :full="tag.full"
            :weight="weighted.get(tag.full) ?? 0"
            :hidden="hidden.has(tag.full)"
            :tier="tag.tier"
            :no-weight="!weighted.has(tag.full) && !hidden.has(tag.full)"
            show-ns
            @pick="emit('pickTag', tag.full)"
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
  </section>
</template>
