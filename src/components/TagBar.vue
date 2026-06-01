<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import Draggable from 'vuedraggable'
import { ChevronLeft, ChevronRight, ExternalLink, GripVertical, Trash2, Pencil, Check, Settings, Plus, Info } from '@lucide/vue'
import ContentEditable from 'vue-contenteditable'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import SeparatorSettingsPopup from '@/components/SeparatorSettingsPopup.vue'
import { TagState, type Line, type Button, type TagButton } from '@/types'
import { tokenize, getState as _getState, setTagState, getNextRightClickState } from '@/services/tagState'
import { lines, dblClickLeft, dblClickRight, useAccentOnInclude, type DblClickAction } from '@/services/store'
import { baseDragOptions } from '@/utils/drag'
import { t } from '@/composables/useI18n'
import { currentTagStyleClass } from '@/composables/useTagStyle'

const ACTION_KEYS: Record<DblClickAction, string> = {
  search: 'tagbar.search',
  searchNewTab: 'tagbar.searchNewTab',
  clearSearch: 'tagbar.clearSearch',
  none: 'tagbar.none',
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

const controlsEl = ref<HTMLElement | null>(null)
const controlsWidth = ref<number | null>(null)
useResizeObserver(controlsEl, ([entry]) => {
  controlsWidth.value = entry.contentRect.width
})
function captureControlsEl(el: unknown, li: number) {
  if (li === 0) controlsEl.value = (el as HTMLElement) ?? null
}

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
  if (action === 'none') return
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
    const [line] = lines.splice(evt.moved.oldIndex, 1)
    lines.splice(evt.moved.newIndex, 0, line)
  }
}

function onTagChange(lineIdx: number, evt: any) {
  const line = lines[lineIdx]
  if (line.kind !== 'buttons') return
  if (evt.added) {
    line.buttons.splice(evt.added.newIndex, 0, evt.added.element)
  }
  if (evt.removed) {
    line.buttons.splice(evt.removed.oldIndex, 1)
  }
  if (evt.moved) {
    const [item] = line.buttons.splice(evt.moved.oldIndex, 1)
    line.buttons.splice(evt.moved.newIndex, 0, item)
  }
}

function onTagStart() { tagDragging = true }
function onTagEnd() { setTimeout(() => { tagDragging = false }, 0) }

function onAddButtonLine() { lines.push({ kind: 'buttons', buttons: [] }) }
function onAddSeparatorLine() { lines.push({ kind: 'separator' }) }

// 空行可以直接刪（誤按零損失）；有內容才彈 confirm：
//   ButtonLine 有 button、SeparatorLine 有 label 或調過 style 視為「有內容」
function isLineEmpty(line: Line): boolean {
  if (line.kind === 'buttons') return line.buttons.length === 0
  return !line.label && (!line.style || Object.keys(line.style).length === 0)
}
function onDeleteLine(li: number) {
  if (!isLineEmpty(lines[li]) && !confirm(t('tagbar.deleteLineConfirm'))) return
  lines.splice(li, 1)
}

function onConfigure(li: number, ti: number) {
  if (tagDragging) return
  emit('configure', li, ti)
}

function buttonKey(b: Button) {
  return b.kind === 'tag' ? b.tags.join(',') : b.url
}

function onUpdateLine(li: number, newLine: Line) {
  lines[li] = newLine
}

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

const tokenSet = computed(() => new Set(tokenize(props.searchText)))

function getState(b: TagButton): TagState {
  return _getState(b.tags, tokenSet.value)
}

// --- normal mode handlers ---

function onLeftClick(b: TagButton) {
  const state = getState(b)
  // 身份模型語意：左鍵 = 「這是我對這身份的主要態度」。
  //   - Include → Off （toggle off）
  //   - Off / Or / Exclude → Include （宣告：我要這個身份是 Include view）
  // Or / Exclude 不被當作 toggle-off 觸發態，避免「另一顆按鈕 emit 了 -X，
  // 點本顆要兩次才能 include」的反直覺 UX。
  const next = state === TagState.Include ? TagState.Off : TagState.Include
  emit('update:searchText', setTagState(props.searchText, b.tags, next))
}

