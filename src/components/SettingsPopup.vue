<script setup lang="ts">
import { ref, computed, toRaw } from 'vue'
import { onClickOutside, useScrollLock, useClipboard, useTimeoutFn } from '@vueuse/core'
import { Trash2, Copy, Download, Check, RotateCcw, CircleAlert, ExternalLink, Code } from '@lucide/vue'
import Draggable from 'vuedraggable'
import { baseDragOptions } from '@/utils/drag'
import type { QuickTag } from '@/types'
import { t, locale, setLocale, type Locale } from '@/composables/useI18n'
import { DEFAULT_NS_ORDER } from '@/services/tagDb'
import {
  profiles, activeProfileIdx, deletedProfiles, type Profile,
  deleteProfile, restoreProfile, purgeProfile, reorderProfiles, updateProfileTagLines,
  fontFamily, fontWeight, getDefaultTagLines, tagLines,
  dblClickLeft, dblClickRight, newTabActive, nsFormat, defaultExactMatch, type DblClickAction,
} from '@/services/store'

const props = defineProps<{
  useNhWeight: boolean
  nsOrder: string[]
  disabledNs: Set<string>
}>()

const emit = defineEmits<{
  'update:useNhWeight': [value: boolean]
  'update:nsOrder': [value: string[]]
  'update:disabledNs': [value: Set<string>]
  'close': []
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

const dragOptions = {
  ...baseDragOptions,
  ghostClass: 'eqt-settings__ns-item--ghost',
  chosenClass: 'eqt-settings__ns-item--chosen',
}

// --- tabs ---

const tabKeys = ['appearance', 'search', 'about'] as const
type TabKey = typeof tabKeys[number]

const tabLabelKeys: Record<TabKey, string> = {
  search: 'settings.tabSearch',
  appearance: 'settings.tabAppearance',
  about: 'settings.tabAbout',
}

const activeTab = ref<TabKey | null>('appearance')

const dblClickOptions = [
  { labelKey: 'settings.dblClickLeft', ref: dblClickLeft },
  { labelKey: 'settings.dblClickRight', ref: dblClickRight },
]

const localeOptions: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
]

const previewTagLines = computed(() => getDefaultTagLines())

// --- nsOrder change handler ---

function onNsOrderChange(evt: any) {
  if (evt.moved) {
    const newOrder = [...props.nsOrder]
    const [item] = newOrder.splice(evt.moved.oldIndex, 1)
    newOrder.splice(evt.moved.newIndex, 0, item)
    emit('update:nsOrder', newOrder)
  }
}

function resetNsOrder() {
  emit('update:nsOrder', [...DEFAULT_NS_ORDER])
  emit('update:disabledNs', new Set())
}

const popupEl = ref<HTMLElement | null>(null)
onClickOutside(popupEl, () => emit('close'))
useScrollLock(document.body, true)

// --- toggle ---

function toggleNs(ns: string) {
  const next = new Set(props.disabledNs)
  if (next.has(ns)) next.delete(ns)
  else next.add(ns)
  emit('update:disabledNs', next)
}

// --- profile uid ---

let nextUid = 0
const uidMap = new WeakMap<object, string>()

function profileUid(p: object): string {
  const raw = toRaw(p)
  if (!uidMap.has(raw)) {
    uidMap.set(raw, 'p' + nextUid++)
  }
  return uidMap.get(raw)!
}

// --- profile draggable ---

let profileDragging = false

function onProfileChange(evt: any) {
  if (evt.moved) {
    const from = evt.moved.oldIndex, to = evt.moved.newIndex
    // track editingProfileIdx
    if (!editingDeleted.value && editingProfileIdx.value >= 0) {
      const ed = editingProfileIdx.value
      if (ed === from) editingProfileIdx.value = to
      else if (from < ed && to >= ed) editingProfileIdx.value = ed - 1
      else if (from > ed && to <= ed) editingProfileIdx.value = ed + 1
    }
    reorderProfiles(from, to)
  }
}

function onProfileStart() { profileDragging = true }
function onProfileEnd() { setTimeout(() => { profileDragging = false }, 0) }

// --- json editor (inline) ---

const editingProfileIdx = ref(-1)
const editingDeleted = ref(false)
const editorText = ref('')
const editorError = ref('')
const editorCopied = ref(false)
const { copy: clipboardCopy } = useClipboard({ legacy: true })
const { start: startCopiedTimer } = useTimeoutFn(() => { editorCopied.value = false }, 1500, { immediate: false })

