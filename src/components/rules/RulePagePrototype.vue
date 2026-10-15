<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Draggable from 'vuedraggable'
import { Ellipsis, GripVertical, Plus, Settings, Trash2, X } from '@lucide/vue'
import ContextMenu from '@/components/ContextMenu.vue'
import { baseDragOptions } from '@/utils/drag'
import RuleActionsEditor from './RuleActionsEditor.vue'
import RuleConditionGroup from './RuleConditionGroup.vue'
import RuleDigest from './RuleDigest.vue'
import RuleMaterials from './RuleMaterials.vue'
import RuleTagLibrary from './RuleTagLibrary.vue'
import { useFixedRuleStore } from '@/composables/useFixedRuleStore'
import { t } from '@/composables/useI18n'
import { createRule } from '@/services/listing/fixedRulePrototype'
import { openSettings, requestedRuleId, rulesCollapsed, showSettings } from '@/services/appOverlays'
import '@/styles/rule-page-prototype.scss'

const emit = defineEmits<{ close: [] }>()
const { rules, ready, error } = useFixedRuleStore()
const selectedId = ref<number | null>(null)
const ruleMenuOpen = ref(false)
const ruleMenuId = ref<number | null>(null)
const ruleMenuTrigger = ref<HTMLButtonElement | null>(null)

const selected = computed(() => rules.value.find(rule => rule.id === selectedId.value) ?? null)
watch(() => rules.value.map(rule => rule.id), ids => {
  if (!ids.includes(selectedId.value!)) selectedId.value = ids[0] ?? null
})

let initialized = false
let namedRules = 0
function addRule() {
  namedRules += 1
  const rule = createRule(namedRules)
  rules.value.push(rule)
  selectedId.value = rule.id
}

function removeRule(id: number) {
  const index = rules.value.findIndex(rule => rule.id === id)
  if (index < 0) return
  rules.value.splice(index, 1)
  if (selectedId.value === id) {
    selectedId.value = rules.value[Math.min(index, rules.value.length - 1)]?.id ?? null
  }
}

function rename(event: Event) {
  if (selected.value) selected.value.name = (event.target as HTMLInputElement).value
}

function toggleEnabled(event: Event) {
  if (selected.value) selected.value.enabled = (event.target as HTMLInputElement).checked
}

function toggleRuleMenu(event: MouseEvent, id: number) {
  if (ruleMenuOpen.value && ruleMenuId.value === id) {
    ruleMenuOpen.value = false
    return
  }
  ruleMenuId.value = id
  ruleMenuTrigger.value = event.currentTarget as HTMLButtonElement
  ruleMenuOpen.value = true
}

function removeMenuRule() {
  if (ruleMenuId.value !== null) removeRule(ruleMenuId.value)
  ruleMenuOpen.value = false
}

// 這些元素自己就吃 Space（打字、勾選、按下按鈕、展開下拉），交給它們；只有焦點落在其他地方時才切換預覽
const SPACE_OWNERS = 'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="button"]'
const TABBABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])'

// 規則頁是非模態的：四周露出的搜尋頁照樣能點、能捲，點下去也不會關掉規則頁。
// 最後一次按下或聚焦的位置在搜尋頁上，就代表使用者在操作搜尋頁，Space、Esc 與 Tab 留給搜尋頁自己用。
// 鍵盤要離開規則頁走預覽：預覽時不再接 Tab，焦點能一路走進搜尋頁。
// 預覽、返回與關閉放在列表的 dock 上（ListingRulesPrototype），dock 也算規則頁的一部分
const DOCK = '.eqt-rule-prototype__floating'
const root = ref<HTMLElement | null>(null)
let engaged = true
// 關掉時把焦點還給打開規則頁的那顆按鈕
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

function ownsTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  // 規則操作選單、背景色的色盤與 dock 都不在 root 裡面，但仍是規則頁的一部分
  return !!root.value?.contains(target) || !!target.closest(`.eqt-context-menu, .eqt-anchored-popover, ${DOCK}`)
}

function onPointerdown(event: PointerEvent) {
  if (event.target instanceof Element) engaged = ownsTarget(event.target)
}

function onFocusin(event: FocusEvent) {
  engaged = ownsTarget(event.target)
}