function onRightClick(event: MouseEvent, b: TagButton) {
  event.preventDefault()
  const state = getState(b)
  const next = getNextRightClickState(b.tags, b.disabledModes, state)
  if (next === null) return
  emit('update:searchText', setTagState(props.searchText, b.tags, next))
}
</script>

<template>
  <div class="eqt-tag-bar" :class="[currentTagStyleClass, { 'eqt-tag-bar--accent-on-include': useAccentOnInclude }]" :style="controlsWidth !== null ? { '--eqt-controls-w': controlsWidth + 'px' } : undefined" @dblclick="onBarDblClick" @contextmenu="onBarContextMenu">
    <div class="eqt-tag-bar__lines">
      <div class="eqt-tag-bar__profile-row">
        <span class="eqt-tag-bar__info"><Info :size="16" /><span class="eqt-tag-bar__info-text">{{ t('tagbar.infoTooltip', { left: t(ACTION_KEYS[dblClickLeft]), right: t(ACTION_KEYS[dblClickRight]) }) }}</span></span>
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
        <div v-for="n in lines.length" :key="n" class="eqt-tag-bar__line-wrap">
          <div class="eqt-tag-bar__line"></div>
        </div>
      </template>
      <Draggable
        v-else
        v-bind="lineDragOptions"
        :model-value="lines"
        :item-key="(_: any, i: number) => i"
        handle=".eqt-tag-bar__handle"
        :disabled="!editing"
        class="eqt-tag-bar__line-rows"
        @change="onLineChange"
      >
        <template #item="{ element: line, index: li }">
          <div class="eqt-tag-bar__line-wrap">
            <div
              :ref="(el) => captureControlsEl(el, li)"
              class="eqt-tag-bar__line-controls"
            >
              <div class="eqt-tag-bar__handle" :class="{ 'eqt-tag-bar__handle--hidden': !editing }" :title="t('tagbar.handleTitle')"><GripVertical :size="14" /></div>
            </div>

            <div
              v-if="line.kind === 'separator'"
              class="eqt-tag-bar__line eqt-tag-bar__line--separator"
              :class="[
                `eqt-tag-bar__line--separator-${line.style?.line ?? 'solid'}`,
                `eqt-tag-bar__line--separator-pos-${line.style?.linePosition ?? 'middle'}`,
                `eqt-tag-bar__line--separator-align-${line.style?.textAlign ?? 'left'}`,
              ]"
              :style="{
                ...(line.color ? { '--line-color': line.color } : {}),
                ...(line.style?.lineThickness ? { '--separator-line-thickness': `${line.style.lineThickness}px` } : {}),
                ...(line.style?.lineLength !== undefined ? { '--separator-line-length': `${line.style.lineLength}%` } : {}),
                ...(line.style?.textSize ? { fontSize: `${line.style.textSize}px` } : {}),
              }"
            >
              <ContentEditable
                v-if="editing"
                tag="span"
                :model-value="line.label ?? ''"
                @update:model-value="(v: string) => line.label = (v && v !== '\n') ? v : undefined"
                :contenteditable="'plaintext-only'"
                class="eqt-tag-bar__separator-label eqt-tag-bar__separator-label--editing"
                :data-placeholder="t('tagbar.separatorLabelPlaceholder')"
                spellcheck="false"
                no-nl
              />
              <span v-else-if="line.label" class="eqt-tag-bar__separator-label">{{ line.label }}</span>
            </div>

            <Draggable
              v-else
              v-bind="tagDragOptions"
              :model-value="line.buttons"
              :item-key="buttonKey"
              :disabled="!editing"
              tag="div"
              class="eqt-tag-bar__line"
              :style="line.color ? { '--line-color': line.color } : undefined"
              @change="onTagChange(li, $event)"
              @start="onTagStart"
              @end="onTagEnd"
            >
              <template #item="{ element: b, index: ti }">
                <a
                  v-if="b.kind === 'url' && !editing"
                  :href="b.url"
                  class="eqt-tag-bar__btn eqt-tag-bar__btn--url"
                  :style="b.color ? { '--line-color': b.color } : undefined"
                ><ExternalLink :size="12" /> {{ b.label || b.url }}</a>

                <button
                  v-else-if="b.kind === 'url'"
                  class="eqt-tag-bar__btn eqt-tag-bar__btn--editing"
                  type="button"
                  :style="b.color ? { '--line-color': b.color } : undefined"
                  @click="onConfigure(li, ti)"
                ><ExternalLink :size="12" /> {{ b.label || b.url }}</button>

                <button
                  v-else
                  class="eqt-tag-bar__btn"
                  :class="editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(b)]"
                  type="button"
                  :style="b.color ? { '--line-color': b.color } : undefined"
                  @click="editing ? onConfigure(li, ti) : onLeftClick(b)"
                  @contextmenu.prevent="!editing && onRightClick($event, b)"
                >{{ b.label || b.tags.join(', ') }}</button>
              </template>
            </Draggable>

            <SeparatorSettingsPopup
              v-if="editing && line.kind === 'separator'"
              :line="line"
              @update:line="onUpdateLine(li, $event)"
            />
            <LineColorSwatch
              v-if="editing"
              :model-value="line.color"
              @update:model-value="line.color = $event"
            />
            <button
              v-if="editing"
              class="eqt-tag-bar__line-delete"
              type="button"
              :title="t('tagbar.deleteLine')"
              @click="onDeleteLine(li)"
            ><Trash2 :size="12" /></button>
          </div>
        </template>
      </Draggable>
      <div class="eqt-tag-bar__bottom-row">
        <div v-if="editing" class="eqt-tag-bar__line-add">
          <button
            class="eqt-tag-bar__line-add-btn"
            type="button"
            @click="onAddButtonLine"
          ><Plus :size="12" /> {{ t('tagbar.addButtonLine') }}</button>
          <button
            class="eqt-tag-bar__line-add-btn"
            type="button"
            @click="onAddSeparatorLine"
          ><Plus :size="12" /> {{ t('tagbar.addSeparatorLine') }}</button>
        </div>
        <div class="eqt-tag-bar__controls">
          <div class="eqt-tag-bar__ctrl-split">
            <button
              class="eqt-tag-bar__ctrl-split-btn"
              type="button"
              @click="emit('add')"
            ><Plus :size="12" /> {{ t('tagbar.addTag') }}</button>
            <button
              class="eqt-tag-bar__ctrl-split-btn"
              type="button"
              @click="emit('addUrl')"
            ><ExternalLink :size="12" /> {{ t('tagbar.addUrl') }}</button>
          </div>

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
// 兩顆 button 共用外框 + 中間 divider 的 split 群組樣式。
// 給編輯態的「+ 行 / + 分隔線」和 ctrl 區的「+ 標籤 / + URL」共用視覺。
@mixin button-split-group {
  display: flex;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 3px;
  overflow: hidden;
}

