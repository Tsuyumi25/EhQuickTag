<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import Draggable from 'vuedraggable'
import { ChevronLeft, ChevronRight, ExternalLink, GripVertical, Trash2, Pencil, Check, Settings, Plus, Info } from '@lucide/vue'
import { TagState, type QuickTag } from '@/types'
import { tokenize, normalizeNs, getState as _getState, removeTag, addTag, getNextRightClickState } from '@/services/tagState'
import { tagLines, dblClickLeft, dblClickRight, type DblClickAction } from '@/services/store'
import { baseDragOptions } from '@/utils/drag'
import { t } from '@/composables/useI18n'

const ACTION_KEYS: Record<DblClickAction, string> = {
  search: 'tagbar.search',
  searchNewTab: 'tagbar.searchNewTab',
  clearSearch: 'tagbar.clearSearch',
}

const STATE_CLASS: Record<TagState, string | null> = {
  [TagState.Include]: 'eqt-tag-bar__btn--include',
  [TagState.Or]:      'eqt-tag-bar__btn--or',
  [TagState.Exclude]: 'eqt-tag-bar__btn--exclude',
  [TagState.Off]:     null,
}

const props = defineProps<{
  searchText: string
  profileName: string
  profileIdx: number
  profileCount: number
  prevProfileName: string
  nextProfileName: string
}>()

const emit = defineEmits<{
  'update:searchText': [value: string]
  'configure': [lineIdx: number, tagIdx: number]
  'add': []
  'addUrl': []
  'settings': []
  'prevProfile': []
  'nextProfile': []
  'renameProfile': [name: string]
  'createProfile': [name: string]
  'deleteProfile': []
  'search': [action: DblClickAction]
}>()

const editing = ref(false)

let lastRightClickTime = 0

function isInteractive(e: MouseEvent) {
  return (e.target as HTMLElement).closest('button, a, input')
}

function onBarDblClick(e: MouseEvent) {
  if (editing.value || isInteractive(e)) return
  e.preventDefault()
  e.stopPropagation()
  window.getSelection()?.removeAllRanges()
  execDblClickAction(dblClickLeft.value)
}

function onBarContextMenu(e: MouseEvent) {
  if (editing.value || isInteractive(e)) return
  e.preventDefault()
  const now = Date.now()
  if (now - lastRightClickTime < 500) {
    execDblClickAction(dblClickRight.value)
    lastRightClickTime = 0
  } else {
    lastRightClickTime = now
  }
}

function execDblClickAction(action: DblClickAction) {
  if (action === 'clearSearch') {
    emit('update:searchText', '')
  } else {
    emit('search', action)
  }
}

// --- profile carousel ---

const onCreationPage = ref(false)
const renamingProfile = ref(false)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function onPrev() {
  if (onCreationPage.value) {
    onCreationPage.value = false
  } else {
    emit('prevProfile')
  }
}

function onNext() {
  if (props.profileIdx === props.profileCount - 1) {
    onCreationPage.value = true
  } else {
    emit('nextProfile')
  }
}

function startRenameOrCreate() {
  renameValue.value = onCreationPage.value ? '' : props.profileName
  renamingProfile.value = true
  nextTick(() => renameInput.value?.select())
}

function finishRenameOrCreate() {
  const trimmed = renameValue.value.trim()
  if (onCreationPage.value) {
    if (trimmed) {
      emit('createProfile', trimmed)
      onCreationPage.value = false
    }
  } else if (trimmed && trimmed !== props.profileName) {
    emit('renameProfile', trimmed)
  }
  renamingProfile.value = false
}

// --- draggable change handlers ---

let tagDragging = false

function onLineChange(evt: any) {
  if (evt.moved) {
    const [line] = tagLines.splice(evt.moved.oldIndex, 1)
    tagLines.splice(evt.moved.newIndex, 0, line)
  }
}

