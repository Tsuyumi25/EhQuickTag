<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from '@lucide/vue'
import ContextMenu from '@/components/ContextMenu.vue'
import RuleActionsEditor from './RuleActionsEditor.vue'
import RuleActionSummary from './RuleActionSummary.vue'
import RuleConditionList from './RuleConditionList.vue'
import { t } from '@/composables/useI18n'
import { rulesCollapsed } from '@/services/appOverlays'
import { GROUP_MODE_OPERATORS, GROUP_MODES, type ConditionGroup } from '@/services/listing/fixedRulePrototype'

// root：規則本身的那個群組，不能刪也不能拖，標題用 section 的字級；它的動作就是整條規則的預設。
// depth 是這個群組裡那份清單在根底下第幾層（根的清單是 0），拖曳時用來擋超過上限的巢狀
const props = withDefaults(defineProps<{ group: ConditionGroup; depth: number; root?: boolean }>(), { root: false })
const emit = defineEmits<{ remove: [] }>()

// 跟 AND / OR 一樣是運算子，不翻譯
const NEGATE_LABELS = ['IS', 'IS NOT'] as const

function toggleMode(): void {
  props.group.mode = props.group.mode === 'all' ? 'any' : 'all'
}

const actionsOpen = ref(false)
const actionsTrigger = ref<HTMLButtonElement | null>(null)
// 選單 Teleport 到 body，規則頁收起來預覽時不會跟著藏起來
watch(rulesCollapsed, () => { actionsOpen.value = false })
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
      <button
        ref="actionsTrigger" type="button" class="eqt-rule-page__segment"
        :style="group.actions.background ? { '--eqt-rule-page-seg': group.actions.background } : undefined"
        :title="t('rulePrototype.actions')" aria-haspopup="dialog" :aria-expanded="actionsOpen"
        @click="actionsOpen = !actionsOpen"
      >
        <RuleActionSummary v-bind="group.actions" />
      </button>
      <ContextMenu
        v-model:open="actionsOpen" :anchor-el="actionsTrigger" :ignore="[actionsTrigger]"
        auto-focus aria-role="dialog" :aria-label="t('rulePrototype.actions')" placement="bottom-start"
      >
        <RuleActionsEditor :actions="group.actions" />
      </ContextMenu>
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
