<script setup lang="ts">
import { computed } from 'vue'
import { Ban, Eye } from '@lucide/vue'
import type { TagColors } from '@/services/mytags/mytagsColors'

const props = withDefaults(defineProps<{
  full: string
  display: string
  iconUrl?: string
  tier?: 'gt' | 'gtl' | 'gtw'
  colors?: TagColors
  weight?: number
  hidden?: boolean
  watch?: boolean
  showScore?: boolean
  showMarks?: boolean
  selection?: 'positive' | 'negative'
  vote?: 'up' | 'down' | null
}>(), {
  tier: 'gt',
  hidden: false,
  watch: false,
  showScore: true,
  showMarks: true,
})

defineEmits<{ pick: [] }>()

const personalStyle = computed(() => props.colors ? {
  '--eqt-mytags-background': `#${props.colors.face}`,
  '--eqt-mytags-text': `#${props.colors.text}`,
  '--eqt-mytags-border': `#${props.colors.edge}`,
} : undefined)
</script>

<template>
  <div
    class="eqt-gallery-chip"
    :data-ns-raw="full"
    :style="personalStyle"
    :class="[
      colors && 'eqt-gallery-chip--mytags-colored',
      selection === 'positive' && 'eqt-gallery-chip--selected-positive',
      selection === 'negative' && 'eqt-gallery-chip--selected-negative',
      `eqt-gallery-chip--${tier}`,
      vote === 'up' && 'eqt-gallery-chip--voted-up',
      vote === 'down' && 'eqt-gallery-chip--voted-down',
    ]"
  >
    <button type="button" class="eqt-gallery-chip__body" @click="$emit('pick')">
      <span class="eqt-gallery-chip__name">
        <img v-if="iconUrl" :src="iconUrl" class="eqt-tag-icon" alt="" />{{ display }}
      </span>
      <Eye v-if="showMarks && watch" class="eqt-gallery-chip__watch" />
      <span v-if="(showMarks && hidden) || (showScore && !hidden && weight !== undefined)" class="eqt-gallery-chip__weight">
        <Ban v-if="hidden" />
        <template v-else>{{ weight !== undefined && weight > 0 ? `+${weight}` : weight }}</template>
      </span>
    </button>
  </div>
</template>