watch(rulesCollapsed, async collapsed => {
  ruleMenuOpen.value = false
  engaged = true
  await nextTick()
  const active = document.activeElement
  // 預覽時規則頁整個藏起來，焦點留在裡面會無處可去，移到 dock 上同一顆按鈕，再按一次就返回
  if (collapsed && root.value?.contains(active)) document.querySelector<HTMLElement>(`${DOCK} .eqt-rule-prototype__preview`)?.focus({ preventScroll: true })
  else if (!collapsed && !ownsTarget(active)) root.value?.focus({ preventScroll: true })
})

function tabbables(): HTMLElement[] {
  const dock = document.querySelector(DOCK)
  return [...root.value?.querySelectorAll<HTMLElement>(TABBABLE) ?? [], ...dock?.querySelectorAll<HTMLElement>(TABBABLE) ?? []]
    .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
}

// 只在頭尾接手：中間照瀏覽器原本的順序走，走到最後一個再繞回第一個，反之亦然
function containTab(event: KeyboardEvent) {
  const items = tabbables()
  const index = items.indexOf(document.activeElement as HTMLElement)
  const target = event.shiftKey
    ? (index <= 0 ? items.at(-1) : undefined)
    : (index < 0 || index === items.length - 1 ? items[0] : undefined)
  if (!target) return
  event.preventDefault()
  target.focus()
}

function onKeydown(event: KeyboardEvent) {
  // 設定是從標題列打開、蓋在規則頁上的對話框，鍵盤整個交給它；不然 Esc 會連規則頁一起關掉
  if (event.defaultPrevented || showSettings.value) return
  if (event.key === 'Tab') {
    if (rulesCollapsed.value || !engaged || event.ctrlKey || event.metaKey || event.altKey) return
    // 規則操作選單與色盤有自己的焦點，交給它們
    if (document.activeElement?.closest('.eqt-context-menu, .eqt-anchored-popover')) return
    containTab(event)
    return
  }
  // 預覽中規則頁整個藏起來，Space 一律用來返回；平常只有正在操作規則頁時才接手
  if (!rulesCollapsed.value && !engaged) return
  if (event.key === ' ') {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return
    if (event.target instanceof Element && event.target.closest(SPACE_OWNERS)) return
    event.preventDefault()
    rulesCollapsed.value = !rulesCollapsed.value
    return
  }
  if (rulesCollapsed.value || event.key !== 'Escape') return
  event.preventDefault()
  emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pointerdown', onPointerdown, true)
  window.addEventListener('focusin', onFocusin, true)
  root.value?.focus({ preventScroll: true })
})
watch(ready, loaded => {
  if (!loaded || initialized) return
  initialized = true
  namedRules = rules.value.length
  selectedId.value = rules.value[0]?.id ?? null
  if (!rules.value.length) addRule()
}, { immediate: true })

// 從縮圖上的規則名稱打開時選中那一條；排在上面那個初始化之後，才不會被「選第一條」蓋掉
watch([requestedRuleId, ready], ([id, loaded]) => {
  if (id === null || !loaded) return
  if (rules.value.some(rule => rule.id === id)) selectedId.value = id
  requestedRuleId.value = null
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointerdown', onPointerdown, true)
  window.removeEventListener('focusin', onFocusin, true)
  const active = document.activeElement
  if (active && active !== document.body && !ownsTarget(active)) return
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  // 從 dock 打開的話，那顆「圖庫規則」在規則頁開著時不在 dock 上；等 dock 換回來再把焦點交給它
  else void nextTick(() => document.querySelector<HTMLElement>(`${DOCK} .eqt-rule-prototype__rules-toggle`)?.focus({ preventScroll: true }))
})
</script>

