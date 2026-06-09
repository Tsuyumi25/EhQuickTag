<script setup lang="ts">
import { ref, computed, toRaw } from 'vue'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { RotateCcw } from '@lucide/vue'
import Draggable from 'vuedraggable'
import { baseDragOptions } from '@/utils/drag'
import type { Line } from '@/types'
import { t, locale, setLocale, type Locale } from '@/composables/useI18n'
import { DEFAULT_NS_ORDER, refreshTagDb, TAG_DB_MIRRORS, type TagDbMirror } from '@/services/tagDb'
import {
  profiles, activeProfileIdx, deletedProfiles, corruptedProfiles, type Profile,
  deleteProfile, restoreProfile, purgeProfile, purgeCorrupted, reorderProfiles, updateProfileLines,
  fontFamily, fontWeight, getDefaultLines, lines,
  dblClickLeft, dblClickRight, newTabActive, nsFormat, defaultExactMatch,
  tagDbMirror, tagDbTtlDays, tagStylePreset, useAccentOnInclude, type DblClickAction,
  showNativeSearch, showSearchPanel, searchPanelLangMode, convertToTraditional,
} from '@/services/store'
import { TAG_STYLE_PRESETS, currentTagStyleClass } from '@/composables/useTagStyle'
import ProfileListItem from '@/components/ProfileListItem.vue'
import ProfileJsonEditor from '@/components/ProfileJsonEditor.vue'
import SettingsAboutTab from '@/components/SettingsAboutTab.vue'

const props = defineProps<{
  useNhWeight: boolean
  nsOrder: string[]
  disabledNs: readonly string[]
}>()

const emit = defineEmits<{
  'update:useNhWeight': [value: boolean]
  'update:nsOrder': [value: string[]]
  'update:disabledNs': [value: string[]]
  'close': []
}>()

const dragOptions = {
  ...baseDragOptions,
  ghostClass: 'eqt-settings__ns-item--ghost',
  chosenClass: 'eqt-settings__ns-item--chosen',
}

// --- tabs ---

const tabKeys = ['appearance', 'searchBar', 'search', 'data', 'about'] as const
type TabKey = typeof tabKeys[number]

const tabLabelKeys: Record<TabKey, string> = {
  searchBar: 'settings.tabSearchBar',
  search: 'settings.tabSearch',
  appearance: 'settings.tabAppearance',
  data: 'settings.tabData',
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

const previewLines = computed(() => getDefaultLines())

function tagCount(lines: Line[]): number {
  return lines.reduce((sum, l) => sum + (l.kind === 'buttons' ? l.buttons.length : 0), 0)
}

const tagCounts = computed(() => profiles.map((p, i) =>
  tagCount(i === activeProfileIdx.value ? lines : p.lines),
))
const deletedTagCounts = computed(() => deletedProfiles.map(p => tagCount(p.lines)))

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
  emit('update:disabledNs', [])
}

const popupEl = ref<HTMLElement | null>(null)
usePopupBehavior({ popupEl, onClose: () => emit('close') })

const mirrorOptions = Object.entries(TAG_DB_MIRRORS).map(([k, v]) => ({ value: k as TagDbMirror, label: v.label }))
const refreshing = ref(false)
async function onRefreshTagDb() {
  refreshing.value = true
  try { await refreshTagDb({ mirror: tagDbMirror.value }) } finally { refreshing.value = false }
}

// --- toggle ---

