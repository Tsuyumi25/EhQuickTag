<script setup lang="ts">
import { ref, watch } from 'vue'
import ContextMenu from '@/components/ContextMenu.vue'
import RuleActionsEditor from './RuleActionsEditor.vue'
import RuleActionSummary from './RuleActionSummary.vue'
import { t } from '@/composables/useI18n'
import { rulesCollapsed } from '@/services/appOverlays'
import type { FixedActions } from '@/services/listing/fixedRulePrototype'

defineProps<{ actions: FixedActions }>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
// 選單 Teleport 到 body，規則頁收起來預覽時不會跟著藏起來
watch(rulesCollapsed, () => { open.value = false })
</script>

<template>
  <button
    ref="trigger" type="button" class="eqt-rule-page__segment"
    :style="actions.background ? { '--eqt-rule-page-seg': actions.background } : undefined"
    :title="t('rulePrototype.actions')" aria-haspopup="dialog" :aria-expanded="open"
    @click="open = !open"
  >
    <RuleActionSummary v-bind="actions" />
  </button>
  <ContextMenu
    v-model:open="open" :anchor-el="trigger" :ignore="[trigger]"
    auto-focus aria-role="dialog" :aria-label="t('rulePrototype.actions')" placement="bottom-start"
  >
    <RuleActionsEditor :actions="actions" />
  </ContextMenu>
</template>
