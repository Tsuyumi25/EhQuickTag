<script setup lang="ts">
import { EyeClosed, Paintbrush } from '@lucide/vue'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import { t } from '@/composables/useI18n'
import { parseColorInput } from '@/services/color'
import { normalizeTitlePrefix, type FixedActions } from '@/services/listing/fixedRulePrototype'

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

function resetInput(event: Event, value: string | null) {
  (event.target as HTMLInputElement).value = value ?? ''
}

// 輸入法組字中間的半成品也會觸發 input，等離開欄位再收
function setTitlePrefix(event: Event) {
  props.actions.titlePrefix = normalizeTitlePrefix((event.target as HTMLInputElement).value)
  resetInput(event, props.actions.titlePrefix)
}

function toggle(key: 'blur' | 'strike' | 'showName', event: Event) {
  props.actions[key] = (event.target as HTMLInputElement).checked
}
</script>

<template>
  <div class="eqt-rule-page__actions-head">
    <h2><Paintbrush class="eqt-rule-page__icon" />{{ t('rulePrototype.actions') }}</h2>
    <button
      type="button" class="eqt-rule-page__hide" :aria-pressed="actions.hide" :title="t('rulePagePrototype.hideHint')"
      @click="actions.hide = !actions.hide"
    ><EyeClosed class="eqt-rule-page__icon" />{{ t('rulePagePrototype.hideShort') }}</button>
  </div>
  <!-- 左欄是動作作用在圖庫卡片的哪個位置，新的動作照位置放進對應的那一行。
       隱藏時圖庫整個不見，其他動作都不作用：整組停用，但值留著，關掉隱藏就回來 -->
  <fieldset class="eqt-rule-page__actions" :disabled="actions.hide">
    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.card') }}</span>
    <div class="eqt-rule-page__action-row">
      <span class="eqt-rule-page__field">
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
      </span>
      <span class="eqt-rule-page__choice" role="group" :aria-label="t('rulePagePrototype.visibility')">
        <button
          v-for="dim in [false, true]" :key="String(dim)" type="button" class="eqt-rule-page__choice-item"
          :aria-pressed="actions.dim === dim" @click="actions.dim = dim"
        >{{ t(dim ? 'rulePagePrototype.dimShort' : 'rulePagePrototype.normalShort') }}</button>
      </span>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.cover') }}</span>
    <div class="eqt-rule-page__action-row">
      <label class="eqt-rule-page__enabled">
        <input type="checkbox" :checked="actions.blur" @change="toggle('blur', $event)" />
        {{ t('rulePagePrototype.blurShort') }}
      </label>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.title') }}</span>
    <div class="eqt-rule-page__action-row">
      <label class="eqt-rule-page__field" :title="t('rulePagePrototype.titlePrefixHint')">
        <span>{{ t('rulePagePrototype.prefix') }}</span>
        <input
          class="eqt-rule-page__input" type="text" :value="actions.titlePrefix ?? ''" autocomplete="off"
          :aria-label="t('rulePagePrototype.titlePrefix')"
          @change="setTitlePrefix" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        >
      </label>
      <label class="eqt-rule-page__enabled">
        <input type="checkbox" :checked="actions.strike" @change="toggle('strike', $event)" />
        {{ t('rulePagePrototype.strikeShort') }}
      </label>
    </div>

    <span class="eqt-rule-page__action-target">{{ t('rulePagePrototype.target.tags') }}</span>
    <div class="eqt-rule-page__action-row">
      <label class="eqt-rule-page__enabled" :title="t('rulePagePrototype.showNameHint')">
        <input type="checkbox" :checked="actions.showName" @change="toggle('showName', $event)" />
        {{ t('rulePagePrototype.showName') }}
      </label>
    </div>
  </fieldset>
</template>
