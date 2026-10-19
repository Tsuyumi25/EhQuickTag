<script setup lang="ts">
import { computed } from 'vue'
import { Ban, Eye } from '@lucide/vue'
import type { TagColors } from '@/services/mytags/mytagsColors'
import { useMyTagsColors } from '@/composables/useMyTagsColors'
import { chipBadges, myTagsVars } from '@/services/mytags/chipBadges'

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

const tagChipStyle = useMyTagsColors()
const personalStyle = computed(() => props.colors ? myTagsVars(tagChipStyle(props.colors)) : undefined)
const badges = computed(() => chipBadges(props))
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
    <slot name="head" />
    <button type="button" class="eqt-gallery-chip__body" @click="$emit('pick')">
      <span v-if="$slots.lead" class="eqt-gallery-chip__lead"><slot name="lead" /></span>
      <span class="eqt-gallery-chip__name">
        <img v-if="iconUrl" :src="iconUrl" class="eqt-tag-icon" alt="" />{{ display }}
      </span>
      <Eye v-if="badges.watch" class="eqt-gallery-chip__watch" />
      <span v-if="badges.hidden || badges.score !== null" class="eqt-gallery-chip__weight">
        <Ban v-if="badges.hidden" />
        <template v-else>{{ badges.score }}</template>
      </span>
    </button>
    <slot name="trail" />
  </div>
</template>
