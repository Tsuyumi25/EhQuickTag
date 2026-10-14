<script setup lang="ts">
import { X } from '@lucide/vue'
import RuleConditionList from './RuleConditionList.vue'
import { GROUP_MODE_ICONS } from './groupModeIcons'
import { t } from '@/composables/useI18n'
import { GROUP_MODES, type ConditionGroup } from '@/services/listing/fixedRulePrototype'

// root：規則本身的那個群組，不能刪也不能拖，標題用 section 的字級。
// depth 是這個群組裡那份清單在根底下第幾層（根的清單是 0），拖曳時用來擋超過上限的巢狀
withDefaults(defineProps<{ group: ConditionGroup; depth: number; root?: boolean }>(), { root: false })
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <div
    class="eqt-rule-page__group"
    :class="[`eqt-rule-page__group--${group.mode}`, { 'eqt-rule-page__group--negate': group.negate, 'eqt-rule-page__group--root': root }]"
  >
    <div class="eqt-rule-page__group-head">
      <button
        type="button" class="eqt-rule-page__negate" :aria-pressed="group.negate"
        :title="t('rulePagePrototype.negateHint')" @click="group.negate = !group.negate"
      >{{ t('rulePagePrototype.negate') }}</button>
      <component :is="GROUP_MODE_ICONS[group.mode]" class="eqt-rule-page__icon" />
      <select v-model="group.mode" class="eqt-rule-page__inline-select" :aria-label="t('rulePagePrototype.groupMode')">
        <option v-for="mode in GROUP_MODES" :key="mode" :value="mode">{{ t(`rulePagePrototype.groupMode.${mode}`) }}</option>
      </select>
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
