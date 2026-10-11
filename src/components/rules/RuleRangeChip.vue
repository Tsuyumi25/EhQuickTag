<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import EqtNumberField from '@/components/EqtNumberField.vue'
import { RANGE_FIELD_ICONS } from './rangeFieldIcons'
import { t } from '@/composables/useI18n'
import { RANGE_FIELDS, RANGE_OPS, type RangeCondition, type RangeOp } from '@/services/listing/fixedRulePrototype'

const props = defineProps<{ condition: RangeCondition }>()
const emit = defineEmits<{ remove: [] }>()
// 運算子只用符號：「不高於」「以下」這類字眼對邊界算不算數各有各的讀法，符號沒有歧義。
// 介於寫成閉區間，下拉選單裡的「[」就是區間的左括號
const OP_SYMBOLS: Record<RangeOp, string> = { eq: '=', lt: '<', lte: '≤', gt: '>', gte: '≥', between: '[' }
const field = computed(() => RANGE_FIELDS[props.condition.kind])
const label = computed(() => t(`rulePagePrototype.${props.condition.kind}`))
// 沒有上限的欄位（頁數）傳 undefined；上限欄留空就是不設上限
const ceiling = computed(() => (Number.isFinite(field.value.max) ? field.value.max : undefined))
</script>

<template>
  <div class="eqt-rule-page__range" data-height="0" :data-kind="condition.kind">
    <component :is="RANGE_FIELD_ICONS[condition.kind]" class="eqt-rule-page__icon" :aria-label="label" />
    <select v-model="condition.op" class="eqt-rule-page__inline-select eqt-rule-page__op" :aria-label="label">
      <option v-for="op in RANGE_OPS" :key="op" :value="op">{{ OP_SYMBOLS[op] }}</option>
    </select>
    <!-- ± 鈕在 chip 裡藏起來，方向鍵與聚焦時的滾輪仍照 step 跳 -->
    <EqtNumberField
      v-model="condition.value" :min="field.min" :max="condition.op === 'between' ? condition.max ?? ceiling : ceiling"
      :step="field.step" :label="label"
    />
    <template v-if="condition.op === 'between'">
      <span aria-hidden="true">~</span>
      <EqtNumberField
        :model-value="condition.max ?? ceiling ?? null" :min="condition.value" :max="ceiling"
        :step="field.step" :label="`${label} ≤`"
        @update:model-value="condition.max = $event"
      />
      <span aria-hidden="true">]</span>
    </template>
    <button
      type="button" class="eqt-rule-page__chip-remove"
      :aria-label="t('rulePrototype.removeCondition')" :title="t('rulePrototype.removeCondition')"
      @click="emit('remove')"
    ><X /></button>
  </div>
</template>
