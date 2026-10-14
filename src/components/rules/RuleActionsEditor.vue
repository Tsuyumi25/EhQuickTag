<script setup lang="ts">
import { t } from '@/composables/useI18n'
import { BLUR_ACTIONS, COLOR_PRESETS, type BlurAction, type FixedActions } from '@/services/listing/fixedRulePrototype'

const props = defineProps<{ actions: FixedActions }>()

function setBackground(event: Event) {
  props.actions.background = (event.target as HTMLSelectElement).value || null
}

function setBlur(event: Event) {
  props.actions.blur = (event.target as HTMLSelectElement).value as BlurAction
}

function toggleShowName(event: Event) {
  props.actions.showName = (event.target as HTMLInputElement).checked
}
</script>

<template>
  <div class="eqt-rule-page__actions">
    <label class="eqt-rule-page__field">
      <span>{{ t('rulePagePrototype.background') }}</span>
      <select class="eqt-rule-page__select" :value="actions.background ?? ''" @change="setBackground">
        <option value="">{{ t('rulePrototype.colorNone') }}</option>
        <option v-for="preset in COLOR_PRESETS" :key="preset.value" :value="preset.value">{{ t(preset.labelKey) }}</option>
      </select>
      <span v-if="actions.background" class="eqt-rule-page__swatch" :style="{ background: actions.background }" />
    </label>
    <label class="eqt-rule-page__field">
      <span>{{ t('rulePrototype.blur') }}</span>
      <select class="eqt-rule-page__select" :value="actions.blur" @change="setBlur">
        <option v-for="action in BLUR_ACTIONS" :key="action" :value="action">
          {{ t(action === 'blur' ? 'rulePrototype.blur' : `rulePagePrototype.${action}`) }}
        </option>
      </select>
    </label>
    <label class="eqt-rule-page__enabled" :title="t('rulePagePrototype.showNameHint')">
      <input type="checkbox" :checked="actions.showName" @change="toggleShowName" />
      {{ t('rulePagePrototype.showName') }}
    </label>
  </div>
</template>
