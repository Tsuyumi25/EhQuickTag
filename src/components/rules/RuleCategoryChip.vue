<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus, X } from '@lucide/vue'
import TagChip from '@/components/TagChip.vue'
import { categoryChipStyle } from './categoryChip'
import { t } from '@/composables/useI18n'
import type { CategoryCondition } from '@/services/listing/fixedRulePrototype'
import { CATEGORY_LABELS } from '@/services/listing/galleryCategory'

const props = defineProps<{ condition: CategoryCondition }>()
const emit = defineEmits<{ remove: [] }>()
const label = computed(() => CATEGORY_LABELS[props.condition.category])
const polarity = computed(() => t(props.condition.exclude ? 'rulePagePrototype.excludes' : 'rulePagePrototype.contains'))
</script>

<template>
  <TagChip
    class="eqt-rule-page__chip eqt-gallery-chip--mytags-colored" data-height="0" data-kind="category"
    :style="categoryChipStyle(condition.category)"
    :full="`category:${condition.category}`" :display="label" :show-score="false" :show-marks="false" :title="label"
  >
    <template #head>
      <button
        type="button" class="eqt-rule-page__polarity"
        :aria-label="`${polarity} · ${t('rulePagePrototype.togglePolarity')}`"
        :title="`${polarity} · ${t('rulePagePrototype.togglePolarity')}`"
        @click="condition.exclude = !condition.exclude"
      ><Minus v-if="condition.exclude" /><Plus v-else /></button>
    </template>
    <template #trail>
      <button
        type="button" class="eqt-rule-page__chip-remove"
        :aria-label="t('rulePrototype.removeCondition')" :title="t('rulePrototype.removeCondition')"
        @click="emit('remove')"
      ><X /></button>
    </template>
  </TagChip>
</template>
