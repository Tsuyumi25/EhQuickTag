<script setup lang="ts">
import { computed } from 'vue'
import { Eye, EyeOff, Tag } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import type { BlurAction } from '@/services/listing/fixedRulePrototype'

// verbose：情境裡要讀得出做了什麼，每一項都寫成字；空間小的地方只放圖示
const props = defineProps<{ background: string | null; blur: BlurAction; showName: boolean; verbose?: boolean }>()

const colorName = computed(() => props.background ?? '')
const empty = computed(() => !props.background && props.blur === 'unchanged' && !props.showName)
</script>

<template>
  <span class="eqt-rule-page__action-summary" :class="{ 'eqt-rule-page__action-summary--verbose': verbose }">
    <span v-if="background" class="eqt-rule-page__action-item">
      <span
        class="eqt-rule-page__action-swatch" :style="{ '--eqt-rule-page-color-preview': background }"
        :role="verbose ? undefined : 'img'" :aria-label="verbose ? undefined : t('rulePagePrototype.backgroundIs', { color: colorName })"
        :title="t('rulePagePrototype.backgroundIs', { color: colorName })"
      />
      <template v-if="verbose">{{ t('rulePagePrototype.backgroundIs', { color: colorName }) }}</template>
    </span>
    <span v-if="blur !== 'unchanged'" class="eqt-rule-page__action-item">
      <component
        :is="blur === 'blur' ? EyeOff : Eye" class="eqt-rule-page__action-icon"
        :role="verbose ? undefined : 'img'" :aria-hidden="verbose || undefined"
        :aria-label="verbose ? undefined : t(blur === 'blur' ? 'rulePrototype.blur' : 'rulePagePrototype.clear')"
      />
      <template v-if="verbose">{{ t(blur === 'blur' ? 'rulePrototype.blur' : 'rulePagePrototype.clear') }}</template>
    </span>
    <span v-if="showName" class="eqt-rule-page__action-item">
      <Tag
        class="eqt-rule-page__action-icon" :role="verbose ? undefined : 'img'" :aria-hidden="verbose || undefined"
        :aria-label="verbose ? undefined : t('rulePagePrototype.showNameShort')"
      />
      <template v-if="verbose">{{ t('rulePagePrototype.showNameShort') }}</template>
    </span>
    <span v-if="empty">{{ t('rulePagePrototype.noAction') }}</span>
  </span>
</template>