function onTagChange(lineIdx: number, evt: any) {
  if (evt.added) {
    tagLines[lineIdx].splice(evt.added.newIndex, 0, evt.added.element)
  }
  if (evt.removed) {
    tagLines[lineIdx].splice(evt.removed.oldIndex, 1)
  }
  if (evt.moved) {
    const [item] = tagLines[lineIdx].splice(evt.moved.oldIndex, 1)
    tagLines[lineIdx].splice(evt.moved.newIndex, 0, item)
  }
}

function onTagStart() { tagDragging = true }
function onTagEnd() { setTimeout(() => { tagDragging = false }, 0) }

function onAddLine() { tagLines.push([]) }
function onDeleteLine(li: number) { tagLines.splice(li, 1) }

function onConfigure(li: number, ti: number) {
  if (tagDragging) return
  emit('configure', li, ti)
}

function tagKey(qt: QuickTag) { return qt.tag || qt.url || '' }

const lineDragOptions = {
  ...baseDragOptions,
  ghostClass: 'eqt-tag-bar__line-wrap--ghost',
}

const tagDragOptions = {
  ...baseDragOptions,
  group: 'eqt-tags',
  ghostClass: 'eqt-tag-bar__btn--ghost',
  chosenClass: 'eqt-tag-bar__btn--chosen',
  dragClass: 'eqt-tag-bar__btn--drag',
}

// --- search text parsing ---

const tokenSet = computed(() => new Set(tokenize(props.searchText).map(normalizeNs)))

function getState(tag: string): TagState {
  return _getState(tag, tokenSet.value)
}

// --- normal mode handlers ---

function onLeftClick(tag: string) {
  const state = getState(tag)
  const cleaned = removeTag(props.searchText, tag)

  emit(
    'update:searchText',
    state === TagState.Off ? addTag(cleaned, tag, TagState.Include) : cleaned,
  )
}

function onRightClick(event: MouseEvent, qt: QuickTag) {
  event.preventDefault()

  const state = getState(qt.tag)
  const next = getNextRightClickState(qt, state)
  if (next === null) return

  const cleaned = removeTag(props.searchText, qt.tag)
  emit('update:searchText', next === TagState.Off ? cleaned : addTag(cleaned, qt.tag, next))
}
</script>

