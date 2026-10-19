<script setup lang="ts">
import { Star } from '@lucide/vue'

// 摘要裡的星等畫成跟列表一樣的星星，不寫數字：讀的人直接拿去跟列表上的星星比
const props = defineProps<{ value: number; label: string }>()
const STARS = [1, 2, 3, 4, 5] as const

function fill(star: number): 'full' | 'half' | 'empty' {
  if (props.value >= star) return 'full'
  return props.value >= star - 0.5 ? 'half' : 'empty'
}
</script>

<template>
  <span class="eqt-rule-page__stars" role="img" :aria-label="`${label} ${value}`">
    <span v-for="star in STARS" :key="star" class="eqt-rule-page__star" :class="`eqt-rule-page__star--${fill(star)}`">
      <Star class="eqt-rule-page__star-back" />
      <Star class="eqt-rule-page__star-front" />
    </span>
  </span>
</template>
