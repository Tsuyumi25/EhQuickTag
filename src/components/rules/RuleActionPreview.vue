<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Funnel } from '@lucide/vue'
import TagChip from '@/components/TagChip.vue'
import { t } from '@/composables/useI18n'
import { previewRuleEffects, type FixedRule } from '@/services/listing/fixedRulePrototype'
import { CARD_MODIFIERS, cardStyle, installMosaicFilters, prefixStyle } from '@/services/listing/ruleCardStyle'
import '@/styles/rule-prototype.scss'

// 一張假的縮圖卡片，套上這條規則命中時的效果。class 與 CSS 變數跟列表上的真卡片同一套，
// 樣式表照同一份規則畫，預覽才不會跟實際長得不一樣
const props = defineProps<{ rule: FixedRule }>()

// 封面要有色塊與細節，模糊與馬賽克才看得出差別；全是幾何形狀，不放任何真的圖
const COVER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="250" height="340" viewBox="0 0 250 340">'
  + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a8fd4"/><stop offset="1" stop-color="#d47aa0"/></linearGradient></defs>'
  + '<rect width="250" height="340" fill="url(#g)"/>'
  + '<circle cx="80" cy="110" r="52" fill="#ffe08a"/>'
  + '<rect x="130" y="170" width="90" height="120" rx="10" fill="#2d3a5c"/>'
  + '<path d="M0 300 L70 230 L140 300 Z" fill="#4c9a6a"/>'
  + '<g stroke="#ffffff" stroke-width="3">'
  + '<line x1="20" y1="20" x2="230" y2="20"/><line x1="20" y1="34" x2="180" y2="34"/><line x1="20" y1="48" x2="200" y2="48"/>'
  + '</g></svg>',
)}`

const effects = computed(() => previewRuleEffects(props.rule))
const style = computed(() => cardStyle(effects.value))
// 隱藏的卡片在列表上整個不見；預覽留著，改成看得出「會被拿掉」的樣子
const modifiers = computed(() => CARD_MODIFIERS
  .filter(name => name !== 'hidden' && style.value.modifiers[name])
  .map(name => `eqt-rule-prototype__gallery--${name}`))
const vars = computed(() => {
  const set: Record<string, string> = {}
  for (const [name, value] of Object.entries(style.value.vars)) if (value !== null) set[name] = value
  return set
})

onMounted(() => installMosaicFilters(document))
</script>

<template>
  <figure class="eqt-rule-page__preview" translate="no">
    <figcaption class="eqt-rule-page__preview-caption">{{ t('rulePagePrototype.preview') }}</figcaption>
    <div
      class="eqt-rule-page__preview-card eqt-rule-prototype__gallery"
      :class="[modifiers, { 'eqt-rule-page__preview-card--hidden': effects.hide }]" :style="vars"
    >
      <div class="eqt-rule-page__preview-title">
        <span class="glink">
          <span v-if="effects.prefixes.length" class="eqt-rule-prototype__mount eqt-rule-prototype__prefixes">
            <span
              v-for="prefix in effects.prefixes" :key="prefix.ruleId" class="eqt-rule-prototype__prefix" :style="prefixStyle(prefix)"
            >{{ prefix.text }}</span>
          </span>
          <span class="eqt-rule-prototype__title-text">{{ t('rulePagePrototype.previewTitle') }}</span>
        </span>
      </div>
      <div class="gl3t eqt-rule-page__preview-cover"><img :src="COVER" alt=""></div>
      <div v-if="effects.labels.length" class="eqt-rule-prototype__mount eqt-rule-prototype__labels">
        <TagChip
          v-for="label in effects.labels" :key="label.ruleId"
          class="eqt-rule-prototype__label" :class="{ 'eqt-rule-prototype__label--toned': label.tone }"
          :full="label.text" :display="label.text" :show-score="false" :show-marks="false"
          :style="label.tone ? { '--eqt-rule-prototype-tone': label.tone } : undefined"
        ><template #lead><Funnel aria-hidden="true" /></template></TagChip>
      </div>
      <div class="eqt-rule-page__preview-tags">
        <span v-for="n in 3" :key="n" class="eqt-rule-page__preview-tag">{{ t('rulePagePrototype.previewTag') }}</span>
      </div>
    </div>
    <p v-if="effects.hide" class="eqt-rule-page__preview-note">{{ t('rulePagePrototype.previewHidden') }}</p>
  </figure>
</template>