<template>
  <div class="eqt-tag-bar" @dblclick="onBarDblClick" @contextmenu="onBarContextMenu">
    <span class="eqt-tag-bar__info"><Info :size="16" /><span class="eqt-tag-bar__info-text">{{ t('tagbar.infoTooltip', { left: t(ACTION_KEYS[dblClickLeft]), right: t(ACTION_KEYS[dblClickRight]) }) }}</span></span>
    <div class="eqt-tag-bar__lines">
      <div class="eqt-tag-bar__profile-row">
        <button
          class="eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--prev"
          type="button"
          :disabled="profileIdx === 0 && !onCreationPage"
          @click="onPrev"
        >{{ onCreationPage ? profileName : prevProfileName }} <ChevronLeft :size="12" /></button>
        <input
          v-if="renamingProfile"
          ref="renameInput"
          v-model="renameValue"
          class="eqt-tag-bar__profile-input"
          @keydown.enter="finishRenameOrCreate"
          @keydown.escape="renamingProfile = false"
          @blur="finishRenameOrCreate"
        />
        <div v-else class="eqt-tag-bar__profile-split">
          <button
            class="eqt-tag-bar__profile-split-name"
            type="button"
            @click="startRenameOrCreate"
          >{{ onCreationPage ? t('tagbar.newProfile') : profileName }}</button>
          <button
            class="eqt-tag-bar__profile-split-delete"
            :class="{ 'eqt-tag-bar__profile-split-delete--hidden': !editing || onCreationPage }"
            type="button"
            :tabindex="(!editing || onCreationPage) ? -1 : undefined"
            :disabled="profileCount <= 1"
            @click="emit('deleteProfile')"
          ><Trash2 :size="12" /></button>
        </div>
        <button
          class="eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--next"
          type="button"
          :disabled="onCreationPage"
          @click="onNext"
        ><ChevronRight :size="12" /> {{ onCreationPage ? '' : nextProfileName }}</button>
      </div>
      <template v-if="onCreationPage">
        <div v-for="n in tagLines.length" :key="n" class="eqt-tag-bar__line-wrap">
          <div class="eqt-tag-bar__line"></div>
        </div>
      </template>
      <Draggable
        v-else
        v-bind="lineDragOptions"
        :model-value="tagLines"
        :item-key="(_: any, i: number) => i"
        handle=".eqt-tag-bar__handle"
        :disabled="!editing"
        class="eqt-tag-bar__line-rows"
        @change="onLineChange"
      >
        <template #item="{ element: line, index: li }">
          <div class="eqt-tag-bar__line-wrap">
            <div class="eqt-tag-bar__handle" :class="{ 'eqt-tag-bar__handle--hidden': !editing }" :title="t('tagbar.handleTitle')"><GripVertical :size="14" /></div>
            <button
              v-if="editing && line.length === 0"
              class="eqt-tag-bar__line-delete"
              type="button"
              :title="t('tagbar.deleteLine')"
              @click="onDeleteLine(li)"
            ><Trash2 :size="12" /></button>
            <Draggable
              v-bind="tagDragOptions"
              :model-value="tagLines[li]"
              :item-key="tagKey"
              :disabled="!editing"
              tag="div"
              class="eqt-tag-bar__line"
              @change="onTagChange(li, $event)"
              @start="onTagStart"
              @end="onTagEnd"
            >
              <template #item="{ element: qt, index: ti }">
                <a
                  v-if="qt.url && !editing"
                  :href="qt.url"
                  class="eqt-tag-bar__btn eqt-tag-bar__btn--url"
                ><ExternalLink :size="12" /> {{ qt.label || qt.url }}</a>

                <button
                  v-else-if="qt.url"
                  class="eqt-tag-bar__btn eqt-tag-bar__btn--editing"
                  type="button"
                  @click="onConfigure(li, ti)"
                ><ExternalLink :size="12" /> {{ qt.label || qt.url }}</button>

                <button
                  v-else
                  class="eqt-tag-bar__btn"
                  :class="editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(qt.tag)]"
                  type="button"
                  @click="editing ? onConfigure(li, ti) : onLeftClick(qt.tag)"
                  @contextmenu.prevent="!editing && onRightClick($event, qt)"
                >{{ qt.label || qt.tag }}</button>
              </template>
            </Draggable>
          </div>
        </template>
      </Draggable>
      <div class="eqt-tag-bar__bottom-row">
        <button
          v-if="editing"
          class="eqt-tag-bar__line-add"
          type="button"
          @click="onAddLine"
        ><Plus :size="12" /> {{ t('tagbar.addLine') }}</button>
        <div class="eqt-tag-bar__controls">
          <button
            class="eqt-tag-bar__ctrl"
            type="button"
            @click="emit('add')"
          ><Plus :size="12" /> {{ t('tagbar.addTag') }}</button>

          <button
            class="eqt-tag-bar__ctrl"
            type="button"
            @click="emit('addUrl')"
          ><ExternalLink :size="12" /> {{ t('tagbar.addUrl') }}</button>

          <button
            class="eqt-tag-bar__ctrl eqt-tag-bar__ctrl--toggle"
            type="button"
            @click="editing = !editing"
          ><span :class="{ 'eqt-tag-bar__ctrl-hidden': !editing }"><Check :size="12" /> {{ t('tagbar.done') }}</span><span :class="{ 'eqt-tag-bar__ctrl-hidden': editing }"><Pencil :size="12" /> {{ t('tagbar.edit') }}</span></button>

          <button
            class="eqt-tag-bar__ctrl"
            type="button"
            @click="emit('settings')"
          ><Settings :size="12" /> {{ t('tagbar.settings') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-tag-bar {
  position: relative;
  padding: 6px 0;

  &:has(.eqt-tag-bar__info:hover) {
    background: var(--eqt-bg-hover);
  }

  &__info {
    position: absolute;
    top: 4px;
    left: 4px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--eqt-text-secondary);
    font-size: 11px;
    user-select: none;

    &:hover {
      background: var(--eqt-bg-btn);
    }
  }

  &__info-text {
    display: none;

    .eqt-tag-bar__info:hover & {
      display: inline;
    }
  }

  &__lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 80%;
    margin: 0 auto;
  }

  &__line-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__line-wrap {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 4px;

    &--ghost {
      opacity: 0.4;
    }
  }

  &__handle {
    position: absolute;
    right: 100%;
    top: 0;
    display: flex;
    align-items: center;
    height: 24px;
    cursor: grab;
    color: var(--eqt-text-hint);
    user-select: none;
    padding: 0 4px 0 0;

    &:hover {
      color: var(--eqt-text-secondary);
    }

    &:active {
      cursor: grabbing;
    }

    &--hidden {
      visibility: hidden;
      pointer-events: none;
    }
  }

  &__bottom-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__line-add {
    flex: 1;
    padding: 2px 8px;
    border: var(--eqt-border-width) dashed var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
    text-align: center;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  &__line-delete {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    padding: 0 2px;

    &:hover {
      color: #8c3333;
    }
  }

  &__line {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 24px;
  }

  &__controls {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  &__profile-row {
    display: flex;
    align-items: stretch;
    gap: 4px;
  }


  &__profile-nav {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 11px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--prev,
    &--next {
      text-align: center;
    }

    &:hover:not(:disabled) {
      background: var(--eqt-bg-hover);
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  &__profile-split {
    flex: 5;
    position: relative;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    min-width: 0;
  }

  &__profile-split-name {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    line-height: 1.4;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      background: var(--eqt-bg-hover);
    }
  }

  &__profile-split-delete {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    padding: 0 8px;
    border: none;
    border-left: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 0 3px 3px 0;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 11px;
    line-height: 1.4;

    &:hover:not(:disabled) {
      background: rgba(140, 51, 51, 0.15);
      color: #8c3333;
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }

    &--hidden {
      visibility: hidden;
      pointer-events: none;
    }
  }

  &__profile-input {
    flex: 5;
    padding: 0;
    border: var(--eqt-border-width) solid var(--eqt-border-focus);
    border-radius: 3px;
    background: var(--eqt-bg);
    color: var(--eqt-text-secondary);
    font-size: 13px;
    font-weight: bold;
    line-height: 1.4;
    text-align: center;
    box-sizing: border-box;

    &:focus {
      outline: none;
    }
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
    transition: background 0.15s, border-color 0.15s, color 0.15s;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--url {
      text-decoration: none;
    }

    &--include {
      background: #4a7c59;
      border-color: #3d6b4a;
      color: #fff;

      &:hover {
        background: #3d6b4a;
      }
    }

    &--or {
      background: #b8860b;
      border-color: #9a7209;
      color: #fff;

      &:hover {
        background: #9a7209;
      }
    }

    &--exclude {
      background: #8c3333;
      border-color: #743030;
      color: #fff;
      text-decoration: line-through;

      &:hover {
        background: #743030;
      }
    }

    &--editing {
      border-style: dashed;
      cursor: grab;

      &:hover {
        background: var(--eqt-bg-hover);
      }
    }

    &--ghost {
      opacity: 0.4;
    }

    &--chosen {
      cursor: grabbing;
    }

    &--drag {
      opacity: 0.8;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  }

  &__ctrl {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--toggle {
      display: inline-grid;
      align-items: center;

      > * {
        grid-area: 1 / 1;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }
  }

  &__ctrl-hidden {
    visibility: hidden;
  }
}
</style>
