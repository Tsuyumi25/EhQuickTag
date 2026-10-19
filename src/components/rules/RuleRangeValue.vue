<script setup lang="ts">
import { computed } from 'vue'
import RuleStars from './RuleStars.vue'
import { t } from '@/composables/useI18n'
import type { RangeField, ValueRange } from '@/services/listing/galleryRules'
import { formatRange } from '@/services/listing/ruleDigest'

// 星等只有 0 到 5，摘要把兩端都畫出來（★★★~★★★★★），不留給讀者去推「≥ 3 的另一端在哪」；
// 頁數沒有上限，照舊寫數字
const props = defineProps<{ field: RangeField; range: ValueRange }>()
const label = computed(() => t(`rulePage.${props.field}`))
</script>

<template>
  <span v-if="field === 'rating'" class="eqt-rule-page__range-value">
    <template v-if="range.min > range.max">∅</template>
    <RuleStars v-else-if="range.min === range.max" :value="range.min" :label="label" />
    <template v-else><RuleStars :value="range.min" :label="label" />~<RuleStars :value="range.max" :label="label" /></template>
  </span>
  <span v-else class="eqt-rule-page__range-value">{{ formatRange(field, range) }}</span>
</template>
