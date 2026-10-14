<script setup lang="ts">
import { X } from '@lucide/vue'
import RuleActionSegment from './RuleActionSegment.vue'
import RuleConditionList from './RuleConditionList.vue'
import { t } from '@/composables/useI18n'
import { GROUP_MODE_OPERATORS, GROUP_MODES, type ConditionGroup, type FixedActions } from '@/services/listing/fixedRulePrototype'

// root：規則本身的那個群組，不能刪也不能拖，標題用 section 的字級；整條規則的動作接在它的標題列後面。
// depth 是這個群組裡那份清單在根底下第幾層（根的清單是 0），拖曳時用來擋超過上限的巢狀
const props = withDefaults(
  defineProps<{ group: ConditionGroup; depth: number; root?: boolean; actions?: FixedActions }>(),
  { root: false, actions: undefined },
)
const emit = defineEmits<{ remove: [] }>()

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
      <RuleActionSegment v-if="actions" :actions="actions" />
      <button
        v-if="!root" type="button" class="eqt-rule-page__chip-remove"
        :aria-label="t('rulePagePrototype.removeGroup')" :title="t('rulePagePrototype.removeGroup')"
        @click="emit('remove')"
      ><X /></button>
    </div>
    <RuleConditionList
      :conditions="group.conditions" :depth="depth"
      :empty-hint="t(root ? 'rulePagePrototype.dropHere' : 'rulePagePrototype.emptyGroup')"
    />
  </div>
</template>
