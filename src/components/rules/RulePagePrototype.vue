<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Draggable from 'vuedraggable'
import { ArrowLeft, Ellipsis, Eye, GripVertical, Paintbrush, Plus, Shapes, Trash2, X } from '@lucide/vue'
import ContextMenu from '@/components/ContextMenu.vue'
import { baseDragOptions } from '@/utils/drag'
import RuleConditionGroup from './RuleConditionGroup.vue'
import RuleDigest from './RuleDigest.vue'
import RuleMaterials from './RuleMaterials.vue'
import RuleTagLibrary from './RuleTagLibrary.vue'
import { useFixedRuleStore } from '@/composables/useFixedRuleStore'
import { t } from '@/composables/useI18n'
import { COLOR_PRESETS, createRule, type BlurAction } from '@/services/listing/fixedRulePrototype'
import { rulesCollapsed } from '@/services/appOverlays'
import '@/styles/rule-page-prototype.scss'

const emit = defineEmits<{ close: [] }>()
const { rules, ready, error } = useFixedRuleStore()
const selectedId = ref<number | null>(null)
const ruleMenuOpen = ref(false)
const ruleMenuId = ref<number | null>(null)
const ruleMenuTrigger = ref<HTMLButtonElement | null>(null)
const BLUR_ACTIONS: readonly BlurAction[] = ['unchanged', 'blur', 'clear']

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

function setBackground(event: Event) {
  if (selected.value) selected.value.actions.background = (event.target as HTMLSelectElement).value || null
}

function setBlur(event: Event) {
  if (selected.value) selected.value.actions.blur = (event.target as HTMLSelectElement).value as BlurAction
}

// 這些元素自己就吃 Space（打字、勾選、按下按鈕、展開下拉），交給它們；只有焦點落在其他地方時才切換預覽
const SPACE_OWNERS = 'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="button"]'

// 規則頁是非模態的：四周露出的搜尋頁照樣能點、能捲，點下去也不會關掉規則頁。
// 最後一次按下的位置在搜尋頁上，就代表使用者在操作搜尋頁，Space 與 Esc 留給搜尋頁自己用
const root = ref<HTMLElement | null>(null)
let engaged = true

function onPointerdown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Element)) return
  // 規則操作選單 Teleport 到 body，不在 root 裡面，但仍是規則頁的一部分
  engaged = !!root.value?.contains(target) || !!target.closest('.eqt-context-menu')
}

watch(rulesCollapsed, () => {
  ruleMenuOpen.value = false
  engaged = true
})

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  // 預覽中規則頁只剩返回鈕，Space 一律用來返回；平常只有正在操作規則頁時才接手
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
})
watch(ready, loaded => {
  if (!loaded || initialized) return
  initialized = true
  namedRules = rules.value.length
  selectedId.value = rules.value[0]?.id ?? null
  if (!rules.value.length) addRule()
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointerdown', onPointerdown, true)
})
</script>

<template>
  <div
    ref="root" class="eqt-rule-page" :class="{ 'eqt-rule-page--collapsed': rulesCollapsed }"
    role="dialog" :aria-label="t('rulePagePrototype.title')" translate="no"
  >
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
      <header class="eqt-rule-page__meta">
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
        <button
          type="button" class="eqt-rule-page__close"
          :aria-label="t('rulePrototype.close')" :title="t('rulePrototype.close')" @click="emit('close')"
        ><X class="eqt-rule-page__icon" /></button>
      </header>

      <div class="eqt-rule-page__body">
        <p v-if="error" class="eqt-rule-page__alert" role="alert">{{ t(error) }}</p>

        <template v-if="selected">
          <section class="eqt-rule-page__section">
            <RuleConditionGroup :key="selected.root.id" :group="selected.root" :depth="0" root />
          </section>

          <section class="eqt-rule-page__section">
            <h2><Paintbrush class="eqt-rule-page__icon" />{{ t('rulePrototype.actions') }}</h2>
            <div class="eqt-rule-page__actions">
              <label class="eqt-rule-page__field">
                <span>{{ t('rulePagePrototype.background') }}</span>
                <select class="eqt-rule-page__select" :value="selected.actions.background ?? ''" @change="setBackground">
                  <option value="">{{ t('rulePrototype.colorNone') }}</option>
                  <option v-for="preset in COLOR_PRESETS" :key="preset.value" :value="preset.value">{{ t(preset.labelKey) }}</option>
                </select>
                <span
                  v-if="selected.actions.background" class="eqt-rule-page__swatch"
                  :style="{ background: selected.actions.background }"
                />
              </label>
              <label class="eqt-rule-page__field">
                <span>{{ t('rulePrototype.blur') }}</span>
                <select class="eqt-rule-page__select" :value="selected.actions.blur" @change="setBlur">
                  <option v-for="action in BLUR_ACTIONS" :key="action" :value="action">
                    {{ t(action === 'blur' ? 'rulePrototype.blur' : `rulePagePrototype.${action}`) }}
                  </option>
                </select>
              </label>
            </div>
          </section>

          <RuleDigest :rule="selected" />
        </template>
      </div>

      <footer class="eqt-rule-page__footer">
        <!-- 預覽時整頁 visibility: hidden 但版面還在，這顆按鈕照樣留在原處，同一個位置再按一次就返回 -->
        <p v-if="rulesCollapsed" class="eqt-rule-page__preview-hint" role="note">
          <Shapes class="eqt-rule-page__icon" />{{ t('rulePagePrototype.previewHint') }}
        </p>
        <button
          type="button" class="eqt-rule-page__toggle" :aria-pressed="rulesCollapsed" aria-keyshortcuts="Space"
          @click="rulesCollapsed = !rulesCollapsed"
        >
          <component :is="rulesCollapsed ? ArrowLeft : Eye" class="eqt-rule-page__icon" />
          {{ t(rulesCollapsed ? 'rulePagePrototype.backFromPreview' : 'rulePagePrototype.preview') }}
          <kbd class="eqt-rule-page__kbd">{{ t('rulePagePrototype.spaceKey') }}</kbd>
        </button>
      </footer>
    </main>

    <aside class="eqt-rule-page__library">
      <RuleMaterials />
      <RuleTagLibrary />
    </aside>
  </div>
</template>
