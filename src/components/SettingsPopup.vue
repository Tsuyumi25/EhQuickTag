<script setup lang="ts">
import { ref, computed, toRaw, onUnmounted } from 'vue'
import { GripVertical, Undo2, Trash2, Copy, Download, Check } from '@lucide/vue'
import Draggable from 'vuedraggable'
import { baseDragOptions } from '@/utils/drag'
import { NS_LABEL, type QuickTag } from '@/types'
import {
  profiles, activeProfileIdx, deletedProfiles, type Profile,
  deleteProfile, restoreProfile, purgeProfile, reorderProfiles, updateProfileTagLines,
  fontFamily, fontWeight, DEFAULT_TAG_LINES, tagLines,
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

const tabs = [
  { key: 'search', label: '搜尋' },
  { key: 'appearance', label: '外觀' },
] as const

type TabKey = typeof tabs[number]['key']

const activeTab = ref<TabKey | null>('search')

// --- nsOrder change handler ---

function onNsOrderChange(evt: any) {
  if (evt.moved) {
    const newOrder = [...props.nsOrder]
    const [item] = newOrder.splice(evt.moved.oldIndex, 1)
    newOrder.splice(evt.moved.newIndex, 0, item)
    emit('update:nsOrder', newOrder)
  }
}

onUnmounted(() => {
  clearTimeout(copiedTimer)
})

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
let copiedTimer: ReturnType<typeof setTimeout> | undefined

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
  if (!confirm(`確定要永久刪除「${name}」嗎？此操作無法復原。`)) return
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
  try {
    const parsed = JSON.parse(editorText.value)
    editorError.value = ''
    if (editingDeleted.value) {
      deletedProfiles[editingProfileIdx.value].tagLines = parsed
    } else {
      updateProfileTagLines(editingProfileIdx.value, parsed)
    }
  } catch (err) {
    editorError.value = (err as Error).message
  }
}