const editorPreview = computed<QuickTag[][] | null>(() => {
  try {
    const parsed = JSON.parse(editorText.value)
    if (!Array.isArray(parsed)) return null
    return parsed as QuickTag[][]
  } catch { return null }
})

const editingName = computed(() => {
  const idx = editingProfileIdx.value
  if (idx < 0) return ''
  return editingDeleted.value ? deletedProfiles[idx]?.name : profiles[idx]?.name
})

function adjustEditorIdxOnRemove(removedIdx: number, fromDeleted: boolean) {
  if (editingDeleted.value !== fromDeleted) return
  if (editingProfileIdx.value === removedIdx) editingProfileIdx.value = -1
  else if (editingProfileIdx.value > removedIdx) editingProfileIdx.value--
}

function onDelete(idx: number) {
  adjustEditorIdxOnRemove(idx, false)
  deleteProfile(idx)
}

function onRestore(idx: number) {
  adjustEditorIdxOnRemove(idx, true)
  restoreProfile(idx)
}

function onPurge(idx: number) {
  const name = deletedProfiles[idx]?.name ?? ''
  if (!confirm(t('settings.purgeConfirm', { name }))) return
  adjustEditorIdxOnRemove(idx, true)
  purgeProfile(idx)
}

function openEditor(idx: number, deleted = false) {
  if (profileDragging) return
  activeTab.value = null
  editingProfileIdx.value = idx
  editingDeleted.value = deleted
  editorError.value = ''
  const data = deleted
    ? deletedProfiles[idx].tagLines
    : idx === activeProfileIdx.value ? tagLines : profiles[idx].tagLines
  editorText.value = JSON.stringify(data, null, 2)
}

function onEditorSave() {
  if (editingDeleted.value) return
  try {
    const parsed = JSON.parse(editorText.value)
    editorError.value = ''
    updateProfileTagLines(editingProfileIdx.value, parsed)
  } catch (err) {
    editorError.value = (err as Error).message
  }
}

async function onEditorCopy() {
  await clipboardCopy(editorText.value)
  editorCopied.value = true
  startCopiedTimer()
}

