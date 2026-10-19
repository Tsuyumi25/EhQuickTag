<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Bold, CircleQuestionMark, EyeClosed, Italic, Paintbrush, Strikethrough, Underline } from '@lucide/vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import EqtNumberField from '@/components/EqtNumberField.vue'
import RuleActionPreview from '@/components/rules/RuleActionPreview.vue'
import RuleColorField from '@/components/rules/RuleColorField.vue'
import { t } from '@/composables/useI18n'
import { COVER_BLUR_MODES, MAX_RADIUS, normalizePrefix, type GalleryRule } from '@/services/listing/galleryRules'
import { ACTION_TARGETS, targetInUse, type ActionTarget } from '@/services/listing/ruleActionItems'

// 拿整條規則：預覽的規則按鈕要用到規則名稱
const props = defineProps<{ rule: GalleryRule }>()
const actions = computed(() => props.rule.actions)

const target = ref<ActionTarget>('card')
// v-for 底下的陣列 ref 不保證照清單順序，照索引自己收
const tabs: (HTMLButtonElement | null)[] = []

// 上下鍵在分頁之間移動，跟一般的直式分頁一樣
async function moveTab(event: KeyboardEvent) {
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const index = (ACTION_TARGETS.indexOf(target.value) + step + ACTION_TARGETS.length) % ACTION_TARGETS.length
  target.value = ACTION_TARGETS[index]
  await nextTick()
  tabs[index]?.focus()
}

// 輸入法組字中間的半成品也會觸發 input，等離開欄位再收
function setPrefix(event: Event) {
  const input = event.target as HTMLInputElement
  actions.value.prefix = normalizePrefix(input.value)
  input.value = actions.value.prefix ?? ''
}

function setAmount(key: 'dim' | 'blur', event: Event) {
  actions.value[key] = Number((event.target as HTMLInputElement).value)
}

const TITLE_STYLES = [
  { key: 'bold', icon: Bold, label: 'rulePage.boldShort' },
  { key: 'italic', icon: Italic, label: 'rulePage.italicShort' },
  { key: 'underline', icon: Underline, label: 'rulePage.underlineShort' },
  { key: 'strike', icon: Strikethrough, label: 'rulePage.strikeShort' },
] as const

const hideHelpAnchor = ref<HTMLElement | null>(null)
const hideHelpOpen = ref(false)
</script>

