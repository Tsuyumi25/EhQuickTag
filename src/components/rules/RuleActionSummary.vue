<script setup lang="ts">
import { computed, type Component } from 'vue'
import { EyeClosed, EyeOff, Strikethrough, SunDim, Tag, Type } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import type { FixedActions } from '@/services/listing/fixedRulePrototype'

// verbose：情境裡要讀得出做了什麼，每一項都寫成字；空間小的地方只放圖示
const props = defineProps<FixedActions & { verbose?: boolean }>()

type Item = { key: string; text: string; icon?: Component; swatch?: string }

const items = computed(() => {
  const list: Item[] = []
  if (props.background) {
    list.push({ key: 'background', text: t('rulePagePrototype.backgroundIs', { color: props.background }), swatch: props.background })
  }
  if (props.blur) list.push({ key: 'blur', text: t('rulePrototype.blur'), icon: EyeOff })
  if (props.showName) list.push({ key: 'showName', text: t('rulePagePrototype.showNameShort'), icon: Tag })
  if (props.titlePrefix) {
    list.push({ key: 'titlePrefix', text: t('rulePagePrototype.titlePrefixIs', { prefix: props.titlePrefix }), icon: Type })
  }
  if (props.strike) list.push({ key: 'strike', text: t('rulePagePrototype.strikeShort'), icon: Strikethrough })
  if (props.visibility !== 'normal') {
    list.push({ key: 'visibility', text: t(`rulePagePrototype.${props.visibility}Short`), icon: props.visibility === 'dim' ? SunDim : EyeClosed })
  }
  return list
})
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
