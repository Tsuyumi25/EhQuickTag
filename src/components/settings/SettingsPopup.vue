<script setup lang="ts">
import { ref, computed, toRaw } from 'vue'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import Draggable from 'vuedraggable'
import { baseDragOptions } from '@/utils/drag'
import type { Line } from '@/types'
import { t } from '@/composables/useI18n'
import {
  profiles, activeProfileIdx, deletedProfiles, corruptedProfiles, lines,
  deleteProfile, restoreProfile, purgeProfile, purgeCorrupted, reorderProfiles, updateProfileLines,
} from '@/services/store'
import ProfileListItem from './ProfileListItem.vue'
import ProfileJsonEditor from './ProfileJsonEditor.vue'
import SettingsGeneralTab from './SettingsGeneralTab.vue'
import SettingsTagBarTab from './SettingsTagBarTab.vue'
import SettingsGalleryTab from './SettingsGalleryTab.vue'
import SettingsDataTab from './SettingsDataTab.vue'
import SettingsAboutTab from './SettingsAboutTab.vue'

const emit = defineEmits<{
  'close': []
}>()

const dragOptions = {
  ...baseDragOptions,
  ghostClass: 'eqt-settings__ns-item--ghost',
  chosenClass: 'eqt-settings__ns-item--chosen',
}

// --- tabs ---

// tab 依 scope 組織：general 收「兩個 scope 都作用」的真全域（介面語言、
// OpenCC、字體），tagbar / gallery 各對應 userscript 住在頁面上的兩個實體，
// data 是共用基礎設施。per-scope 的偏好（面板語言、定義面板語言）留在各自
// scope tab，不集中——集中就變回兩套分類軸混用
const tabKeys = ['general', 'tagbar', 'gallery', 'data', 'about'] as const
type TabKey = typeof tabKeys[number]

const tabLabelKeys: Record<TabKey, string> = {
  general: 'settings.tabGeneral',
  tagbar: 'settings.tabTagBar',
  gallery: 'settings.tabGallery',
  data: 'settings.tabData',
  about: 'settings.tabAbout',
}

const props = defineProps<{
  // 預設打開哪個 tab。caller 從不同入口開設定時可以指定 context，譬如
  // gallery 的 settings 按鈕傳 'gallery' 直接落到對應分頁。用 string 不用
  // TabKey 是因為 caller (App.vue) 不該被 SettingsPopup 內部 tabKeys 集合
  // 綁死；不認識的字串就 fallback 到預設 tab
  initialTab?: string | null
}>()

function narrowTab(s: string | null | undefined): TabKey | null {
  return s && (tabKeys as readonly string[]).includes(s) ? (s as TabKey) : null
}

const activeTab = ref<TabKey | null>(narrowTab(props.initialTab) ?? 'general')

function tagCount(lines: Line[]): number {
  // spacer 是排版物不是標籤,不計入 profile 徽章數
  return lines.reduce((sum, l) => sum + (l.kind === 'buttons' ? l.buttons.filter(b => b.kind !== 'spacer').length : 0), 0)
}

const tagCounts = computed(() => profiles.map((p, i) =>
  tagCount(i === activeProfileIdx.value ? lines : p.lines),
))
const deletedTagCounts = computed(() => deletedProfiles.map(p => tagCount(p.lines)))

const popupEl = ref<HTMLElement | null>(null)
usePopupBehavior({ popupEl, onClose: () => emit('close') })

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
        <button class="eqt-popup__btn eqt-settings__close-btn" type="button" @click="emit('close')">
          {{ t('settings.close') }}
        </button>
      </nav>

      <div class="eqt-settings__panel">
        <div v-show="editingProfileIdx < 0" class="eqt-settings__panel-inner">
          <SettingsTagBarTab v-show="activeTab === 'tagbar'" />
          <SettingsGalleryTab v-show="activeTab === 'gallery'" />
          <SettingsDataTab v-show="activeTab === 'data'" />
          <SettingsGeneralTab v-show="activeTab === 'general'" />
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
@use '../../styles/settings';

.eqt-settings__layout {
  display: flex;
  width: clamp(44rem, 94vw, 88rem);
  min-height: 94vh;
  max-height: 94vh;
  // 面板內所有表單控制項的統一高度。25px 對齊原設計的中心值：全域自繪
  // checkbox 是 25px（--eqt-checkbox-size）、locale-btn 原本 padding 撐出
  // ~25px，其餘控制項向這個基準收斂
  --eqt-ctrl-h: 25px;
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

#eqt-app .eqt-settings__close-btn {
  font-weight: bold;
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

// scroll 跟 padding 分屬兩個 element (跟 Radix / shadcn / MUI dialog 同 pattern)：
//   panel        只做 scroll container, 沒有 padding
//   panel-inner  自然高度容器, 帶 padding, 給一般 tab mode 用
//   json-editor  editor mode 撐滿 panel 全高
// 混在同個 element 上會踩 flex-stretch + overflow + padding-bottom 三者互相干擾
// 的 spec corner case (scroll-to-end 時 padding-bottom 被 overflow content 蓋掉)
.eqt-settings__panel {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;

  .eqt-json-editor {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

.eqt-settings__panel-inner {
  padding: 1.25rem;
}

.eqt-settings__profiles {
  width: 15rem;
  flex-shrink: 0;
  padding: 1.25rem 0.75rem;
  border-left: var(--eqt-border-width) solid var(--eqt-border);
  overflow-y: auto;
}

// 右欄 profile sidebar 維持輕量節奏：無分隔線，subtitle 上方推 8px 當
// visual break（6px gap + 8px margin = 14px）
.eqt-settings__profiles {
  display: flex;
  flex-direction: column;
  gap: 6px;

  > .eqt-settings__subtitle:not(:first-child) {
    margin-top: 8px;
  }
}

.eqt-settings {
  &__ns-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
}
</style>
