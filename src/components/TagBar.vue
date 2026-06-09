<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import Draggable from 'vuedraggable'
import { ChevronLeft, ChevronRight, ExternalLink, GripVertical, Trash2, Pencil, Check, Settings, Plus, Info } from '@lucide/vue'
import ContentEditable from 'vue-contenteditable'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import SeparatorSettingsPopup from '@/components/SeparatorSettingsPopup.vue'
import SearchPanel, { type SearchPanelExposed } from '@/components/SearchPanel.vue'
import { TagState, type Line, type Button, type TagButton } from '@/types'
import { tokenize, buildIdentityIndex, getState as _getState, setTagState, getNextRightClickState } from '@/services/tagState'
import { lines, dblClickLeft, dblClickRight, useAccentOnInclude, showSearchPanel, type DblClickAction } from '@/services/store'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
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
  'addToSearch': []
  'settings': []
  'prevProfile': []
  'nextProfile': []
  'renameProfile': [name: string]
  'createProfile': [name: string]
  'deleteProfile': []
  'search': [action: DblClickAction]
  // 量到的 line-controls 寬度——App.vue 拿來在 EH form 父層設 --eqt-controls-w，
  // 讓原生 search row 的 wrapper 跟 __lines 用同一條置中縮窄公式
  'controlsWidth': [width: number]
}>()

const editing = ref(false)