function toggleNs(ns: string) {
  const next = [...props.disabledNs]
  const idx = next.indexOf(ns)
  if (idx >= 0) next.splice(idx, 1)
  else next.push(ns)
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
// editor 內部 state（textarea / preview / copy / save / export）住在 ProfileJsonEditor。
// 這裡只保留「左右兩欄連動」需要的 idx + 模式旗標 + 初始 text snapshot

const editingProfileIdx = ref(-1)
const editingDeleted = ref(false)
// corrupted 模式：editor 顯示 raw JSON readonly，footer 只有「匯出 / 永久刪除」
const editingCorrupted = ref(false)

const editingMode = computed<'normal' | 'deleted' | 'corrupted'>(() =>
  editingCorrupted.value ? 'corrupted' : editingDeleted.value ? 'deleted' : 'normal',
)

const editingName = computed(() => {
  const idx = editingProfileIdx.value
  if (idx < 0) return ''
  if (editingCorrupted.value) {
    const c = corruptedProfiles[idx]
    return c ? new Date(c.savedAt).toLocaleString() : ''
  }
  return editingDeleted.value ? deletedProfiles[idx]?.name : profiles[idx]?.name
})

const editingInitialText = computed(() => {
  const idx = editingProfileIdx.value
  if (idx < 0) return ''
  if (editingCorrupted.value) {
    return corruptedProfiles[idx]?.raw ?? ''
  }
  const data = editingDeleted.value
    ? deletedProfiles[idx]?.lines
    : idx === activeProfileIdx.value ? lines : profiles[idx]?.lines
  return data ? JSON.stringify(data, null, 2) : ''
})

const editingCorruptedReason = computed(() => {
  if (!editingCorrupted.value) return undefined
  return corruptedProfiles[editingProfileIdx.value]?.reason
})

function adjustEditorIdxOnRemove(removedIdx: number, fromDeleted: boolean) {
  if (editingDeleted.value !== fromDeleted || editingCorrupted.value) return
  if (editingProfileIdx.value === removedIdx) editingProfileIdx.value = -1
  else if (editingProfileIdx.value > removedIdx) editingProfileIdx.value--
}

function adjustEditorIdxOnCorruptedRemove(removedIdx: number) {
  if (!editingCorrupted.value) return
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

function onPurgeCorrupted(idx: number) {
  const c = corruptedProfiles[idx]
  const name = c ? new Date(c.savedAt).toLocaleString() : ''
  if (!confirm(t('settings.purgeConfirm', { name }))) return
  adjustEditorIdxOnCorruptedRemove(idx)
  purgeCorrupted(idx)
}

function openEditor(idx: number, deleted = false) {
  if (profileDragging) return
  activeTab.value = null
  editingProfileIdx.value = idx
  editingDeleted.value = deleted
  editingCorrupted.value = false
}

function openCorrupted(idx: number) {
  activeTab.value = null
  editingProfileIdx.value = idx
  editingDeleted.value = false
  editingCorrupted.value = true
}

function onEditorSave(parsed: Line[]) {
  updateProfileLines(editingProfileIdx.value, parsed)
}

function onEditorRestore() {
  onRestore(editingProfileIdx.value)
}

function onEditorPurge() {
  if (editingCorrupted.value) onPurgeCorrupted(editingProfileIdx.value)
  else onPurge(editingProfileIdx.value)
}
</script>

<template>
  <div class="eqt-popup-overlay">
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
        <!-- 設定：搜尋欄顯示 -->
        <div v-show="editingProfileIdx < 0">
          <div v-show="activeTab === 'searchBar'" class="eqt-settings__tab-content">
            <h4 class="eqt-settings__subtitle">{{ t('settings.searchBarVisibility') }}</h4>
            <label class="eqt-settings__row">
              <input
                type="checkbox"
                :checked="showNativeSearch"
                @change="showNativeSearch = ($event.target as HTMLInputElement).checked"
              />
              <span class="eqt-settings__label">{{ t('settings.showNativeSearch') }}</span>
            </label>

            <label class="eqt-settings__row">
              <input
                type="checkbox"
                :checked="showSearchPanel"
                @change="showSearchPanel = ($event.target as HTMLInputElement).checked"
              />
              <span class="eqt-settings__label">{{ t('settings.showSearchPanel') }}</span>
            </label>

            <h4 class="eqt-settings__subtitle">{{ t('settings.searchPanelLang') }}</h4>
            <div class="eqt-settings__locale-row">
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': searchPanelLangMode === 'auto' }"
                @click="searchPanelLangMode = 'auto'"
              >{{ t('settings.searchPanelLangAuto') }}</button>
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': searchPanelLangMode === 'toggle' }"
                @click="searchPanelLangMode = 'toggle'"
              >{{ t('settings.searchPanelLangToggle') }}</button>
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': searchPanelLangMode === 'english-only' }"
                @click="searchPanelLangMode = 'english-only'"
              >{{ t('settings.searchPanelLangEnglishOnly') }}</button>
            </div>

            <h4 class="eqt-settings__subtitle">{{ t('settings.convertToTraditional') }}</h4>
            <div class="eqt-settings__locale-row">
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': convertToTraditional === 'auto' }"
                @click="convertToTraditional = 'auto'"
              >{{ t('settings.convertToTraditionalAuto') }}</button>
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': convertToTraditional === 'on' }"
                @click="convertToTraditional = 'on'"
              >{{ t('settings.convertToTraditionalOn') }}</button>
              <button
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': convertToTraditional === 'off' }"
                @click="convertToTraditional = 'off'"
              >{{ t('settings.convertToTraditionalOff') }}</button>
            </div>
          </div>

          <div v-show="activeTab === 'search'" class="eqt-settings__tab-content">
            <label class="eqt-settings__row">
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

            <label class="eqt-settings__row">
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
                <option value="none">{{ t('settings.actionNone') }}</option>
              </select>
            </div>
            <label class="eqt-settings__row">
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
                    :checked="!disabledNs.includes(ns)"
                    @change="toggleNs(ns)"
                  />
                  <span class="eqt-settings__ns-label">{{ t('ns.' + ns) }}</span>
                  <span class="eqt-settings__ns-key">{{ ns }}</span>
                </li>
              </template>
            </Draggable>
          </div>

          <!-- 設定：資料 -->
          <div v-show="activeTab === 'data'" class="eqt-settings__tab-content">
            <h4 class="eqt-settings__subtitle">{{ t('settings.tagDbMirror') }}</h4>
            <div class="eqt-settings__row">
              <select class="eqt-settings__select" v-model="tagDbMirror">
                <option v-for="opt in mirrorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <h4 class="eqt-settings__subtitle">{{ t('settings.tagDbTtlDays') }}</h4>
            <div class="eqt-settings__row">
              <input class="eqt-settings__input eqt-settings__input--short" type="number" min="1" max="30" v-model.number="tagDbTtlDays" />
              <button class="eqt-settings__refresh-btn" type="button" :disabled="refreshing" @click="onRefreshTagDb">
                <RotateCcw :size="12" /> {{ refreshing ? t('settings.tagDbRefreshing') : t('settings.tagDbRefresh') }}
              </button>
            </div>
          </div>

          <!-- 設定：外觀 -->
          <div v-show="activeTab === 'appearance'" class="eqt-settings__tab-content">
            <h4 class="eqt-settings__subtitle">{{ t('settings.language') }}</h4>
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

            <h4 class="eqt-settings__subtitle">{{ t('settings.tagStyle') }}</h4>
            <div class="eqt-settings__locale-row">
              <button
                v-for="preset in TAG_STYLE_PRESETS"
                :key="preset.id"
                type="button"
                class="eqt-settings__locale-btn"
                :class="{ 'eqt-settings__locale-btn--active': tagStylePreset === preset.id }"
                @click="tagStylePreset = preset.id"
              >{{ t(preset.labelKey) }}</button>
            </div>

            <label class="eqt-settings__row">
              <input
                type="checkbox"
                :checked="useAccentOnInclude"
                @change="useAccentOnInclude = ($event.target as HTMLInputElement).checked"
              />
              <span class="eqt-settings__label">{{ t('settings.useAccentOnInclude') }}</span>
            </label>
            <p class="eqt-settings__hint">
              {{ t('settings.useAccentOnIncludeHint') }}
            </p>

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
            <div class="eqt-settings__font-preview" :class="currentTagStyleClass" :style="{ fontFamily: fontFamily || 'inherit', fontWeight: fontWeight || 'inherit' }">
              <template v-for="(line, li) in previewLines" :key="li">
                <div v-if="line.kind === 'buttons' && line.buttons.length" class="eqt-settings__preview-line">
                  <span
                    v-for="(b, ti) in line.buttons"
                    :key="ti"
                    class="eqt-settings__preview-tag"
                    :class="{ 'eqt-settings__preview-tag--url': b.kind === 'url' }"
                  >{{ b.label || (b.kind === 'tag' ? b.tags.join(', ') : b.url) }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- 設定：關於 -->
          <SettingsAboutTab v-show="activeTab === 'about'" />
        </div>

        <!-- JSON 編輯器 (inline)：用 idx + mode 當 key 確保切換 profile 時 remount，editor 內部 state 自然 reset -->
        <ProfileJsonEditor
          v-if="editingProfileIdx >= 0"
          :key="`${editingProfileIdx}-${editingMode}`"
          :mode="editingMode"
          :name="editingName"
          :initial-text="editingInitialText"
          :corrupted-reason="editingCorruptedReason"
          @save="onEditorSave"
          @restore="onEditorRestore"
          @purge="onEditorPurge"
        />
      </div>

      <!-- 右欄：標籤組列表 -->
      <aside class="eqt-settings__profiles">
        <h4 class="eqt-settings__subtitle">{{ t('settings.profilesTitle') }}</h4>
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
            <ProfileListItem
              :name="p.name"
              :count="tagCounts[i]"
              :is-active="i === activeProfileIdx"
              :chosen="editingProfileIdx === i && !editingDeleted && !editingCorrupted"
              :purgeable="profiles.length > 1"
              :purge-title="t('settings.moveToTrash')"
              @click="openEditor(i)"
              @purge="onDelete(i)"
            />
          </template>
        </Draggable>

        <template v-if="deletedProfiles.length">
          <h4 class="eqt-settings__subtitle">{{ t('settings.trash') }}</h4>
          <ul class="eqt-settings__ns-list">
            <ProfileListItem
              v-for="(p, i) in deletedProfiles"
              :key="i"
              :name="p.name"
              :count="deletedTagCounts[i]"
              :chosen="editingProfileIdx === i && editingDeleted"
              @click="openEditor(i, true)"
            />
          </ul>
        </template>

        <template v-if="corruptedProfiles.length">
          <h4 class="eqt-settings__subtitle">{{ t('settings.corrupted') }}</h4>
          <ul class="eqt-settings__ns-list">
            <ProfileListItem
              v-for="(c, i) in corruptedProfiles"
              :key="i"
              :name="new Date(c.savedAt).toLocaleString()"
              :chosen="editingProfileIdx === i && editingCorrupted"
              @click="openCorrupted(i)"
            />
          </ul>
        </template>
      </aside>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-settings__layout {
  display: flex;
  width: clamp(44rem, 94vw, 88rem);
  min-height: 94vh;
  max-height: 94vh;
}

.eqt-settings__sidebar {
  display: flex;
  flex-direction: column;
  // 9rem 寬：英文版「Appearance」(~75px @ 13px font) 在 7rem 內會貼右緣甚至溢出。
  // 9rem 給長 tab label 留 ~30px 緩衝、跟其他 locale (中日文 2 字) 視覺也不會
  // 太空——這個寬度跨四語都耐看。
  width: 9rem;
  flex-shrink: 0;
  padding: 1.25rem 0.625rem;
  gap: 2px;
  border-right: var(--eqt-border-width) solid var(--eqt-border);
  background: var(--eqt-bg);

  .eqt-popup__title {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: bold;
    padding: 0 6px;
  }
}

.eqt-settings__sidebar-spacer {
  flex: 1;
}

.eqt-settings__tab {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--eqt-radius-sm);
  background: transparent;
  color: var(--eqt-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  // 防禦性：未來 locale label 再長也不爆出邊框（理論上 9rem 已 cover 所有
  // 既有 locale，但保留 ellipsis 當底）
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

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
  border-left: var(--eqt-border-width) solid var(--eqt-border);
  overflow-y: auto;
}

// 統一垂直 rhythm：每個 tab 內容區跟右欄 profile sidebar 都是垂直 stack，
// 用 flex column + gap 給容器層級的均等間距。比 owl selector (`> * + *`) 更
// 現代——gap 屬性把間距語意歸給容器本身，子元素不負責 margin。
//
// about tab 走自己的 spacing system（about__hero/about__section 用 margin-bottom
// 串接），所以用 :not(.eqt-settings__about) 排除。
.eqt-settings__tab-content:not(.eqt-settings__about),
.eqt-settings__profiles {
  display: flex;
  flex-direction: column;
  gap: 6px;

  // subtitle 是 section heading，上方要更大的 visual break。
  // margin-top 跟 gap 疊加：6px gap + 8px margin = 14px 視覺間距。
  // :not(:first-child) 避免「tab 內第一個 element 是 subtitle」時被多推 8px。
  > .eqt-settings__subtitle:not(:first-child) {
    margin-top: 8px;
  }
}

.eqt-settings {
  &__row {
    display: flex;
    align-items: center;
    gap: 8px;

    // 整個 row 區域可點 → checkbox toggle。@at-root 跳出 nesting，避免被
    // 編成 `.eqt-settings__row label.eqt-settings__row` (descendant chain)；
    // interpolation 把 & 黏進 label 才會得到 compound `label.eqt-settings__row`。
    @at-root label#{&} {
      cursor: pointer;
    }
  }

  &__label {
    user-select: none;
  }

  &__dblclick-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  &__dblclick-label {
    min-width: 5em;
    flex-shrink: 0;
  }

  &__locale-row {
    display: flex;
    gap: 4px;
  }

  &__locale-btn {
    @include btn-toned;
    padding: 3px 10px;

    &--active {
      background: var(--eqt-bg-active);
      font-weight: bold;
    }
  }

  &__select {
    padding: 3px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    // light 用 page bg（#fff 太刺），dark 走 elevated (#34353b) 對齊 EH form
    background: var(--eqt-bg);
    color: var(--eqt-text);
    font-size: 12px;

    .eqt-dark & {
      background: var(--eqt-bg-elevated);
    }
  }

  &__hint {
    margin: 0 0 0;
    font-size: 11px;
    color: var(--eqt-text-hint);
    line-height: 1.4;
  }


  &__subtitle {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__reset-btn {
    @include btn-ghost;
    gap: 2px;
    padding: 1px 6px;
    font-size: var(--eqt-fs-sm);
    line-height: 1;

    &:hover:not(:disabled) {
      color: var(--eqt-text);
    }
  }

  &__input--short {
    width: 5em;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg);
    color: var(--eqt-text);
    font-size: 13px;

    .eqt-dark & {
      background: var(--eqt-bg-elevated);
    }
  }

  &__refresh-btn {
    @include btn-toned;
    padding: 4px 8px;

    &:disabled {
      opacity: 0.5;
    }
  }

  &__ns-list {
    list-style: none;
    margin: 0;
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
    display: flex;
  }

  &__font-input {
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 13px;
    background: var(--eqt-bg);
    color: var(--eqt-text);
    box-sizing: border-box;

    .eqt-dark & {
      background: var(--eqt-bg-elevated);
    }

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
    font-size: var(--eqt-fs-xs);
    color: var(--eqt-on-primary);
    background: var(--eqt-primary);
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
    @include btn-ghost;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    // 還原 popup container 的 13px——btn-base 預設 12px 會讓 icon glyph 縮 1px
    font-size: var(--eqt-fs-lg);

    &:hover:not(:disabled) {
      background: var(--eqt-bg-active);
      color: var(--eqt-text);
    }

    // 必須加 :not(:disabled) 才不會輸 btn-ghost / 上面 hover 的 (0,3,0) 特異性，
    // 否則 purge 紅色被 var(--eqt-text) 蓋掉
    &--purge:hover:not(:disabled) {
      color: var(--eqt-danger);
    }
  }
}

</style>
