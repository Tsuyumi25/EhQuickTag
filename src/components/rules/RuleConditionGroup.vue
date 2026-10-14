<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import RuleActionSegment from './RuleActionSegment.vue'
import RuleConditionList from './RuleConditionList.vue'
import { t } from '@/composables/useI18n'
import {
  createActions, GROUP_MODE_OPERATORS, GROUP_MODES, inheritActions, type ConditionGroup, type FixedActions,
} from '@/services/listing/fixedRulePrototype'

// root：規則本身的那個群組，不能刪也不能拖，標題用 section 的字級；它的動作就是整條規則的預設。
// depth 是這個群組裡那份清單在根底下第幾層（根的清單是 0），拖曳時用來擋超過上限的巢狀。
// inherited 是上一層一路疊下來的動作，根群組上面沒有東西
const props = withDefaults(
  defineProps<{ group: ConditionGroup; depth: number; root?: boolean; inherited?: FixedActions }>(),
  { root: false, inherited: createActions },
)
const emit = defineEmits<{ remove: [] }>()
const passed = computed(() => inheritActions(props.group.actions, props.inherited))

// 跟 AND / OR 一樣是運算子，不翻譯
const NEGATE_LABELS = ['IS', 'IS NOT'] as const

function toggleMode(): void {
  props.group.mode = props.group.mode === 'all' ? 'any' : 'all'
}
</script>

<template>
  <div
    class="eqt-rule-page__group"
    :class="[`eqt-rule-page__group--${group.mode}`, { 'eqt-rule-page__group--negate': group.negate, 'eqt-rule-page__group--root': root }]"
  >
    <div class="eqt-rule-page__group-head">
      <!-- 兩種字都疊在同一格，按鈕寬度固定成較寬的那個，切換時後面的字不會跳動 -->
      <button
        type="button" class="eqt-rule-page__segment"
        :class="{ 'eqt-rule-page__segment--on': group.negate }"
        :title="t('rulePagePrototype.negateHint')" @click="group.negate = !group.negate"
      >
        <span
          v-for="(label, index) in NEGATE_LABELS" :key="label"
          :class="{ 'eqt-rule-page__segment-spare': group.negate !== (index === 1) }"
        >{{ label }}</span>
      </button>
      <button
        type="button" class="eqt-rule-page__segment eqt-rule-page__segment--mode"
        :title="t('rulePagePrototype.groupMode')" @click="toggleMode"
      >
        <span
          v-for="mode in GROUP_MODES" :key="mode"
          :class="{ 'eqt-rule-page__segment-spare': group.mode !== mode }"
        >{{ GROUP_MODE_OPERATORS[mode] }}</span>
      </button>
      <RuleActionSegment :actions="group.actions" :inherited="inherited" />
      <button
        v-if="!root" type="button" class="eqt-rule-page__chip-remove"
        :aria-label="t('rulePagePrototype.removeGroup')" :title="t('rulePagePrototype.removeGroup')"
        @click="emit('remove')"
      ><X /></button>
    </div>
    <RuleConditionList
      :conditions="group.conditions" :depth="depth" :branching="group.mode === 'any'" :inherited="passed"
      :empty-hint="t(root ? 'rulePagePrototype.dropHere' : 'rulePagePrototype.emptyGroup')"
    />
  </div>
</template>