function onEditorExport() {
  const blob = new Blob([editorText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `EhQuickTag-${editingName.value}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="eqt-popup-overlay" @keydown="onKeydown">
    <div ref="popupEl" class="eqt-popup eqt-settings__layout">
      <nav class="eqt-settings__sidebar">
        <h3 class="eqt-popup__title">{{ t('settings.title') }}</h3>
        <button
          v-for="key in tabKeys"
          :key="key"
          type="button"
          class="eqt-settings__tab"
          :class="{ 'eqt-settings__tab--active': activeTab === key }"
          @click="activeTab = key; editingProfileIdx = -1"
        >{{ t(tabLabelKeys[key]) }}</button>
        <div class="eqt-settings__sidebar-spacer" />
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="emit('close')">
          {{ t('settings.close') }}
        </button>
      </nav>

      <div class="eqt-settings__panel">
        <!-- 設定：搜尋 -->
        <div v-show="editingProfileIdx < 0">
          <div v-show="activeTab === 'search'">
            <label class="eqt-settings__row" style="margin-top: 0">
              <input
                type="checkbox"
                :checked="props.useNhWeight"
                @change="emit('update:useNhWeight', ($event.target as HTMLInputElement).checked)"
              />
              <span class="eqt-settings__label">{{ t('settings.useNhWeight') }}</span>
            </label>
            <p class="eqt-settings__hint">
              {{ t('settings.useNhWeightHint') }}
            </p>

            <h4 class="eqt-settings__subtitle">{{ t('settings.nsFormat') }}</h4>
            <div class="eqt-settings__locale-row">
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': nsFormat === 'long' }"
                @click="nsFormat = 'long'"
              >{{ t('settings.nsFormatLong') }}</button>
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': nsFormat === 'short' }"
                @click="nsFormat = 'short'"
              >{{ t('settings.nsFormatShort') }}</button>
            </div>

            <label class="eqt-settings__row" style="margin-top: 10px">
              <input
                type="checkbox"
                :checked="defaultExactMatch"
                @change="defaultExactMatch = ($event.target as HTMLInputElement).checked"
              />
              <span class="eqt-settings__label">{{ t('settings.defaultExactMatch') }}</span>
            </label>
            <p class="eqt-settings__hint">
              {{ t('settings.defaultExactMatchHint') }}
            </p>

            <h4 class="eqt-settings__subtitle">{{ t('settings.dblClickActions') }}</h4>
            <div
              v-for="({ labelKey, ref: r }) in dblClickOptions"
              :key="labelKey"
              class="eqt-settings__dblclick-row"
            >
              <label class="eqt-settings__dblclick-label">{{ t(labelKey) }}</label>
              <select
                class="eqt-settings__select"
                :value="r.value"
                @change="r.value = ($event.target as HTMLSelectElement).value as DblClickAction"
              >
                <option value="search">{{ t('settings.actionSearchCurrent') }}</option>
                <option value="searchNewTab">{{ t('settings.actionSearchNewTab') }}</option>
                <option value="clearSearch">{{ t('settings.actionClear') }}</option>
              </select>
            </div>
            <label class="eqt-settings__row" style="margin-top: 6px">
              <input
                type="checkbox"
                :checked="newTabActive"
                @change="newTabActive = ($event.target as HTMLInputElement).checked"
              />
              <span class="eqt-settings__label">{{ t('settings.newTabActivate') }}</span>
            </label>

            <h4 class="eqt-settings__subtitle">
              {{ t('settings.nsOrder') }}
              <button class="eqt-settings__reset-btn" type="button" :title="t('settings.resetTitle')" @click="resetNsOrder"><RotateCcw :size="12" /> {{ t('settings.reset') }}</button>
            </h4>
            <p class="eqt-settings__hint" style="white-space: pre-line">
              {{ t('settings.nsOrderHint') }}
            </p>
            <Draggable
              v-bind="dragOptions"
              :model-value="nsOrder"
              :item-key="(ns: string) => ns"
              filter="input"
              :prevent-on-filter="false"
              tag="ul"
              class="eqt-settings__ns-list"
              @change="onNsOrderChange"
            >
              <template #item="{ element: ns }">
                <li class="eqt-settings__ns-item eqt-settings__ns-item--draggable">
                  <input
                    type="checkbox"
                    :checked="!disabledNs.has(ns)"
                    @change="toggleNs(ns)"
                  />
                  <span class="eqt-settings__ns-label">{{ t('ns.' + ns) }}</span>
                  <span class="eqt-settings__ns-key">{{ ns }}</span>
                </li>
              </template>
            </Draggable>
          </div>

          <!-- 設定：外觀 -->
          <div v-show="activeTab === 'appearance'">
            <h4 class="eqt-settings__subtitle" style="margin-top: 0">{{ t('settings.language') }}</h4>
            <div class="eqt-settings__locale-row">
              <button
                v-for="opt in localeOptions"
                :key="opt.value"
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': locale === opt.value }"
                @click="setLocale(opt.value)"
              >{{ opt.label }}</button>
            </div>

            <h4 class="eqt-settings__subtitle">{{ t('settings.fontFamily') }}</h4>
            <div class="eqt-settings__font-row">
              <input
                :value="fontFamily"
                class="eqt-settings__font-input eqt-settings__font-input--full"
                :placeholder="t('settings.fontFamilyPlaceholder')"
                @input="fontFamily = ($event.target as HTMLInputElement).value"
              />
            </div>
            <p class="eqt-settings__hint">
              {{ t('settings.fontFamilyHint') }}<code>"Noto Sans TC", sans-serif</code>
            </p>

            <h4 class="eqt-settings__subtitle">{{ t('settings.fontWeight') }}</h4>
            <div class="eqt-settings__weight-row">
              <input
                type="range"
                min="100"
                max="900"
                step="100"
                :value="fontWeight || '400'"
                class="eqt-settings__weight-slider"
                @input="fontWeight = ($event.target as HTMLInputElement).value"
              />
              <span class="eqt-settings__weight-value">{{ fontWeight || '400' }}</span>
            </div>

            <h4 class="eqt-settings__subtitle">{{ t('settings.preview') }}</h4>
            <div class="eqt-settings__font-preview" :style="{ fontFamily: fontFamily || 'inherit', fontWeight: fontWeight || 'inherit' }">
              <template v-for="(line, li) in previewTagLines" :key="li">
                <div v-if="line.length" class="eqt-settings__preview-line">
                  <span
                    v-for="(qt, ti) in line"
                    :key="ti"
                    class="eqt-settings__preview-tag"
                    :class="{ 'eqt-settings__preview-tag--url': !!qt.url }"
                  >{{ qt.label || qt.tag }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- 設定：關於 -->
          <div v-show="activeTab === 'about'" class="eqt-settings__about">
            <div class="eqt-about__hero">
              <div class="eqt-about__title">EH Quick Tag</div>
              <div class="eqt-about__version">v0.1.0</div>
              <div class="eqt-about__desc">{{ t('about.desc') }}</div>
              <div class="eqt-about__actions">
                <a class="eqt-about__action-btn" href="https://github.com/Tsuyumi25/EhQuickTag" target="_blank" rel="noopener"><Code :size="14" /> GitHub</a>
                <a class="eqt-about__action-btn" href="https://github.com/Tsuyumi25/EhQuickTag/issues" target="_blank" rel="noopener"><CircleAlert :size="14" /> {{ t('about.reportIssue') }}</a>
              </div>
            </div>

            <div class="eqt-about__section">
              <div class="eqt-about__section-title">{{ t('about.inspiration') }}</div>
              <div class="eqt-about__items">
                <a class="eqt-about__item" href="https://sleazyfork.org/scripts/454282" target="_blank" rel="noopener">
                  <ExternalLink :size="12" /> Add button on exhentai searchbox
                </a>
                <a class="eqt-about__item" href="https://sleazyfork.org/scripts/454209" target="_blank" rel="noopener">
                  <ExternalLink :size="12" /> ExAdvancedSearchMemo
                </a>
                <a class="eqt-about__item" href="https://sleazyfork.org/scripts/516145" target="_blank" rel="noopener">
                  <ExternalLink :size="12" /> Lolicon E-Hentai/ExHentai Enhancer
                </a>
              </div>
            </div>

            <div class="eqt-about__section">
              <div class="eqt-about__section-title">{{ t('about.techRef') }}</div>
              <div class="eqt-about__items">
                <a class="eqt-about__item" href="https://github.com/sk2589822/Exhentai-Enhancer" target="_blank" rel="noopener">
                  <Code :size="12" /> Exhentai-Enhancer
                </a>
              </div>
            </div>

            <div class="eqt-about__section">
              <div class="eqt-about__section-title">{{ t('about.credits') }}</div>
              <div class="eqt-about__items">
                <a class="eqt-about__item" href="https://github.com/EhTagTranslation/Database" target="_blank" rel="noopener">
                  <Code :size="12" /> EhTagTranslation
                  <span class="eqt-about__item-detail">{{ t('about.ehttDetail') }}</span>
                </a>
                <a class="eqt-about__item" href="https://github.com/EhTagTranslation/EhSyringe" target="_blank" rel="noopener">
                  <Code :size="12" /> EhSyringe
                  <span class="eqt-about__item-detail">{{ t('about.ehsyringeDetail') }}</span>
                </a>
                <a class="eqt-about__item" href="https://github.com/BYVoid/OpenCC" target="_blank" rel="noopener">
                  <Code :size="12" /> OpenCC
                  <span class="eqt-about__item-detail">{{ t('about.openccDetail') }}</span>
                </a>
              </div>
            </div>

            <div class="eqt-about__footer">MIT License</div>
          </div>
        </div>

        <!-- JSON 編輯器 (inline) -->
        <div v-show="editingProfileIdx >= 0" class="eqt-json-editor">
          <div class="eqt-json-editor__header">
            <h4 class="eqt-json-editor__title">{{ editingName }}</h4>
            <div class="eqt-json-editor__toolbar">
              <button class="eqt-json-editor__tool-btn" type="button" :title="editorCopied ? t('settings.editorCopied') : t('settings.editorCopy')" @click="onEditorCopy">
                <Check v-if="editorCopied" :size="14" />
                <Copy v-else :size="14" />
              </button>
              <button class="eqt-json-editor__tool-btn" type="button" :title="t('settings.editorExport')" @click="onEditorExport">
                <Download :size="14" />
              </button>
            </div>
          </div>

          <div v-if="editorPreview" class="eqt-settings__font-preview eqt-json-editor__preview">
            <template v-for="(line, li) in editorPreview" :key="li">
              <div v-if="line.length" class="eqt-settings__preview-line">
                <span
                  v-for="(qt, ti) in line"
                  :key="ti"
                  class="eqt-settings__preview-tag"
                  :class="{ 'eqt-settings__preview-tag--url': !!qt.url }"
                >{{ qt.label || qt.tag || t('settings.emptyTag') }}</span>
              </div>
            </template>
          </div>

          <textarea
            v-model="editorText"
            class="eqt-json-editor__textarea"
            spellcheck="false"
            autocomplete="off"
            :readonly="editingDeleted"
          />

          <p v-if="editorError" class="eqt-json-editor__error">{{ t('settings.editorJsonError', { message: editorError }) }}</p>

          <div v-if="editingDeleted" class="eqt-popup__actions" style="justify-content: center">
            <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onRestore(editingProfileIdx)">{{ t('settings.restoreProfile') }}</button>
            <button class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="onPurge(editingProfileIdx)">{{ t('settings.purgeProfile') }}</button>
          </div>
          <div v-else class="eqt-popup__actions">
            <div class="eqt-popup__spacer" />
            <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onEditorSave">{{ t('settings.save') }}</button>
          </div>
        </div>
      </div>

      <!-- 右欄：標籤組列表 -->
      <aside class="eqt-settings__profiles">
        <h4 class="eqt-settings__subtitle" style="margin-top: 0">{{ t('settings.profilesTitle') }}</h4>
        <Draggable
          v-bind="dragOptions"
          :model-value="profiles"
          :item-key="profileUid"
          filter=".eqt-settings__item-btn"
          :prevent-on-filter="false"
          tag="ul"
          class="eqt-settings__ns-list"
          @change="onProfileChange"
          @start="onProfileStart"
          @end="onProfileEnd"
        >
          <template #item="{ element: p, index: i }">
            <li
              class="eqt-settings__ns-item eqt-settings__ns-item--clickable"
              :class="{ 'eqt-settings__ns-item--chosen': editingProfileIdx === i && !editingDeleted }"
              @click="openEditor(i)"
            >
              <span class="eqt-settings__item-name">
                {{ p.name }}
                <span v-if="i === activeProfileIdx" class="eqt-settings__active-badge">{{ t('settings.activeBadge') }}</span>
              </span>
              <span class="eqt-settings__item-count">{{ (i === activeProfileIdx ? tagLines : p.tagLines).flat().length }}</span>
              <button
                v-if="profiles.length > 1"
                class="eqt-settings__item-btn eqt-settings__item-btn--purge"
                type="button"
                :title="t('settings.moveToTrash')"
                @click.stop="onDelete(i)"
              ><Trash2 :size="12" /></button>
            </li>
          </template>
        </Draggable>

        <template v-if="deletedProfiles.length">
          <h4 class="eqt-settings__subtitle">{{ t('settings.trash') }}</h4>
          <ul class="eqt-settings__ns-list">
            <li
              v-for="(p, i) in deletedProfiles"
              :key="i"
              class="eqt-settings__ns-item eqt-settings__ns-item--clickable"
              :class="{ 'eqt-settings__ns-item--chosen': editingProfileIdx === i && editingDeleted }"
              @click="openEditor(i, true)"
            >
              <span class="eqt-settings__item-name">{{ p.name }}</span>
              <span class="eqt-settings__item-count">{{ p.tagLines.flat().length }}</span>
            </li>
          </ul>
        </template>
      </aside>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-settings__layout {
  display: flex;
  padding: 0;
  width: clamp(40rem, 92vw, 82rem);
  min-height: 90vh;
  max-height: 90vh;
}

.eqt-settings__sidebar {
  display: flex;
  flex-direction: column;
  width: 7rem;
  flex-shrink: 0;
  padding: 1.25rem 0.75rem;
  border-right: var(--eqt-border-width) solid var(--eqt-divider);
  background: var(--eqt-bg);

  .eqt-popup__title {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: bold;
    padding: 0 4px;
  }
}

.eqt-settings__sidebar-spacer {
  flex: 1;
}

.eqt-settings__tab {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--eqt-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--eqt-bg-hover);
  }

  &--active {
    background: var(--eqt-bg-active);
    font-weight: bold;
  }
}

.eqt-settings__panel {
  flex: 1;
  min-width: 0;
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  > :first-child {
    flex: 1;
    min-height: 0;
  }

  .eqt-json-editor {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.eqt-settings__profiles {
  width: 15rem;
  flex-shrink: 0;
  padding: 1.25rem 0.75rem;
  border-left: var(--eqt-border-width) solid var(--eqt-divider);
  overflow-y: auto;
}

.eqt-settings {
  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
  }

  &__label {
    user-select: none;
  }

  &__dblclick-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 13px;
  }

  &__dblclick-label {
    min-width: 5em;
    flex-shrink: 0;
  }

  &__locale-row {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  &__locale-btn {
    padding: 3px 10px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-secondary);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--active {
      background: var(--eqt-bg-active);
      font-weight: bold;
    }
  }

  &__select {
    padding: 3px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    font-size: 12px;
  }

  &__hint {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--eqt-text-hint);
    line-height: 1.4;
  }


  &__subtitle {
    margin: 14px 0 4px;
    font-size: 13px;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    font-size: 11px;
    line-height: 1;
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text);
    }
  }

  &__ns-list {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
  }

  &__ns-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    min-height: 30px;
    border-radius: 3px;
    font-size: 13px;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--ghost {
      opacity: 0.4;
    }

    &--chosen {
      background: var(--eqt-bg-active);
    }

    &--clickable {
      cursor: pointer;
    }

    &--draggable {
      cursor: grab;
    }
  }

  &__ns-label {
    user-select: none;
    min-width: 3em;
  }

  &__ns-key {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex: 1;
  }


  &__font-row {
    margin-top: 4px;
  }

  &__font-input {
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 13px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }

    &--full {
      width: 100%;
    }
  }

  &__weight-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  &__weight-slider {
    flex: 1;
    accent-color: var(--eqt-border-focus);
  }

  &__weight-value {
    font-size: 12px;
    color: var(--eqt-text-hint);
    min-width: 2.5em;
    text-align: right;
  }

  &__font-preview {
    margin-top: 6px;
    padding: 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__preview-line {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__preview-tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--eqt-text-secondary);
    background: transparent;
  }

  &__active-badge {
    font-size: 10px;
    color: #fff;
    background: #4a7c59;
    padding: 1px 4px;
    border-radius: 2px;
    margin-left: 4px;
    vertical-align: middle;
  }

  &__item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-count {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex-shrink: 0;
  }

  &__item-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-active);
      color: var(--eqt-text);
    }

    &--purge:hover {
      color: #8c3333;
    }
  }
}

.eqt-json-editor {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__title {
    margin: 0;
    font-size: 13px;
    font-weight: bold;
  }

  &__toolbar {
    display: flex;
    gap: 4px;
  }

  &__tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-btn-hover);
    }
  }

  &__preview {
    margin-bottom: 8px;
    flex-shrink: 0;
    background: var(--eqt-bg);
    font-family: var(--eqt-font-family, inherit);
    font-weight: var(--eqt-font-weight, inherit);
  }

  &__textarea {
    flex: 1;
    min-height: 0;
    padding: 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg);
    color: var(--eqt-text);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    tab-size: 2;
    resize: none;
    white-space: pre;
    overflow: auto;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }
  }

  &__error {
    margin: 6px 0 0;
    padding: 4px 8px;
    font-size: 12px;
    color: #c33;
    background: rgba(204, 51, 51, 0.08);
    border-radius: 3px;
  }
}

.eqt-about {
  &__hero {
    text-align: center;
    padding: 20px 16px;
    margin-bottom: 16px;
    border-radius: 6px;
    background: var(--eqt-bg-hover);
  }

  &__title {
    font-size: 18px;
    font-weight: bold;
    color: var(--eqt-text);
  }

  &__version {
    margin-top: 2px;
    font-size: 11px;
    color: var(--eqt-text-hint);
  }

  &__desc {
    margin-top: 4px;
    font-size: 12px;
    color: var(--eqt-text-hint);
  }

  &__actions {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
  }

  &__action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    font-size: 12px;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-btn-hover);
    }
  }

  &__section {
    margin-bottom: 12px;
  }

  &__section-title {
    font-size: 11px;
    font-weight: bold;
    color: var(--eqt-text-hint);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 3px;
    font-size: 12px;
    color: var(--eqt-text);
    text-decoration: none;

    &:hover {
      background: var(--eqt-bg-hover);
    }
  }

  &__item-detail {
    color: var(--eqt-text-hint);
    font-size: 11px;
    margin-left: auto;
  }

  &__footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: var(--eqt-border-width) solid var(--eqt-divider);
    font-size: 11px;
    color: var(--eqt-text-hint);
    text-align: center;
  }
}
</style>
