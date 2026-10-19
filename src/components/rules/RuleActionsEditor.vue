<script setup lang="ts">
import { ref } from 'vue'
import { Bold, CircleQuestionMark, EyeClosed, Italic, Paintbrush, Strikethrough, Underline } from '@lucide/vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import EqtNumberField from '@/components/EqtNumberField.vue'
import RuleColorField from '@/components/rules/RuleColorField.vue'
import { t } from '@/composables/useI18n'
import { COVER_BLUR_MODES, MAX_RADIUS, normalizePrefix, type FixedActions } from '@/services/listing/fixedRulePrototype'

const props = defineProps<{ actions: FixedActions }>()

// 輸入法組字中間的半成品也會觸發 input，等離開欄位再收
function setPrefix(event: Event) {
  const input = event.target as HTMLInputElement
  props.actions.prefix = normalizePrefix(input.value)
  input.value = props.actions.prefix ?? ''
}

function setAmount(key: 'dim' | 'blur', event: Event) {
  props.actions[key] = Number((event.target as HTMLInputElement).value)
}

const TITLE_STYLES = [
  { key: 'bold', icon: Bold, label: 'rulePagePrototype.boldShort' },
  { key: 'italic', icon: Italic, label: 'rulePagePrototype.italicShort' },
  { key: 'underline', icon: Underline, label: 'rulePagePrototype.underlineShort' },
  { key: 'strike', icon: Strikethrough, label: 'rulePagePrototype.strikeShort' },
] as const

const hideHelpAnchor = ref<HTMLElement | null>(null)
const hideHelpOpen = ref(false)
</script>

<template>
  <h2><Paintbrush class="eqt-rule-page__icon" />{{ t('rulePrototype.actions') }}</h2>
  <!-- 左欄是動作作用在圖庫卡片的哪個位置，新的動作照位置放進對應的那一行。
       隱藏時圖庫整個不見，其他動作都不作用：整組停用，但值留著，關掉隱藏就回來 -->
  <fieldset class="eqt-rule-page__actions" :disabled="actions.hide">
    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.card') }}</span>
    <div class="eqt-rule-page__action-row">
      <RuleColorField v-model="actions.background" :label="t('rulePagePrototype.background')" />
      <label class="eqt-rule-page__field eqt-rule-page__amount">
        <span>{{ t('rulePagePrototype.dimShort') }}</span>
        <input class="eqt-rule-page__slider" type="range" min="0" max="100" step="1" :value="actions.dim" @input="setAmount('dim', $event)">
        <span class="eqt-rule-page__amount-value">{{ actions.dim }}</span>
      </label>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.cover') }}</span>
    <div class="eqt-rule-page__action-row">
      <span class="eqt-rule-page__choice" role="group" :aria-label="t('rulePagePrototype.target.cover')">
        <button
          v-for="mode in COVER_BLUR_MODES" :key="mode" type="button" class="eqt-rule-page__choice-item"
          :aria-pressed="actions.blurMode === mode" @click="actions.blurMode = mode"
        >{{ t(mode === 'blur' ? 'rulePagePrototype.blurShort' : 'rulePagePrototype.mosaicShort') }}</button>
      </span>
      <span class="eqt-rule-page__field eqt-rule-page__amount">
        <input
          class="eqt-rule-page__slider" type="range" min="0" max="100" step="1" :value="actions.blur"
          :aria-label="t(actions.blurMode === 'blur' ? 'rulePagePrototype.blurShort' : 'rulePagePrototype.mosaicShort')"
          @input="setAmount('blur', $event)"
        >
        <span class="eqt-rule-page__amount-value">{{ actions.blur }}</span>
      </span>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.prefix') }}</span>
    <div class="eqt-rule-page__action-row">
      <label class="eqt-rule-page__field" :title="t('rulePagePrototype.titlePrefixHint')">
        <span>{{ t('rulePagePrototype.prefix') }}</span>
        <input
          class="eqt-rule-page__input" type="text" :value="actions.prefix ?? ''" autocomplete="off"
          :aria-label="t('rulePagePrototype.titlePrefix')"
          @change="setPrefix" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        >
      </label>
      <RuleColorField v-model="actions.prefixColor" :label="t('rulePagePrototype.textColor')" />
      <RuleColorField v-model="actions.prefixBackground" :label="t('rulePagePrototype.background')" />
      <span class="eqt-rule-page__field">
        <span>{{ t('rulePagePrototype.radius') }}</span>
        <EqtNumberField v-model="actions.prefixRadius" :min="0" :max="MAX_RADIUS" :label="t('rulePagePrototype.radius')" />
      </span>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.title') }}</span>
    <div class="eqt-rule-page__action-row">
      <RuleColorField v-model="actions.titleColor" :label="t('rulePagePrototype.textColor')" />
      <RuleColorField v-model="actions.titleBackground" :label="t('rulePagePrototype.background')" />
      <span class="eqt-rule-page__field">
        <span>{{ t('rulePagePrototype.radius') }}</span>
        <EqtNumberField v-model="actions.titleRadius" :min="0" :max="MAX_RADIUS" :label="t('rulePagePrototype.radius')" />
      </span>
      <span class="eqt-rule-page__choice" role="group" :aria-label="t('rulePagePrototype.target.title')">
        <button
          v-for="style in TITLE_STYLES" :key="style.key" type="button" class="eqt-rule-page__choice-item"
          :aria-pressed="actions[style.key]" :aria-label="t(style.label)" :title="t(style.label)"
          @click="actions[style.key] = !actions[style.key]"
        ><component :is="style.icon" class="eqt-rule-page__icon" /></button>
      </span>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.tags') }}</span>
    <div class="eqt-rule-page__action-row">
      <label class="eqt-rule-page__enabled" :title="t('rulePagePrototype.showNameHint')">
        <input type="checkbox" :checked="actions.showName" @change="actions.showName = ($event.target as HTMLInputElement).checked" />
        {{ t('rulePagePrototype.showName') }}
      </label>
    </div>
  </fieldset>

  <div class="eqt-rule-page__hide-row">
    <button type="button" class="eqt-rule-page__hide" :aria-pressed="actions.hide" @click="actions.hide = !actions.hide">
      <EyeClosed class="eqt-rule-page__icon" />{{ t('rulePagePrototype.hideShort') }}
    </button>
    <button
      ref="hideHelpAnchor" type="button" class="eqt-rule-page__help" :aria-label="t('rulePagePrototype.hideHelp')"
      @mouseenter="hideHelpOpen = true" @mouseleave="hideHelpOpen = false"
      @focus="hideHelpOpen = true" @blur="hideHelpOpen = false"
    ><CircleQuestionMark class="eqt-rule-page__icon" /></button>
    <AnchoredPopover v-model:open="hideHelpOpen" :anchor="hideHelpAnchor" placement="top-start">
      <p class="eqt-rule-page__help-tip" role="tooltip">{{ t('rulePagePrototype.hideHelp') }}</p>
    </AnchoredPopover>
  </div>
</template>
