<script setup lang="ts">
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import { t } from '@/composables/useI18n'
import { parseColorInput } from '@/services/color'
import { normalizeTitlePrefix, type FixedActions } from '@/services/listing/fixedRulePrototype'

const props = defineProps<{ actions: FixedActions }>()

// 模糊、淡化、隱藏是同一件事的三種強度，排在同一行；其他各佔一行
const FLAG_ROWS = [
  [
    { key: 'blur', label: 'rulePrototype.blur' },
    { key: 'dim', label: 'rulePagePrototype.dim' },
    { key: 'hide', label: 'rulePagePrototype.hide' },
  ],
  [{ key: 'showName', label: 'rulePagePrototype.showName', hint: 'rulePagePrototype.showNameHint' }],
  [{ key: 'strike', label: 'rulePagePrototype.strike' }],
] as const

// 跟 My Tags 的標籤顏色同一組：色盤選、或直接貼色碼；色碼框留空就是不上色
function onHexInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (!raw.trim()) props.actions.background = null
  else {
    const color = parseColorInput(raw, true)
    if (color) props.actions.background = color
  }
}

function resetInput(event: Event, value: string | null) {
  (event.target as HTMLInputElement).value = value ?? ''
}

// 輸入法組字中間的半成品也會觸發 input，等離開欄位再收
function setTitlePrefix(event: Event) {
  props.actions.titlePrefix = normalizeTitlePrefix((event.target as HTMLInputElement).value)
  resetInput(event, props.actions.titlePrefix)
}

function toggle(key: (typeof FLAG_ROWS)[number][number]['key'], event: Event) {
  props.actions[key] = (event.target as HTMLInputElement).checked
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
          @input="onHexInput" @blur="resetInput($event, actions.background)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        >
      </span>
    </div>
    <label class="eqt-rule-page__field" :title="t('rulePagePrototype.titlePrefixHint')">
      <span>{{ t('rulePagePrototype.titlePrefix') }}</span>
      <input
        class="eqt-rule-page__input" type="text" :value="actions.titlePrefix ?? ''" autocomplete="off"
        @change="setTitlePrefix" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      >
    </label>
    <div v-for="row in FLAG_ROWS" :key="row[0].key" class="eqt-rule-page__action-row">
      <label
        v-for="flag in row" :key="flag.key" class="eqt-rule-page__enabled"
        :title="'hint' in flag ? t(flag.hint) : undefined"
      >
        <input type="checkbox" :checked="actions[flag.key]" @change="toggle(flag.key, $event)" />
        {{ t(flag.label) }}
      </label>
    </div>
  </div>
</template>
