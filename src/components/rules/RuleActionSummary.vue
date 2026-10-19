<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Bold, EyeClosed, EyeOff, Italic, Strikethrough, SunDim, Tag, Type, Underline } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import type { FixedActions } from '@/services/listing/fixedRulePrototype'
import { actionItems, type ActionItemKey } from '@/services/listing/ruleActionItems'

// verbose：情境裡要讀得出做了什麼，每一項都寫成字；空間小的地方只放圖示
const props = defineProps<{ actions: FixedActions; verbose?: boolean }>()

const ICONS: Partial<Record<ActionItemKey, Component>> = {
  hide: EyeClosed, dim: SunDim, blur: EyeOff, showName: Tag, prefix: Type,
  bold: Bold, italic: Italic, underline: Underline, strike: Strikethrough,
}

const items = computed(() => actionItems(props.actions).map(item => ({
  key: item.key, text: t(item.message, item.params), icon: ICONS[item.key], swatch: item.swatch,
})))
</script>

<template>
  <span class="eqt-rule-page__action-summary" :class="{ 'eqt-rule-page__action-summary--verbose': verbose }">
    <span v-for="item in items" :key="item.key" class="eqt-rule-page__action-item" :title="item.text">
      <span
        v-if="item.swatch" class="eqt-rule-page__action-swatch" :style="{ '--eqt-rule-page-color-preview': item.swatch }"
        :role="verbose ? undefined : 'img'" :aria-label="verbose ? undefined : item.text"
      />
      <component
        :is="item.icon" v-else-if="item.icon" class="eqt-rule-page__action-icon"
        :role="verbose ? undefined : 'img'" :aria-hidden="verbose || undefined" :aria-label="verbose ? undefined : item.text"
      />
      <template v-if="verbose">{{ item.text }}</template>
    </span>
    <span v-if="!items.length">{{ t('rulePagePrototype.noAction') }}</span>
  </span>
</template>
