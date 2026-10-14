<script setup lang="ts">
import Draggable from 'vuedraggable'
import RuleActionSegment from './RuleActionSegment.vue'
import RuleConditionGroup from './RuleConditionGroup.vue'
import RuleRangeChip from './RuleRangeChip.vue'
import RuleTagChip from './RuleTagChip.vue'
import { RULE_CONDITIONS_GROUP, fitsGroupDepth, ruleDragOptions } from './ruleDrag'
import { hasActions, itemHeight, type FixedConditionItem } from '@/services/listing/fixedRulePrototype'

// 條件樹直接就地改：跨清單拖曳時來源與目標各自 splice，若改成往上 emit 新陣列，
// 同一個群組內「拖進子群組」會讓後到的那次 emit 拿舊 props 蓋掉先到的那次。
// branching：上一層是 OR，每個子項各是一條支線，一條一行、行尾都能接動作。
// AND 底下的條件照樣橫排；從 OR 拖過來時已經帶著動作的，照樣把動作畫出來，生效中的東西不能藏起來
defineProps<{ conditions: FixedConditionItem[]; emptyHint: string; depth: number; branching: boolean }>()

const group = { name: RULE_CONDITIONS_GROUP, put: fitsGroupDepth }
</script>

<template>
  <Draggable
    :list="conditions" item-key="id" v-bind="ruleDragOptions" :group="group"
    class="eqt-rule-page__tray" :class="{ 'eqt-rule-page__tray--branches': branching }"
    :data-depth="depth" :data-empty="emptyHint"
  >
    <template #item="{ element: item, index }">
      <RuleConditionGroup
        v-if="item.kind === 'group'" class="eqt-rule-page__item" :data-height="itemHeight(item)"
        :group="item" :depth="depth + 1" @remove="conditions.splice(index, 1)"
      />
      <div v-else class="eqt-rule-page__item eqt-rule-page__leaf" data-height="0" :data-kind="item.kind">
        <RuleTagChip v-if="item.kind === 'tag'" :condition="item" @remove="conditions.splice(index, 1)" />
        <RuleRangeChip v-else :condition="item" @remove="conditions.splice(index, 1)" />
        <RuleActionSegment v-if="branching || hasActions(item.actions)" :actions="item.actions" />
      </div>
    </template>
  </Draggable>
</template>