const controlsEl = ref<HTMLElement | null>(null)
useResizeObserver(controlsEl, ([entry]) => {
  emit('controlsWidth', entry.contentRect.width)
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

// Vue v-for / vuedraggable :item-key 需要的是 instance identity，不是 content。
// content-based key (tags.join 或 url) 在出現重複內容時撞 key——尤其是 SearchPanel
// chip clone 同 positive 進已有按鈕的 line 會踩到。改用 WeakMap 對 Button object
// 發號碼牌：同 object 永遠同號、不同 object 就算內容一樣也不同號。
// page reload 後 WeakMap 重建沒差，Vue 只需要「同次 mount 期間穩定」即可。
// button 從 lines.buttons 拔掉後 WeakMap 自動 GC、不會洩漏
const buttonIds = new WeakMap<Button, number>()
let buttonIdCounter = 0
function buttonKey(b: Button): number {
  let id = buttonIds.get(b)
  if (id === undefined) {
    id = ++buttonIdCounter
    buttonIds.set(b, id)
  }
  return id
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
  group: EQT_TAGS_GROUP,
  ghostClass: 'eqt-tag-bar__btn--ghost',
  chosenClass: 'eqt-tag-bar__btn--chosen',
  dragClass: 'eqt-tag-bar__btn--drag',
}

// --- search text parsing ---

// 整個按鈕牆共用一張身份索引表，只在 searchText 變時重算。
// 拆 computed（而非塞進 getState 內）避免 N 顆按鈕各自重建一次。
const identityIndex = computed(() => buildIdentityIndex(tokenize(props.searchText)))

function getState(b: TagButton): TagState {
  return _getState(b.tags, identityIndex.value)
}

// --- normal mode handlers ---

// SearchPanel ref：toggle Off 時走 SearchPanel.dismissTerms（殘留 off 灰按鈕
// + push history），跟 SearchPanel 內部 button 被點 Off 的行為一致。
// SearchPanel 若關閉/未 mount，fallback 走原本 emit setTagState 路徑（功能正常
// 但不殘留 off 灰按鈕——因為沒地方顯示）
const searchPanelRef = ref<SearchPanelExposed | null>(null)

function dispatchTransition(tags: string[], next: TagState): void {
  if (next === TagState.Off && searchPanelRef.value) {
    searchPanelRef.value.dismissTerms(tags)
  } else {
    emit('update:searchText', setTagState(props.searchText, tags, next))
  }
}

function onLeftClick(b: TagButton) {
  const state = getState(b)
  // 身份模型語意：左鍵 = 「這是我對這身份的主要態度」。
  //   - Include → Off （toggle off）
  //   - Off / Or / Exclude → Include （宣告：我要這個身份是 Include view）
  // Or / Exclude 不被當作 toggle-off 觸發態，避免「另一顆按鈕 emit 了 -X，
  // 點本顆要兩次才能 include」的反直覺 UX。
  const next = state === TagState.Include ? TagState.Off : TagState.Include
  dispatchTransition(b.tags, next)
}

function onRightClick(event: MouseEvent, b: TagButton) {
  event.preventDefault()
  const state = getState(b)
  const next = getNextRightClickState(b.tags, b.disabledModes, state)
  if (next === null) return
  dispatchTransition(b.tags, next)
}
</script>

<template>
  <div class="eqt-tag-bar" :class="[currentTagStyleClass, { 'eqt-tag-bar--accent-on-include': useAccentOnInclude }]" @dblclick="onBarDblClick" @contextmenu="onBarContextMenu">
    <!-- info hover 觸發的覆蓋層，樣式定義在 .eqt-tag-bar__overlay -->
    <div class="eqt-tag-bar__overlay"></div>
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
      <div v-if="showSearchPanel" class="eqt-tag-bar__search-area">
        <span class="eqt-tag-bar__search-area-label">{{ t('tagbar.searchPanel') }}</span>
        <SearchPanel
          ref="searchPanelRef"
          :model-value="searchText"
          :editing="editing"
          @update:model-value="emit('update:searchText', $event)"
          @add-to-search="emit('addToSearch')"
          @search="emit('search', 'search')"
          @drag-start="onTagStart"
          @drag-end="onTagEnd"
        />
      </div>
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
@use '../styles/buttons' as *;

.eqt-tag-bar {
  position: relative;
  margin: 6px 0;

  // 強制 include 走 status 綠色：把 --include-base 設成 status-include，
  // tag-style.scss mixin 的 var(--include-base, var(--line-color, ...)) 就會
  // resolve 到綠色，line-color 對 include 狀態的影響被「關掉」。
  &--accent-on-include {
    --include-base: var(--eqt-status-include);
  }

  &__overlay {
    position: absolute;
    inset: 0;
    background: var(--eqt-bg-hover);
    border-radius: var(--eqt-radius-md);
    clip-path: circle(0 at 14px 14px);
    opacity: 0;
    pointer-events: none;
    z-index: 1;
    transition: clip-path 0.4s ease-out, opacity 0.4s ease-out;
  }

  &:has(.eqt-tag-bar__info:hover) &__overlay {
    clip-path: circle(150% at 14px 14px);
    opacity: 1;
  }

  // info icon 本身不做 hover 反饋——hover 反饋讓整片覆蓋層去演，icon 自身保持
  // 靜態（避免雙重視覺信號搶戲）
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
    color: var(--eqt-text-hint);
    font-size: 11px;
    user-select: none;
    z-index: 2;
  }

  // Tooltip：popover 風格——加陰影 + 較圓的 radius + 較舒展的 padding。
  // 垂直 top:50% + translateY(-50%) 對齊 info icon 中軸；不再貼 top:0。
  // ::before/::after 兩層三角形戳出指向 info icon
  &__info-text {
    display: none;
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 10px;
    padding: 6px 10px;
    background: var(--eqt-bg);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: var(--eqt-radius-md);
    box-shadow: var(--eqt-shadow-popover);
    color: var(--eqt-text-secondary);
    font-size: var(--eqt-fs-sm);
    text-align: left;
    // pre 識別 i18n 字串內的 \n 作換行、但不 wrap——tooltip 寬度跟著最長那行
    // 內容自動 hug，比 pre-line（會 wrap）穩定
    white-space: pre;
    line-height: 1.5;
    pointer-events: none;
    z-index: 3;

    // 小三角從 tooltip 左側戳出來、指向 info icon。用兩層 ::before / ::after
    // 疊出「邊框 + 填色」：外層稍大、用 --eqt-border 色當 outline；內層內縮
    // 1px、用 --eqt-bg 色蓋掉中間，視覺上 = 帶邊的箭頭。
    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      right: 100%;
      width: 0;
      height: 0;
      border-style: solid;
    }
    &::before {
      transform: translateY(-50%);
      border-width: 6px 7px 6px 0;
      border-color: transparent var(--eqt-border) transparent transparent;
    }
    &::after {
      transform: translateY(-50%) translateX(var(--eqt-border-width));
      border-width: 5px 6px 5px 0;
      border-color: transparent var(--eqt-bg) transparent transparent;
    }

    .eqt-tag-bar__info:hover & {
      display: block;
    }
  }

  &__lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: calc(100% - 2 * var(--eqt-controls-w, 0px));
    margin: 0 auto;
  }

  &__line-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  // button 區的 framed 卡片：「+」按鈕住在框內當新增入口，整個框視覺上就是
  // 「我這次搜的東西 + 怎麼新增」這件事的容器。
  // legend 風格的左上角標題，騎在 border 上指示「這是進階搜尋面板」
  &__search-area {
    position: relative;
    // top padding 加大讓內容跟 legend 標題拉開距離（label 中線壓在 border 上，
    // 半個 label 探進卡片內 ~5.5px，6px padding 太貼）
    padding: 14px 6px 6px;
    // 跟上方 TagBar 主體拉開——legend label 騎在 border 上需要 vertical
    // breathing room、否則上面的按鈕牆會把 label 壓得太近
    margin-top: 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 6px;
    background: var(--eqt-bg);
  }

  // legend 風：標題框絕對定位、垂直中線壓在 border 上、底色蓋掉穿過的邊框線
  &__search-area-label {
    position: absolute;
    top: 0;
    left: 10px;
    transform: translateY(-50%);
    padding: 0 6px;
    background: var(--eqt-bg);
    color: var(--eqt-text-hint);
    font-size: 11px;
    line-height: 1;
    user-select: none;
    pointer-events: none;
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
    @include btn-icon;
    cursor: grab;
    user-select: none;

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
    @include btn-split-group;
  }
  &__line-add-btn {
    flex: 1;
    @include btn-split-item;
  }

  // 右下 ctrl 區的「+ 標籤 / + URL」split；hug content 不撐。
  // 色彩 override mixin 預設的「外框 + hint 文字」，改成跟旁邊獨立 ctrl
  // 一致的「bg-btn 填充 + secondary 文字」，視覺權重才不會掉一階。
  &__ctrl-split {
    @include btn-split-group;
    background: var(--eqt-bg-btn);
  }
  &__ctrl-split-btn {
    @include btn-split-item;
    color: var(--eqt-text-secondary);
  }

  // btn-icon 的非正方變體：高度照樣是 row-h，但寬度由內容決定（保留 padding）。
  // hover 走 danger 色（不變底）給「會刪行」的視覺暗示。
  &__line-delete {
    @include btn-icon;
    width: auto;
    padding: 0 4px;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      color: var(--eqt-danger);
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
      // align-center default：lineLength<100% 時 ::before/::after 各 cap 在 lineLength/2，
      // 兩條線吃不滿剩餘空間。沒設 justify-content 走 flex-start 預設 → assembly
      // 整個被推到左邊。justify-content: center 把 assembly 推回容器中軸。
      // lineLength=100% 時兩線 flex:1 吃滿剩餘空間、本來就沒 free space，justify
      // 對它無影響——所以這條 default 不會破 100% 既有觀感。
      justify-content: center;

      // default center: 兩線各 max lineLength/2
      &::before,
      &::after {
        max-width: calc(var(--separator-line-length) / 2);
      }

      &.eqt-tag-bar__line--separator-align-left {
        justify-content: flex-start;
        &::before { flex: 0; border-top: 0; }
        &::after { max-width: var(--separator-line-length); }
      }
      &.eqt-tag-bar__line--separator-align-right {
        justify-content: flex-end;
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
    margin-bottom: 6px;
  }

  &__profile-row {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 4px;
    margin-top: 6px;
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
      background: var(--eqt-danger-bg-hover);
      color: var(--eqt-danger);
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
    transition: var(--eqt-transition-base);

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
      box-shadow: var(--eqt-shadow-drag);
    }
  }

  &__ctrl {
    @include btn-toned;
    padding: 2px 6px;

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