<template>
  <div
    ref="root" class="eqt-rule-page" :class="{ 'eqt-rule-page--collapsed': rulesCollapsed }"
    role="dialog" :aria-label="t('rulePagePrototype.title')" translate="no" tabindex="-1"
  >
    <!-- 標題列橫跨三欄：左邊是設定、中間是選中的規則、右邊是規則頁唯一的出口 -->
    <header class="eqt-rule-page__header">
      <div class="eqt-rule-page__header-start">
        <button type="button" class="eqt-rule-page__settings" @click="openSettings('gallery')">
          <Settings class="eqt-rule-page__icon" />{{ t('settings.title') }}
        </button>
      </div>
      <div class="eqt-rule-page__meta">
        <template v-if="selected">
          <input
            class="eqt-rule-page__input eqt-rule-page__name" :value="selected.name"
            :aria-label="t('rulePrototype.namePlaceholder')" :placeholder="t('rulePrototype.namePlaceholder')"
            @input="rename"
          />
          <label class="eqt-rule-page__enabled">
            <input type="checkbox" :checked="selected.enabled" @change="toggleEnabled" />
            {{ t('rulePagePrototype.enabled') }}
          </label>
        </template>
      </div>
      <div class="eqt-rule-page__header-end">
        <button type="button" class="eqt-rule-page__close" @click="emit('close')">
          <X class="eqt-rule-page__icon" />{{ t('rulePrototype.close') }}
        </button>
      </div>
    </header>

    <aside class="eqt-rule-page__side">
      <h1 class="eqt-rule-page__title">{{ t('rulePrototype.rules') }}</h1>
      <Draggable
        v-model="rules" v-bind="baseDragOptions" item-key="id"
        class="eqt-rule-page__list-items" handle=".eqt-rule-page__drag-handle"
        ghost-class="eqt-rule-page__list-item--ghost"
        @start="ruleMenuOpen = false" @scroll="ruleMenuOpen = false"
      >
        <template #item="{ element: rule }">
          <div
            class="eqt-rule-page__list-item"
            :class="{
              'eqt-rule-page__list-item--active': rule.id === selectedId,
              'eqt-rule-page__list-item--disabled': !rule.enabled,
            }"
          >
            <div
              class="eqt-rule-page__drag-handle"
              :title="`${t('rulePagePrototype.dragRule')} · ${t('rulePagePrototype.orderHint')}`"
            ><GripVertical class="eqt-rule-page__icon" /></div>
            <button
              type="button" class="eqt-rule-page__list-select"
              :aria-pressed="rule.id === selectedId" :title="rule.name"
              @click="selectedId = rule.id; ruleMenuOpen = false"
            >
              <span class="eqt-rule-page__list-name">{{ rule.name }}</span>
              <small v-if="!rule.enabled" class="eqt-rule-page__badge">{{ t('rulePrototype.disabled') }}</small>
            </button>
            <button
              type="button" class="eqt-rule-page__list-menu"
              :title="t('rulePagePrototype.ruleActions')"
              :aria-label="`${t('rulePagePrototype.ruleActions')}: ${rule.name}`"
              aria-haspopup="dialog" :aria-expanded="ruleMenuOpen && ruleMenuId === rule.id"
              @click="toggleRuleMenu($event, rule.id)"
            ><Ellipsis class="eqt-rule-page__icon" /></button>
          </div>
        </template>
      </Draggable>
      <div class="eqt-rule-page__dock">
        <button type="button" class="eqt-rule-page__add-rule" :disabled="!ready" @click="addRule()">
          <Plus class="eqt-rule-page__icon" />{{ t('rulePrototype.addRule') }}
        </button>
      </div>
      <ContextMenu
        v-if="!rulesCollapsed" v-model:open="ruleMenuOpen"
        :anchor-el="ruleMenuTrigger" :ignore="[ruleMenuTrigger]"
        auto-focus aria-role="dialog" :aria-label="t('rulePagePrototype.ruleActions')"
        placement="right-start"
      >
        <button
          type="button" class="eqt-context-menu__item eqt-context-menu__item--danger"
          @click="removeMenuRule"
        >
          <Trash2 class="eqt-rule-page__icon eqt-context-menu__icon" />
          <span class="eqt-context-menu__label">{{ t('rulePagePrototype.removeRule') }}</span>
        </button>
      </ContextMenu>
    </aside>

    <main class="eqt-rule-page__editor">
      <div class="eqt-rule-page__body">
        <p v-if="error" class="eqt-rule-page__alert" role="alert">{{ t(error) }}</p>

        <template v-if="selected">
          <section class="eqt-rule-page__section">
            <RuleConditionGroup :key="selected.root.id" :group="selected.root" :depth="0" root />
          </section>

          <section class="eqt-rule-page__section">
            <RuleActionsEditor :actions="selected.actions" />
          </section>

          <RuleDigest :rule="selected" />
        </template>
      </div>
    </main>

    <aside class="eqt-rule-page__library">
      <RuleMaterials />
      <RuleTagLibrary />
    </aside>
  </div>
</template>