@mixin button-split-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;

  &:hover {
    background: var(--eqt-bg-hover);
    color: var(--eqt-text-secondary);
  }

  & + & {
    border-left: var(--eqt-border-width) solid var(--eqt-border);
  }
}

.eqt-tag-bar {
  position: relative;
  padding: 6px 0;

  // 強制 include 走 status 綠色：把 --include-base 設成 status-include，
  // tag-style.scss mixin 的 var(--include-base, var(--line-color, ...)) 就會
  // resolve 到綠色，line-color 對 include 狀態的影響被「關掉」。
  &--accent-on-include {
    --include-base: var(--eqt-status-include);
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: var(--eqt-bg);
    background-image: linear-gradient(var(--eqt-bg-hover), var(--eqt-bg-hover));
    clip-path: circle(0 at 14px 14px);
    opacity: 0;
    pointer-events: none;
    z-index: 1;
    transition: clip-path 0.4s ease-out, opacity 0.4s ease-out;
  }

  &:has(.eqt-tag-bar__info:hover)::before {
    clip-path: circle(150% at 14px 14px);
    opacity: 0.9;
  }

  &__info {
    position: absolute;
    right: 100%;
    top: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: var(--eqt-row-h);
    height: var(--eqt-row-h);
    padding: 0;
    border-radius: 3px;
    color: var(--eqt-text-secondary);
    font-size: 11px;
    user-select: none;
    z-index: 2;
  }

  &__info-text {
    display: none;
    position: absolute;
    left: 100%;
    top: 0;
    margin-left: 6px;
    padding: 2px 8px;
    background: var(--eqt-bg);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    color: var(--eqt-text-secondary);
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;

    .eqt-tag-bar__info:hover & {
      display: block;
    }
  }

  &__lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: calc(100% - 2 * var(--eqt-controls-w, 10%));
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

  &__line-controls {
    position: absolute;
    right: 100%;
    top: 0;
    display: flex;
    align-items: center;
    height: var(--eqt-row-h);
  }

  &__handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--eqt-row-h);
    height: var(--eqt-row-h);
    padding: 0;
    cursor: grab;
    color: var(--eqt-text-hint);
    user-select: none;

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

  // 編輯態下方的「+ 行 / + 分隔線」split。flex: 1 撐滿剩餘空間
  &__line-add {
    flex: 1;
    @include button-split-group;
  }
  &__line-add-btn {
    flex: 1;
    @include button-split-item;
  }

  // 右下 ctrl 區的「+ 標籤 / + URL」split；hug content 不撐。
  // 色彩 override mixin 預設的「外框 + hint 文字」，改成跟旁邊獨立 ctrl
  // 一致的「bg-btn 填充 + secondary 文字」，視覺權重才不會掉一階。
  &__ctrl-split {
    @include button-split-group;
    background: var(--eqt-bg-btn);
  }
  &__ctrl-split-btn {
    @include button-split-item;
    color: var(--eqt-text-secondary);
  }

  &__line-delete {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--eqt-row-h);
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    padding: 0 4px;

    &:hover {
      color: #8c3333;
    }
  }

  &__line {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: var(--eqt-row-h);
  }

  // Separator line：base 預設為 middle layout（左線 + label + 右線）。
  // 預設視覺定義在這裡——沒被使用者覆寫的欄位走 CSS 預設，覆寫的欄位透過
  // inline `:style` (fontSize / --separator-line-thickness) 或修飾 class
  // (--separator-{solid|dashed|none}、--separator-pos-{top|middle|bottom}、
  // --separator-align-{left|center|right}) override。
  //
  // linePosition 三種 layout：
  //   middle（預設）：row flex，label 在線中間，::before/::after 各為一段線
  //   top：column flex，::before 是頂部全寬線，label 在下
  //   bottom：column flex，::after 是底部全寬線，label 在上
  //
  // textAlign 在 middle 模式下控制線比例（label 居左 / 中 / 右）；
  // 在 top / bottom 模式下控制 label 文字對齊。
  // Separator line：容器是「絕對空間」，linePosition 決定線釘在哪個邊緣。
  //   middle：線在容器中軸，靠 ::before/::after 兩段 flex item 達成（線會避開 label）
  //   top：::before absolute 釘容器頂，label 在容器內 align flex-start
  //   bottom：::after absolute 釘容器底，label 在容器內 align flex-end
  // textAlign 在 middle 模式控制 ::before/::after 比例；在 top/bottom 模式控制 label justify
  &__line--separator {
    position: relative;
    min-height: var(--eqt-row-h);
    // 文字色 / 線色 fallback 都用 --eqt-border：EX 的 --eqt-divider 很暗
    // (#4f535b 接近 bg)，分隔線幾乎看不見；統一用 --eqt-border (#8d8d8d)
    // 讓無 line-color 時也有最低能見度，跟其他 UI border 視覺一致。
    color: var(--line-color, var(--eqt-border));
    font-size: 10px;
    line-height: 1.4;
    // 線長 1-100%，預設 100%；由 SeparatorStyle.lineLength inline :style 設定
    --separator-line-length: 100%;

    &::before,
    &::after {
      content: '';
      border-top: var(--separator-line-thickness, 2px) solid var(--line-color, var(--eqt-border));
    }
  }

  // middle：row flex
  //   無 label：::after 隱藏，::before 單條取 lineLength，align 決定 justify
  //   有 label：::before / ::after 兩段 flex:1 把 label 推中間，align 控制比例
  //   lineLength: middle 用 max-width 限制 ::before / ::after 寬度
  &__line--separator-pos-middle {
    display: flex;
    flex-direction: row;
    align-items: center;

    &::before,
    &::after {
      flex: 1;
    }

    &:not(:has(.eqt-tag-bar__separator-label)) {
      &::after { display: none; }
      &::before { max-width: var(--separator-line-length); }
      &.eqt-tag-bar__line--separator-align-left { justify-content: flex-start; }
      &.eqt-tag-bar__line--separator-align-center { justify-content: center; }
      &.eqt-tag-bar__line--separator-align-right { justify-content: flex-end; }
    }

    &:has(.eqt-tag-bar__separator-label) {
      gap: 8px;

      // default center: 兩線各 max lineLength/2
      &::before,
      &::after {
        max-width: calc(var(--separator-line-length) / 2);
      }

      &.eqt-tag-bar__line--separator-align-left {
        &::before { flex: 0; border-top: 0; }
        &::after { max-width: var(--separator-line-length); }
      }
      &.eqt-tag-bar__line--separator-align-right {
        &::after { flex: 0; border-top: 0; }
        &::before { max-width: var(--separator-line-length); }
      }
    }
  }

  // top：::before absolute 釘容器頂，label align flex-start
  //   lineLength 透過 left/right inset 控制線寬範圍
  &__line--separator-pos-top {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: calc(var(--separator-line-thickness, 2px) + 2px);

    &::before {
      position: absolute;
      top: 0;
      // default align-center: 兩端對稱 inset
      left: calc((100% - var(--separator-line-length)) / 2);
      right: calc((100% - var(--separator-line-length)) / 2);
    }
    &::after { display: none; }

    &.eqt-tag-bar__line--separator-align-left {
      justify-content: flex-start;
      &::before {
        left: 0;
        right: calc(100% - var(--separator-line-length));
      }
    }
    &.eqt-tag-bar__line--separator-align-right {
      justify-content: flex-end;
      &::before {
        left: calc(100% - var(--separator-line-length));
        right: 0;
      }
    }
  }

  // bottom：::after absolute 釘容器底，label align flex-end
  &__line--separator-pos-bottom {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: calc(var(--separator-line-thickness, 2px) + 2px);

    &::before { display: none; }
    &::after {
      position: absolute;
      bottom: 0;
      left: calc((100% - var(--separator-line-length)) / 2);
      right: calc((100% - var(--separator-line-length)) / 2);
    }

    &.eqt-tag-bar__line--separator-align-left {
      justify-content: flex-start;
      &::after {
        left: 0;
        right: calc(100% - var(--separator-line-length));
      }
    }
    &.eqt-tag-bar__line--separator-align-right {
      justify-content: flex-end;
      &::after {
        left: calc(100% - var(--separator-line-length));
        right: 0;
      }
    }
  }

  // 線型修飾
  &__line--separator-dashed {
    &::before,
    &::after {
      border-top-style: dashed;
    }
  }

  &__line--separator-none {
    &::before,
    &::after {
      border-top: 0;
    }
  }

  &__separator-label {
    flex-shrink: 0;
    white-space: nowrap;
    user-select: none;
  }

  // editing 時用 contenteditable span 做 in-place 編輯（WYSIWYG）
  // 跟非編輯狀態的 __separator-label 共用一套樣式（font / color / text-align），
  // 只多 cursor 跟 placeholder。
  &__separator-label--editing {
    cursor: text;
    outline: none;

    &:empty::before,
    &:has(> br:only-child)::before {
      content: attr(data-placeholder);
      color: var(--eqt-text-hint);
      opacity: 0.5;
      pointer-events: none;
    }
  }

  &__controls {
    display: flex;
    gap: 4px;
    margin-left: auto;
  }

  &__profile-row {
    position: relative;
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
    background: var(--eqt-bg-btn);
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
    background: var(--eqt-bg-btn);
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
    box-sizing: border-box;
    height: var(--eqt-row-h);
    padding: 0 8px;
    border: var(--eqt-border-width) solid var(--line-color, var(--eqt-border));
    border-radius: 3px;
    background: color-mix(in srgb, var(--line-color, var(--eqt-bg-btn)) 15%, var(--eqt-bg-btn));
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
    user-select: none;
    transition: background 0.15s, border-color 0.15s, color 0.15s;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--url {
      text-decoration: none;
    }

    &--editing {
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
    background: var(--eqt-bg-btn);
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