<template>
  <h2><Paintbrush class="eqt-rule-page__icon" />{{ t('listingRules.actions') }}</h2>
  <div class="eqt-rule-page__actions">
    <!-- 動作作用在圖庫卡片的哪個位置：一頁一個位置，有設定的那幾頁左邊畫一條綠色條 -->
    <div class="eqt-rule-page__action-tabs" role="tablist" aria-orientation="vertical" :aria-label="t('listingRules.actions')">
      <button
        v-for="(name, index) in ACTION_TARGETS" :id="`eqt-rule-action-tab-${name}`" :key="name"
        :ref="el => { tabs[index] = el as HTMLButtonElement | null }"
        type="button" role="tab" class="eqt-rule-page__action-tab"
        :class="{ 'eqt-rule-page__action-tab--in-use': targetInUse(actions, name) }"
        :aria-selected="target === name" :aria-controls="`eqt-rule-action-panel-${name}`" :tabindex="target === name ? 0 : -1"
        @click="target = name" @keydown="moveTab"
      >
        {{ t(`rulePage.target.${name}`) }}
      </button>
    </div>

    <div
      :id="`eqt-rule-action-panel-${target}`" class="eqt-rule-page__action-panel" role="tabpanel"
      :aria-labelledby="`eqt-rule-action-tab-${target}`"
    >
      <!-- 隱藏時圖庫整個不見，其他動作都不作用：整組停用，但值留著，關掉隱藏就回來；分頁照樣能切 -->
      <fieldset class="eqt-rule-page__action-fields" :disabled="actions.hide">
        <template v-if="target === 'card'">
          <RuleColorField v-model="actions.background" :label="t('rulePage.background')" />
          <label class="eqt-rule-page__field eqt-rule-page__amount">
            <span>{{ t('rulePage.dimShort') }}</span>
            <input class="eqt-rule-page__slider" type="range" min="0" max="100" step="1" :value="actions.dim" @input="setAmount('dim', $event)">
            <span class="eqt-rule-page__amount-value">{{ actions.dim }}</span>
          </label>
          <label class="eqt-rule-page__enabled" :title="t('rulePage.showNameHint')">
            <input type="checkbox" :checked="actions.showName" @change="actions.showName = ($event.target as HTMLInputElement).checked" />
            {{ t('rulePage.showName') }}
          </label>
        </template>

        <template v-else-if="target === 'cover'">
          <span class="eqt-rule-page__choice" role="group" :aria-label="t('rulePage.target.cover')">
            <button
              v-for="mode in COVER_BLUR_MODES" :key="mode" type="button" class="eqt-rule-page__choice-item"
              :aria-pressed="actions.blurMode === mode" @click="actions.blurMode = mode"
            >{{ t(mode === 'blur' ? 'rulePage.blurShort' : 'rulePage.mosaicShort') }}</button>
          </span>
          <span class="eqt-rule-page__field eqt-rule-page__amount">
            <input
              class="eqt-rule-page__slider" type="range" min="0" max="100" step="1" :value="actions.blur"
              :aria-label="t(actions.blurMode === 'blur' ? 'rulePage.blurShort' : 'rulePage.mosaicShort')"
              @input="setAmount('blur', $event)"
            >
            <span class="eqt-rule-page__amount-value">{{ actions.blur }}</span>
          </span>
        </template>

        <template v-else-if="target === 'prefix'">
          <label class="eqt-rule-page__field" :title="t('rulePage.titlePrefixHint')">
            <span>{{ t('rulePage.prefix') }}</span>
            <input
              class="eqt-rule-page__input" type="text" :value="actions.prefix ?? ''" autocomplete="off"
              :aria-label="t('rulePage.titlePrefix')"
              @change="setPrefix" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            >
          </label>
          <RuleColorField v-model="actions.prefixColor" :label="t('rulePage.textColor')" />
          <!-- 圓角只在有背景時看得出來，跟背景排在同一行 -->
          <span class="eqt-rule-page__field-row">
            <RuleColorField v-model="actions.prefixBackground" :label="t('rulePage.background')" />
            <span class="eqt-rule-page__field">
              <span>{{ t('rulePage.radius') }}</span>
              <EqtNumberField v-model="actions.prefixRadius" :min="0" :max="MAX_RADIUS" :label="t('rulePage.radius')" />
            </span>
          </span>
        </template>

        <template v-else>
          <RuleColorField v-model="actions.titleColor" :label="t('rulePage.textColor')" />
          <span class="eqt-rule-page__field-row">
            <RuleColorField v-model="actions.titleBackground" :label="t('rulePage.background')" />
            <span class="eqt-rule-page__field">
              <span>{{ t('rulePage.radius') }}</span>
              <EqtNumberField v-model="actions.titleRadius" :min="0" :max="MAX_RADIUS" :label="t('rulePage.radius')" />
            </span>
          </span>
          <span class="eqt-rule-page__choice" role="group" :aria-label="t('rulePage.target.title')">
            <button
              v-for="style in TITLE_STYLES" :key="style.key" type="button" class="eqt-rule-page__choice-item"
              :aria-pressed="actions[style.key]" :aria-label="t(style.label)" :title="t(style.label)"
              @click="actions[style.key] = !actions[style.key]"
            ><component :is="style.icon" class="eqt-rule-page__icon" /></button>
          </span>
        </template>
      </fieldset>

      <!-- 隱藏也是對整張卡片做的事；它自己不在停用的那組裡，才關得掉 -->
      <div v-if="target === 'card'" class="eqt-rule-page__hide-row">
        <button type="button" class="eqt-rule-page__hide" :aria-pressed="actions.hide" @click="actions.hide = !actions.hide">
          <EyeClosed class="eqt-rule-page__icon" />{{ t('rulePage.hideShort') }}
        </button>
        <button
          ref="hideHelpAnchor" type="button" class="eqt-rule-page__help" :aria-label="t('rulePage.hideHelp')"
          @mouseenter="hideHelpOpen = true" @mouseleave="hideHelpOpen = false"
          @focus="hideHelpOpen = true" @blur="hideHelpOpen = false"
        ><CircleQuestionMark class="eqt-rule-page__icon" /></button>
        <AnchoredPopover v-model:open="hideHelpOpen" :anchor="hideHelpAnchor" placement="top-start">
          <p class="eqt-rule-page__help-tip" role="tooltip">{{ t('rulePage.hideHelp') }}</p>
        </AnchoredPopover>
      </div>
    </div>

    <RuleActionPreview :rule="rule" />
  </div>
</template>
