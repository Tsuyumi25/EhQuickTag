<script setup lang="ts">
import { Eye, EyeOff, Tag } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import type { BlurAction } from '@/services/listing/fixedRulePrototype'

defineProps<{ background: string | null; blur: BlurAction; showName: boolean }>()
</script>

<template>
  <span class="eqt-rule-page__action-summary">
    <span
      v-if="background" class="eqt-rule-page__action-swatch" :style="{ background }"
      role="img" :aria-label="t('rulePagePrototype.background')" :title="t('rulePagePrototype.background')"
    />
    <EyeOff v-if="blur === 'blur'" class="eqt-rule-page__action-icon" role="img" :aria-label="t('rulePrototype.blur')" />
    <Eye v-else-if="blur === 'clear'" class="eqt-rule-page__action-icon" role="img" :aria-label="t('rulePagePrototype.clear')" />
    <Tag v-if="showName" class="eqt-rule-page__action-icon" role="img" :aria-label="t('rulePagePrototype.showName')" />
    <span v-if="!background && blur === 'unchanged' && !showName">{{ t('rulePagePrototype.unchanged') }}</span>
  </span>
</template>
