<script setup lang="ts">
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import { t } from '@/composables/useI18n'
import { parseColorInput } from '@/services/color'
import { BLUR_ACTIONS, type BlurAction, type FixedActions } from '@/services/listing/fixedRulePrototype'

const props = defineProps<{ actions: FixedActions }>()

// 跟 My Tags 的標籤顏色同一組：色盤選、或直接貼色碼；色碼框留空就是不上色
function onHexInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (!raw.trim()) props.actions.background = null
  else {
    const color = parseColorInput(raw, true)
    if (color) props.actions.background = color
  }
}

function onHexBlur(event: Event) {
  (event.target as HTMLInputElement).value = props.actions.background ?? ''
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
    <div class="eqt-rule-page__field">
      <span>{{ t('rulePagePrototype.background') }}</span>
      <span class="eqt-rule-page__color-control">
        <LineColorSwatch
          class="eqt-rule-page__color-swatch"
          :model-value="actions.background ?? undefined"
          :style="actions.background ? { '--eqt-rule-page-color-preview': actions.background } : undefined"
          :title="t('rulePagePrototype.background')"
          @update:model-value="actions.background = $event ?? null"
        />
        <input
          class="eqt-rule-page__input eqt-rule-page__color" type="text" :value="actions.background ?? ''"
          placeholder="#rrggbbaa" maxlength="9" spellcheck="false" autocomplete="off"
          :aria-label="t('rulePagePrototype.background')"
          @input="onHexInput" @blur="onHexBlur" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        >
      </span>
    </div>
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
