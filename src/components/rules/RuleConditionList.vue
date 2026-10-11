<script setup lang="ts">
import Draggable from 'vuedraggable'
import RuleConditionFolder from './RuleConditionFolder.vue'
import RuleRangeChip from './RuleRangeChip.vue'
import RuleTagChip from './RuleTagChip.vue'
import { RULE_CONDITIONS_GROUP, fitsFolderDepth, ruleDragOptions } from './ruleDrag'
import { itemHeight, type FixedConditionItem } from '@/services/listing/fixedRulePrototype'

// 條件樹直接就地改：跨清單拖曳時來源與目標各自 splice，若改成往上 emit 新陣列，
// 同一個區塊內「拖進子 Folder」會讓後到的那次 emit 拿舊 props 蓋掉先到的那次
withDefaults(defineProps<{ conditions: FixedConditionItem[]; emptyHint: string; depth?: number }>(), { depth: 0 })

const group = { name: RULE_CONDITIONS_GROUP, put: fitsFolderDepth }
</script>

<template>
  <Draggable
    :list="conditions" item-key="id" v-bind="ruleDragOptions" :group="group"
    class="eqt-rule-page__tray" :data-depth="depth" :data-empty="emptyHint"
  >
    <template #item="{ element: item, index }">
      <RuleConditionFolder
        v-if="item.kind === 'folder'" class="eqt-rule-page__item" :data-height="itemHeight(item)"
        :folder="item" :depth="depth + 1" @remove="conditions.splice(index, 1)"
      />
      <RuleTagChip
        v-else-if="item.kind === 'tag'" class="eqt-rule-page__item"
        :condition="item" @remove="conditions.splice(index, 1)"
      />
      <RuleRangeChip v-else class="eqt-rule-page__item" :condition="item" @remove="conditions.splice(index, 1)" />
    </template>
  </Draggable>
</template>
