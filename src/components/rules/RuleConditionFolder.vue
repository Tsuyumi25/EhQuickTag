<script setup lang="ts">
import { FolderOpen, X } from '@lucide/vue'
import RuleConditionList from './RuleConditionList.vue'
import { t } from '@/composables/useI18n'
import type { ConditionFolder, FolderMode } from '@/services/listing/fixedRulePrototype'

defineProps<{ folder: ConditionFolder; depth: number }>()
const emit = defineEmits<{ remove: [] }>()
const MODES: readonly FolderMode[] = ['all', 'any', 'none']
</script>

<template>
  <div class="eqt-rule-page__folder" :class="`eqt-rule-page__folder--${folder.mode}`">
    <span class="eqt-rule-page__folder-head" :title="t('rulePagePrototype.folder')">
      <FolderOpen class="eqt-rule-page__icon" />
      <select v-model="folder.mode" class="eqt-rule-page__inline-select" :aria-label="t('rulePagePrototype.folderMode')">
        <option v-for="mode in MODES" :key="mode" :value="mode">{{ t(`rulePagePrototype.folderMode.${mode}`) }}</option>
      </select>
    </span>
    <RuleConditionList :conditions="folder.conditions" :depth="depth" :empty-hint="t('rulePagePrototype.emptyFolder')" />
    <button
      type="button" class="eqt-rule-page__chip-remove"
      :aria-label="t('rulePagePrototype.removeFolder')" :title="t('rulePagePrototype.removeFolder')"
      @click="emit('remove')"
    ><X /></button>
  </div>
</template>
