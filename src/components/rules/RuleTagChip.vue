<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus, X } from '@lucide/vue'
import TagChip from '@/components/TagChip.vue'
import { useRuleTagView } from '@/composables/useRuleTagView'
import { t } from '@/composables/useI18n'
import type { TagCondition } from '@/services/listing/fixedRulePrototype'

const props = defineProps<{ condition: TagCondition }>()
const emit = defineEmits<{ remove: [] }>()
const view = useRuleTagView(() => props.condition.tag)
const polarity = computed(() => t(props.condition.exclude ? 'rulePagePrototype.excludes' : 'rulePagePrototype.contains'))
</script>

<template>
  <TagChip
    class="eqt-rule-page__chip" data-height="0" data-kind="tag"
    :full="condition.tag" :display="view.text" :icon-url="view.iconUrl" :colors="view.colors"
    :show-score="false" :show-marks="false" :title="condition.tag"
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
