<script setup lang="ts">
import { computed } from 'vue'
import { Eye, EyeOff, Tag } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { COLOR_PRESETS, createActions, hasActions, type BlurAction, type FixedActions } from '@/services/listing/fixedRulePrototype'

// verbose：情境裡要讀得出做了什麼，每一項都寫成字；標題列的箭頭段只有圖示，放得下。
// inherited：上一層一路疊下來的動作。自己沒指定的效果畫成淡色，看得出這一支實際會變成什麼、又不是自己設的
const props = defineProps<{
  background: string | null
  blur: BlurAction
  showName: boolean
  verbose?: boolean
  inherited?: FixedActions
}>()

const from = computed(() => props.inherited ?? createActions())
const own = computed(() => hasActions(props))
const background = computed(() => ({ value: props.background ?? from.value.background, inherited: props.background === null }))
const blur = computed(() => ({ value: props.blur === 'unchanged' ? from.value.blur : props.blur, inherited: props.blur === 'unchanged' }))
const showName = computed(() => ({ value: props.showName || from.value.showName, inherited: !props.showName }))
const colorName = computed(() => {
  const preset = COLOR_PRESETS.find(item => item.value === background.value.value)
  return preset ? t(preset.labelKey) : background.value.value ?? ''
})
const empty = computed(() => !background.value.value && blur.value.value === 'unchanged' && !showName.value.value)
</script>

<template>
  <span class="eqt-rule-page__action-summary" :class="{ 'eqt-rule-page__action-summary--verbose': verbose }">
    <span v-if="!own && !empty">{{ t('rulePagePrototype.inherited') }}</span>
    <span
      v-if="background.value" class="eqt-rule-page__action-item"
      :class="{ 'eqt-rule-page__action-item--inherited': background.inherited }"
    >
      <span
        class="eqt-rule-page__action-swatch" :style="{ background: background.value }"
        :role="verbose ? undefined : 'img'" :aria-label="verbose ? undefined : t('rulePagePrototype.backgroundIs', { color: colorName })"
        :title="t('rulePagePrototype.backgroundIs', { color: colorName })"
      />
      <template v-if="verbose">{{ t('rulePagePrototype.backgroundIs', { color: colorName }) }}</template>
    </span>
    <span
      v-if="blur.value !== 'unchanged'" class="eqt-rule-page__action-item"
      :class="{ 'eqt-rule-page__action-item--inherited': blur.inherited }"
    >
      <component
        :is="blur.value === 'blur' ? EyeOff : Eye" class="eqt-rule-page__action-icon"
        :role="verbose ? undefined : 'img'" :aria-hidden="verbose || undefined"
        :aria-label="verbose ? undefined : t(blur.value === 'blur' ? 'rulePrototype.blur' : 'rulePagePrototype.clear')"
      />
      <template v-if="verbose">{{ t(blur.value === 'blur' ? 'rulePrototype.blur' : 'rulePagePrototype.clear') }}</template>
    </span>
    <span
      v-if="showName.value" class="eqt-rule-page__action-item"
      :class="{ 'eqt-rule-page__action-item--inherited': showName.inherited }"
    >
      <Tag
        class="eqt-rule-page__action-icon" :role="verbose ? undefined : 'img'" :aria-hidden="verbose || undefined"
        :aria-label="verbose ? undefined : t('rulePagePrototype.showNameShort')"
      />
      <template v-if="verbose">{{ t('rulePagePrototype.showNameShort') }}</template>
    </span>
    <span v-if="empty">{{ t('rulePagePrototype.noAction') }}</span>
  </span>
</template>
