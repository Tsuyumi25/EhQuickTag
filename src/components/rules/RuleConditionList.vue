<script setup lang="ts">
import Draggable from 'vuedraggable'
import RuleCategoryChip from './RuleCategoryChip.vue'
import RuleConditionGroup from './RuleConditionGroup.vue'
import RuleRangeChip from './RuleRangeChip.vue'
import RuleTagChip from './RuleTagChip.vue'
import RuleUploaderChip from './RuleUploaderChip.vue'
import { RULE_CONDITIONS_GROUP, fitsGroupDepth, ruleDragOptions } from './ruleDrag'
import { itemHeight, type RuleConditionItem } from '@/services/listing/galleryRules'

// 條件樹直接就地改：跨清單拖曳時來源與目標各自 splice，若改成往上 emit 新陣列，
// 同一個群組內「拖進子群組」會讓後到的那次 emit 拿舊 props 蓋掉先到的那次
defineProps<{ conditions: RuleConditionItem[]; emptyHint: string; depth: number }>()

const group = { name: RULE_CONDITIONS_GROUP, put: fitsGroupDepth }
</script>

<template>
  <Draggable
    :list="conditions" item-key="id" v-bind="ruleDragOptions" :group="group"
    class="eqt-rule-page__tray" :data-depth="depth" :data-empty="emptyHint"
  >
    <template #item="{ element: item, index }">
      <RuleConditionGroup
        v-if="item.kind === 'group'" class="eqt-rule-page__item" :data-height="itemHeight(item)"
        :group="item" :depth="depth + 1" @remove="conditions.splice(index, 1)"
      />
      <RuleTagChip
        v-else-if="item.kind === 'tag'" class="eqt-rule-page__item"
        :condition="item" @remove="conditions.splice(index, 1)"
      />
      <RuleCategoryChip
        v-else-if="item.kind === 'category'" class="eqt-rule-page__item"
        :condition="item" @remove="conditions.splice(index, 1)"
      />
      <RuleUploaderChip
        v-else-if="item.kind === 'uploader'" class="eqt-rule-page__item"
        :condition="item" @remove="conditions.splice(index, 1)"
      />
      <RuleRangeChip v-else class="eqt-rule-page__item" :condition="item" @remove="conditions.splice(index, 1)" />
    </template>
  </Draggable>
</template>
