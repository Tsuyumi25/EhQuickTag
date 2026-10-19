<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Funnel } from '@lucide/vue'
import TagChip from '@/components/TagChip.vue'
import { t } from '@/composables/useI18n'
import { previewRuleEffects, type GalleryRule } from '@/services/listing/galleryRules'
import { CARD_MODIFIERS, cardStyle, installMosaicFilters, prefixStyle } from '@/services/listing/ruleCardStyle'
import '@/styles/listing-rules.scss'

// 一張假的縮圖卡片，套上這條規則命中時的效果。class 與 CSS 變數跟列表上的真卡片同一套，
// 樣式表照同一份規則畫，預覽才不會跟實際長得不一樣
const props = defineProps<{ rule: GalleryRule }>()

// 黑底白字：不放任何圖，也不必替別人的圖煩惱版權；字的邊緣夠銳利，模糊與馬賽克一眼看得出來
const COVER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="340" viewBox="0 0 250 340">'
  + '<rect width="250" height="340" fill="#000"/>'
  + '<text x="125" y="170" fill="#fff" font-family="arial, helvetica, sans-serif" font-size="40" font-weight="bold"'
  + ' text-anchor="middle" dominant-baseline="central">Preview</text>'
  + '</svg>',
)}`

const effects = computed(() => previewRuleEffects(props.rule))
const style = computed(() => cardStyle(effects.value))
// 隱藏的卡片在列表上整個不見；預覽留著，改成看得出「會被拿掉」的樣子
const modifiers = computed(() => CARD_MODIFIERS
  .filter(name => name !== 'hidden' && style.value.modifiers[name])
  .map(name => `eqt-listing-rules__gallery--${name}`))
const vars = computed(() => {
  const set: Record<string, string> = {}
  for (const [name, value] of Object.entries(style.value.vars)) if (value !== null) set[name] = value
  return set
})

onMounted(() => installMosaicFilters(document))
</script>

<template>
  <figure class="eqt-rule-page__preview" translate="no">
    <figcaption class="eqt-rule-page__preview-caption">{{ t('rulePage.preview') }}</figcaption>
    <div
      class="eqt-rule-page__preview-card eqt-listing-rules__gallery"
      :class="[modifiers, { 'eqt-rule-page__preview-card--hidden': effects.hide }]" :style="vars"
    >
      <div class="eqt-rule-page__preview-title">
        <span class="glink">
          <span v-if="effects.prefixes.length" class="eqt-listing-rules__mount eqt-listing-rules__prefixes">
            <span
              v-for="prefix in effects.prefixes" :key="prefix.ruleId" class="eqt-listing-rules__prefix" :style="prefixStyle(prefix)"
            >{{ prefix.text }}</span>
          </span>
          <span class="eqt-listing-rules__title-text">{{ t('rulePage.previewTitle') }}</span>
        </span>
      </div>
      <div class="gl3t eqt-rule-page__preview-cover"><img :src="COVER" alt=""></div>
      <div v-if="effects.labels.length" class="eqt-listing-rules__mount eqt-listing-rules__labels">
        <TagChip
          v-for="label in effects.labels" :key="label.ruleId"
          class="eqt-listing-rules__label" :class="{ 'eqt-listing-rules__label--toned': label.tone }"
          :full="label.text" :display="label.text" :show-score="false" :show-marks="false"
          :style="label.tone ? { '--eqt-listing-rules-tone': label.tone } : undefined"
        ><template #lead><Funnel aria-hidden="true" /></template></TagChip>
      </div>
      <div class="eqt-rule-page__preview-tags">
        <span v-for="n in 3" :key="n" class="eqt-rule-page__preview-tag">{{ t('rulePage.previewTag') }}</span>
      </div>
    </div>
    <p v-if="effects.hide" class="eqt-rule-page__preview-note">{{ t('rulePage.previewHidden') }}</p>
  </figure>
</template>
