<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus, UserRound, X } from '@lucide/vue'
import TagChip from '@/components/TagChip.vue'
import { t } from '@/composables/useI18n'
import type { UploaderCondition } from '@/services/listing/galleryRules'

const props = defineProps<{ condition: UploaderCondition }>()
const emit = defineEmits<{ remove: [] }>()
const polarity = computed(() => t(props.condition.exclude ? 'rulePage.excludes' : 'rulePage.contains'))
const full = computed(() => `uploader:${props.condition.uploader}`)
</script>

<template>
  <TagChip
    class="eqt-rule-page__chip" data-height="0" data-kind="uploader"
    :full="full" :display="condition.uploader" :show-score="false" :show-marks="false" :title="full"
  >
    <template #head>
      <button
        type="button" class="eqt-rule-page__polarity"
        :aria-label="`${polarity} · ${t('rulePage.togglePolarity')}`"
        :title="`${polarity} · ${t('rulePage.togglePolarity')}`"
        @click="condition.exclude = !condition.exclude"
      ><Minus v-if="condition.exclude" /><Plus v-else /></button>
    </template>
    <template #lead><UserRound :aria-label="t('rulePage.uploader')" /></template>
    <template #trail>
      <button
        type="button" class="eqt-rule-page__chip-remove"
        :aria-label="t('listingRules.removeCondition')" :title="t('listingRules.removeCondition')"
        @click="emit('remove')"
      ><X /></button>
    </template>
  </TagChip>
</template>