async function onEditorCopy() {
  try {
    await navigator.clipboard.writeText(editorText.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = editorText.value
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  editorCopied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { editorCopied.value = false }, 1500)
}

function onEditorExport() {
  const blob = new Blob([editorText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eh-quick-tag-${editingName.value}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')" @keydown="onKeydown">
    <div class="eqt-popup eqt-settings__layout">
      <nav class="eqt-settings__sidebar">
        <h3 class="eqt-popup__title">設定</h3>
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="eqt-settings__tab"
          :class="{ 'eqt-settings__tab--active': activeTab === tab.key }"
          @click="activeTab = tab.key; editingProfileIdx = -1"
        >{{ tab.label }}</button>
        <div class="eqt-settings__sidebar-spacer" />
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="emit('close')">
          關閉
        </button>
      </nav>

      <div class="eqt-settings__panel">
        <!-- 設定：搜尋 -->
        <div v-show="editingProfileIdx < 0">
          <div v-show="activeTab === 'search'">
            <label class="eqt-settings__row">
              <input
                type="checkbox"
                :checked="props.useNhWeight"
                @change="emit('update:useNhWeight', ($event.target as HTMLInputElement).checked)"
              />
              <span class="eqt-settings__label">使用 nhentai 人氣權重排序</span>
            </label>
            <p class="eqt-settings__hint">
              開啟後，搜尋建議會優先顯示 nhentai 上傳量高的標籤（top 500），其餘按預設公式排序。
            </p>

            <h4 class="eqt-settings__subtitle">Namespace 搜尋順序</h4>
            <p class="eqt-settings__hint">
              調整搜尋建議中 namespace 的內部排序權重。拖曳調整順序，取消勾選可隱藏該類別。<br />
              注意：此順序僅影響 namespace 之間的排列，匹配品質和 nhentai 人氣仍然優先。
            </p>
            <Draggable
              v-bind="dragOptions"
              :model-value="nsOrder"
              :item-key="(ns: string) => ns"
              handle=".eqt-settings__ns-grip"
              tag="ul"
              class="eqt-settings__ns-list"
              @change="onNsOrderChange"
            >
              <template #item="{ element: ns }">
                <li class="eqt-settings__ns-item">
                  <input
                    type="checkbox"
                    :checked="!disabledNs.has(ns)"
                    @change="toggleNs(ns)"
                  />
                  <span class="eqt-settings__ns-label">{{ NS_LABEL[ns] ?? ns }}</span>
                  <span class="eqt-settings__ns-key">{{ ns }}</span>
                  <span class="eqt-settings__ns-grip"><GripVertical :size="14" /></span>
                </li>
              </template>
            </Draggable>
          </div>

          <!-- 設定：外觀 -->
          <div v-show="activeTab === 'appearance'">
            <h4 class="eqt-settings__subtitle" style="margin-top: 0">自定義字體</h4>
            <div class="eqt-settings__font-row">
              <input
                :value="fontFamily"
                class="eqt-settings__font-input eqt-settings__font-input--full"
                placeholder="留空則使用頁面字體"
                @input="fontFamily = ($event.target as HTMLInputElement).value"
              />
            </div>
            <p class="eqt-settings__hint">
              font-family 值範例：<code>"Noto Sans TC", sans-serif</code>
            </p>

            <h4 class="eqt-settings__subtitle">字重</h4>
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
              <span class="eqt-settings__weight-value">{{ fontWeight || '預設' }}</span>
            </div>

            <h4 class="eqt-settings__subtitle">預覽</h4>
            <div class="eqt-settings__font-preview" :style="{ fontFamily: fontFamily || 'inherit', fontWeight: fontWeight || 'inherit' }">
              <template v-for="(line, li) in DEFAULT_TAG_LINES" :key="li">
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
        </div>

        <!-- JSON 編輯器 (inline) -->
        <div v-show="editingProfileIdx >= 0" class="eqt-json-editor">
          <div class="eqt-json-editor__header">
            <h4 class="eqt-json-editor__title">{{ editingName }}</h4>
            <div class="eqt-json-editor__toolbar">
              <button class="eqt-json-editor__tool-btn" type="button" :title="editorCopied ? '已複製' : '複製'" @click="onEditorCopy">
                <Check v-if="editorCopied" :size="14" />
                <Copy v-else :size="14" />
              </button>
              <button class="eqt-json-editor__tool-btn" type="button" title="匯出檔案" @click="onEditorExport">
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
                >{{ qt.label || qt.tag || '(空)' }}</span>
              </div>
            </template>
          </div>

          <textarea
            v-model="editorText"
            class="eqt-json-editor__textarea"
            spellcheck="false"
            autocomplete="off"
          />

          <p v-if="editorError" class="eqt-json-editor__error">JSON 格式錯誤：{{ editorError }}</p>

          <div class="eqt-popup__actions">
            <div class="eqt-popup__spacer" />
            <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onEditorSave">儲存</button>
          </div>
        </div>
      </div>

      <!-- 右欄：標籤組列表 -->
      <aside class="eqt-settings__profiles">
        <h4 class="eqt-settings__subtitle" style="margin-top: 0">標籤組</h4>
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
                <span v-if="i === activeProfileIdx" class="eqt-settings__active-badge">目前</span>
              </span>
              <span class="eqt-settings__item-count">{{ (i === activeProfileIdx ? tagLines : p.tagLines).flat().length }}</span>
              <button
                v-if="profiles.length > 1"
                class="eqt-settings__item-btn eqt-settings__item-btn--purge"
                type="button"
                title="移入垃圾桶"
                @click.stop="onDelete(i)"
              ><Trash2 :size="12" /></button>
            </li>
          </template>
        </Draggable>

        <template v-if="deletedProfiles.length">
          <h4 class="eqt-settings__subtitle">回收桶</h4>
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
              <button class="eqt-settings__item-btn" type="button" title="恢復" @click.stop="onRestore(i)">
                <Undo2 :size="12" />
              </button>
              <button class="eqt-settings__item-btn eqt-settings__item-btn--purge" type="button" title="永久刪除" @click.stop="onPurge(i)">
                <Trash2 :size="12" />
              </button>
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

  &__ns-grip {
    color: var(--eqt-grip);
    cursor: grab;
    user-select: none;
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
</style>
