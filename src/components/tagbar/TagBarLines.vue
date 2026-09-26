<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import Draggable from 'vuedraggable'
import { ArrowLeft, CopyPlus, Ellipsis, ExternalLink, GripVertical, Palette, Settings, SquareDashedMousePointer, Trash2 } from '@lucide/vue'
import ContentEditable from 'vue-contenteditable'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import SeparatorSettingsPopup from './SeparatorSettingsPopup.vue'
import { TagState, type Line, type Button, type ButtonLine, type TagButton, type LineTextAlign } from '@/types'
import { tokenize, buildIdentityIndex, getState as _getState, setTagState, getNextRightClickState } from '@/services/search/tagState'
import { lines, profiles, activeProfileIdx, moveLineToProfile, moveButtonToProfile, buttonLineTextAlign, separatorLineTextAlign, followCurrentSite } from '@/services/store'
import { baseDragOptions, EQT_TAGS_GROUP, EQT_LINES_GROUP } from '@/utils/drag'
import { resolveButtonUrl } from '@/utils/ehUrl'
import { dismissTerms } from '@/services/search/searchSession'
import { t } from '@/composables/useI18n'
import { useSpacerResize } from '@/composables/useSpacerResize'

// Off 給 explicit class（即使沒對應 style）：給 e2e / 外部觀察者一個正面條件
// 可 assert，避免「不是 include / or / exclude 就是 Off」的 negate 推論在新 state
// 加入時靜默漏掉
const STATE_CLASS: Record<TagState, string> = {
  [TagState.Include]: 'eqt-tag-bar__btn--include',
  [TagState.Or]:      'eqt-tag-bar__btn--or',
  [TagState.Exclude]: 'eqt-tag-bar__btn--exclude',
  [TagState.Off]:     'eqt-tag-bar__btn--off',
}

const props = defineProps<{
  editing: boolean
  onCreationPage: boolean
  dragging: boolean
}>()

const emit = defineEmits<{
  configure: [li: number, ti: number]
  'drag-start': []
  'drag-end': []
  'controls-width': [width: number]
  'focus-edit-toggle': []
}>()

const searchText = defineModel<string>({ required: true })

const lineRows = ref<{ $el: HTMLElement } | null>(null)
function getLineRowsEl(): HTMLElement | null {
  return lineRows.value?.$el ?? null
}

const controlsEl = ref<HTMLElement | null>(null)
useResizeObserver(controlsEl, ([entry]) => {
  emit('controls-width', entry.contentRect.width)
})
function captureControlsEl(el: unknown, li: number) {
  if (li === 0) controlsEl.value = (el as HTMLElement) ?? null
}

// --- draggable change handlers ---

function onLineChange(evt: any) {
  if (evt.added) {
    lines.splice(evt.added.newIndex, 0, evt.added.element)
  }
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

// 選單開著時拖曳重排會讓選單捕捉的 (li, ti) 索引指到別顆按鈕——
// 拖曳一開始就把兩個選單關掉，過期索引沒有機會被套用
function closeActionMenus() {
  lineMenuOpen.value = false
  tagMenuOpen.value = false
}

function onTagStart() { emit('drag-start') }
function onTagEnd() { emit('drag-end') }

// --- spacers ---

const {
  spacerGuide,
  resizingSpacer,
  spacerRenderWidth,
  spacerHasGrip,
  onSpacerGripDown,
  onSpacerGripMove,
  onSpacerGripUp,
  finishSpacerResize,
} = useSpacerResize(getLineRowsEl)

function lineAlignOf(line: ButtonLine): LineTextAlign {
  return line.style?.textAlign ?? buttonLineTextAlign.value
}

function resolveUrl(raw: string): string {
  return resolveButtonUrl(raw, followCurrentSite.value, location.origin)
}

// 非編輯時 spacer 是「空白區域」：右鍵放行給 bar 的雙右鍵動作,不能用
// .prevent.stop 修飾符（會無條件吞掉事件）。
// 鍵盤可達性:編輯模式的 spacer 有 tabindex=0,Tab 過去按 Menu 鍵 /
// Shift+F10 瀏覽器會在 focused 元素上發 contextmenu、走進這裡開選單
// (刪除 / 複製 / 搬移),跟 tag / url 按鈕的鍵盤路徑對齊。
// ⚠️ 這段說明必須放 script:vuedraggable 的 item slot 要求每個 item
// 恰好渲染一個節點,template 裡的 HTML 註解會變成 comment vnode、
// 觸發它的 "Item slot must have only one child" throw,mount 直接炸
function onSpacerContextMenu(e: MouseEvent, li: number, ti: number): void {
  if (!props.editing) return
  e.preventDefault()
  e.stopPropagation()
  openTagMenu(e, li, ti)
}

// 空行可以直接刪（誤按零損失）；有內容才彈 confirm：
//   ButtonLine 有 button、SeparatorLine 有 label 或調過 style 視為「有內容」
function isLineEmpty(line: Line): boolean {
  if (line.kind === 'buttons') return line.buttons.length === 0 && (!line.style || Object.keys(line.style).length === 0)
  return !line.label && (!line.style || Object.keys(line.style).length === 0)
}
function onDeleteLine(li: number) {
  if (!isLineEmpty(lines[li]) && !confirm(t('tagbar.deleteLineConfirm'))) return
  lines.splice(li, 1)
}

// --- line actions ---

const lineMenuOpen = ref(false)
const lineMenuIdx = ref(-1)
const lineMenuView = ref<'menu' | 'move' | 'layout' | 'color'>('menu')
const lineMenuTrigger = ref<HTMLButtonElement | null>(null)
const lineMenuBack = ref<HTMLButtonElement | null>(null)
const lineMenuDrillTrigger = ref<HTMLButtonElement | null>(null)

function toggleLineMenu(e: MouseEvent, li: number): void {
  tagMenuTrigger.value = null
  tagMenuOpen.value = false
  const trigger = e.currentTarget as HTMLButtonElement
  if (lineMenuOpen.value && lineMenuIdx.value === li) {
    lineMenuOpen.value = false
    return
  }
  lineMenuIdx.value = li
  lineMenuView.value = 'menu'
  lineMenuTrigger.value = trigger
  lineMenuDrillTrigger.value = null
  lineMenuOpen.value = true
}

function openLineMenuView(view: 'move' | 'layout' | 'color', e: MouseEvent): void {
  lineMenuDrillTrigger.value = e.currentTarget as HTMLButtonElement
  lineMenuView.value = view
  nextTick(() => lineMenuBack.value?.focus({ preventScroll: true }))
}

function returnToLineMenu(): void {
  lineMenuView.value = 'menu'
  nextTick(() => lineMenuDrillTrigger.value?.focus({ preventScroll: true }))
}

// 選單裡的刪除 / 移動會把觸發鈕從 DOM 拆掉，對脫離的節點 focus 是
// 靜默 no-op、focus 掉回 body。觸發鈕還在就照常還 focus；被拆掉才聚焦
// 補位元素。trigger 為 null 代表換目標重開，交給新選單的 autoFocus。
function focusLineMenuTriggerOrFallback(trigger: HTMLButtonElement | null): void {
  if (!trigger) return
  if (trigger.isConnected) { trigger.focus(); return }
  const actions = getLineRowsEl()?.querySelectorAll<HTMLElement>('.eqt-tag-bar__line-actions') ?? []
  const fallback = actions[Math.min(lineMenuIdx.value, actions.length - 1)]
  if (fallback) fallback.focus()
  else emit('focus-edit-toggle')
}

watch(lineMenuOpen, (open) => {
  if (open) return
  const trigger = lineMenuTrigger.value
  lineMenuView.value = 'menu'
  nextTick(() => focusLineMenuTriggerOrFallback(trigger))
})

function moveLine(li: number, profileIdx: number): void {
  moveLineToProfile(li, profileIdx)
  lineMenuOpen.value = false
}

function duplicateLine(li: number): void {
  const line = lines[li]
  if (!line) return
  lines.splice(li + 1, 0, JSON.parse(JSON.stringify(line)) as Line)
  lineMenuOpen.value = false
}

function deleteLineFromMenu(li: number): void {
  onDeleteLine(li)
  lineMenuOpen.value = false
}

// --- button actions ---

const tagMenuOpen = ref(false)
const tagMenuLineIdx = ref(-1)
const tagMenuButtonIdx = ref(-1)
// 右鍵記游標相對按鈕左上角的偏移；鍵盤開啟沒有游標，改用 null 讓選單
// 直接貼著按鈕（placement 決定貼哪一邊）
const tagMenuPointerOffset = ref<{ x: number, y: number } | null>(null)
const tagMenuView = ref<'menu' | 'move' | 'color'>('menu')
const tagMenuTrigger = ref<HTMLButtonElement | null>(null)
const tagMenuRestoreFocus = ref(false)
const tagMenuBack = ref<HTMLButtonElement | null>(null)
const tagMenuDrillTrigger = ref<HTMLButtonElement | null>(null)

const tagMenuButton = computed<Button | null>(() => {
  const line = lines[tagMenuLineIdx.value]
  if (!line || line.kind !== 'buttons') return null
  return line.buttons[tagMenuButtonIdx.value] ?? null
})

async function openTagMenu(e: MouseEvent, li: number, ti: number): Promise<void> {
  const line = lines[li]
  if (!props.editing || !line || line.kind !== 'buttons' || !line.buttons[ti]) return
  const trigger = e.currentTarget as HTMLButtonElement
  const openedFromKeyboard = e.clientX === 0 && e.clientY === 0
  if (tagMenuOpen.value && tagMenuLineIdx.value === li && tagMenuButtonIdx.value === ti) {
    tagMenuOpen.value = false
    return
  }

  // 右鍵不保證會產生 click，不能依賴 onClickOutside 先關掉舊 menu。
  // 換目標時明確 unmount 舊 Teleport，再於下一個 tick 綁定新 anchor。
  if (tagMenuOpen.value) {
    tagMenuTrigger.value = null
    tagMenuOpen.value = false
    await nextTick()
  }

  lineMenuTrigger.value = null
  lineMenuOpen.value = false
  const rect = trigger.getBoundingClientRect()
  tagMenuLineIdx.value = li
  tagMenuButtonIdx.value = ti
  tagMenuPointerOffset.value = openedFromKeyboard
    ? null
    : { x: e.clientX - rect.left, y: e.clientY - rect.top }
  tagMenuView.value = 'menu'
  tagMenuTrigger.value = trigger
  tagMenuRestoreFocus.value = openedFromKeyboard
  tagMenuDrillTrigger.value = null
  if (!openedFromKeyboard) trigger.blur()
  tagMenuOpen.value = true
}

function openTagMenuView(view: 'move' | 'color', e: MouseEvent): void {
  tagMenuDrillTrigger.value = e.currentTarget as HTMLButtonElement
  tagMenuView.value = view
  nextTick(() => tagMenuBack.value?.focus({ preventScroll: true }))
}

function returnToTagMenu(): void {
  tagMenuView.value = 'menu'
  nextTick(() => tagMenuDrillTrigger.value?.focus({ preventScroll: true }))
}

function duplicateTag(li: number, ti: number): void {
  const line = lines[li]
  if (!line || line.kind !== 'buttons') return
  const button = line.buttons[ti]
  if (!button) return
  line.buttons.splice(ti + 1, 0, JSON.parse(JSON.stringify(button)) as Button)
  tagMenuOpen.value = false
}

function deleteTag(li: number, ti: number): void {
  const line = lines[li]
  if (!line || line.kind !== 'buttons' || !line.buttons[ti]) return
  line.buttons.splice(ti, 1)
  tagMenuOpen.value = false
}

function moveTag(li: number, ti: number, profileIdx: number): void {
  moveButtonToProfile(li, ti, profileIdx)
  tagMenuOpen.value = false
}

function updateTagColor(value: string | undefined): void {
  const button = tagMenuButton.value
  if (button && button.kind !== 'spacer') button.color = value
}

watch(() => props.editing, (enabled) => {
  if (enabled) return
  lineMenuOpen.value = false
  tagMenuOpen.value = false
  finishSpacerResize()
})

// 同 focusLineMenuTriggerOrFallback：按鈕被刪掉 / 移走時聚焦同行補位
// 按鈕，整行清空則退到行操作鈕，最後退到編輯切換鈕。
// selector 必須連 spacer 一起收：tagMenuButtonIdx 是 line.buttons 的索引,
// 行內有 spacer 時「只查按鈕」的 NodeList 會跟 buttons 索引空間錯位,
// 焦點落到非相鄰的按鈕上(spacer 在編輯模式有 tabindex,可聚焦)
function focusTagMenuTriggerOrFallback(trigger: HTMLButtonElement | null): void {
  if (!trigger) return
  if (trigger.isConnected) { trigger.focus(); return }
  const wrap = getLineRowsEl()?.querySelectorAll('.eqt-tag-bar__line-wrap')[tagMenuLineIdx.value]
  const buttons = wrap?.querySelectorAll<HTMLElement>('.eqt-tag-bar__btn, .eqt-tag-bar__spacer') ?? []
  const fallback = buttons[Math.min(tagMenuButtonIdx.value, buttons.length - 1)]
    ?? wrap?.querySelector<HTMLElement>('.eqt-tag-bar__line-actions')
  if (fallback) fallback.focus()
  else emit('focus-edit-toggle')
}

watch(tagMenuOpen, (open) => {
  if (open) return
  const trigger = tagMenuTrigger.value
  const restoreFocus = tagMenuRestoreFocus.value
  tagMenuRestoreFocus.value = false
  tagMenuView.value = 'menu'
  if (restoreFocus) nextTick(() => focusTagMenuTriggerOrFallback(trigger))
})

function onConfigure(li: number, ti: number) {
  if (props.dragging) return
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
  group: EQT_LINES_GROUP,
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
const identityIndex = computed(() => buildIdentityIndex(tokenize(searchText.value)))

function getState(b: TagButton): TagState {
  return _getState(b.tags, identityIndex.value)
}

// --- normal mode handlers ---

// toggle Off 走 dismissTerms（殘留 off 灰按鈕 + push history），跟 SearchPanel
// 內部 button 被點 Off 的行為一致。session 是 module-level singleton、不需要
// showSearchPanel 守衛（即使 panel 視覺收起，session 邏輯仍在）
function dispatchTransition(tags: string[], next: TagState): void {
  if (next === TagState.Off) {
    dismissTerms(tags)
  } else {
    searchText.value = setTagState(searchText.value, tags, next)
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

defineExpose({ closeActionMenus })
</script>

<template>
  <template v-if="onCreationPage">
    <div v-for="n in lines.length" :key="n" class="eqt-tag-bar__line-wrap eqt-tag-bar__line-wrap--placeholder">
      <div class="eqt-tag-bar__line"></div>
    </div>
  </template>
  <Draggable
    v-else
    ref="lineRows"
    v-bind="lineDragOptions"
    :model-value="lines"
    :item-key="(_: any, i: number) => i"
    handle=".eqt-tag-bar__handle"
    :disabled="!editing"
    class="eqt-tag-bar__line-rows"
    @change="onLineChange"
    @start="closeActionMenus"
  >
    <template #item="{ element: line, index: li }">
      <div
        class="eqt-tag-bar__line-wrap"
        :class="{ 'eqt-tag-bar__line-wrap--actions-active': lineMenuOpen && lineMenuIdx === li }"
      >
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
            `eqt-tag-bar__line--separator-align-${line.style?.textAlign ?? separatorLineTextAlign}`,
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
          :class="`eqt-tag-bar__line--buttons-align-${line.style?.textAlign ?? buttonLineTextAlign}`"
          :style="line.color ? { '--line-color': line.color } : undefined"
          @change="onTagChange(li, $event)"
          @start="onTagStart"
          @end="onTagEnd"
        >
          <template #item="{ element: b, index: ti }">
            <div
              v-if="b.kind === 'spacer'"
              class="eqt-tag-bar__spacer"
              :class="[
                `eqt-tag-bar__spacer--${b.mode}`,
                {
                  'eqt-tag-bar__spacer--editing': editing,
                  'eqt-tag-bar__spacer--grip-left': editing && spacerHasGrip(b, lineAlignOf(line), 'left'),
                  'eqt-tag-bar__spacer--grip-right': editing && spacerHasGrip(b, lineAlignOf(line), 'right'),
                },
              ]"
              :style="b.mode === 'fixed' ? { width: `${spacerRenderWidth(b)}px` } : undefined"
              :tabindex="editing ? 0 : undefined"
              :role="editing ? 'button' : undefined"
              :aria-label="editing ? t(b.mode === 'flex' ? 'tagbar.spacerModeFlex' : 'tagbar.spacerModeFixed') : undefined"
              @contextmenu="onSpacerContextMenu($event, li, ti)"
            >
              <span v-if="editing" class="eqt-tag-bar__spacer-body">{{
                b.mode === 'flex'
                  ? `⇤ ${t('tagbar.spacerFlexLabel')} ⇥`
                  : (resizingSpacer === b ? `${spacerRenderWidth(b)}px` : '↔')
              }}</span>
              <!-- 把手放在「拖了會動的邊」，跟該邊畫成實線的 class 共用判斷 -->
              <span
                v-if="editing && spacerHasGrip(b, lineAlignOf(line), 'left')"
                class="eqt-tag-bar__spacer-grip eqt-tag-bar__spacer-grip--left"
                :title="t('tagbar.spacerResizeTitle')"
                @pointerdown="onSpacerGripDown($event, li, b, lineAlignOf(line), 'left')"
                @pointermove="onSpacerGripMove"
                @pointerup="onSpacerGripUp"
                @pointercancel="onSpacerGripUp"
                @lostpointercapture="onSpacerGripUp"
              ></span>
              <span
                v-if="editing && spacerHasGrip(b, lineAlignOf(line), 'right')"
                class="eqt-tag-bar__spacer-grip"
                :title="t('tagbar.spacerResizeTitle')"
                @pointerdown="onSpacerGripDown($event, li, b, lineAlignOf(line), 'right')"
                @pointermove="onSpacerGripMove"
                @pointerup="onSpacerGripUp"
                @pointercancel="onSpacerGripUp"
                @lostpointercapture="onSpacerGripUp"
              ></span>
            </div>

            <a
              v-else-if="b.kind === 'url' && !editing"
              :href="resolveUrl(b.url)"
              class="eqt-tag-bar__btn eqt-tag-bar__btn--url"
              :style="b.color ? { '--line-color': b.color } : undefined"
            ><ExternalLink :size="12" /> {{ b.label || b.url }}</a>

            <button
              v-else-if="b.kind === 'url'"
              class="eqt-tag-bar__btn eqt-tag-bar__btn--editing"
              type="button"
              :style="b.color ? { '--line-color': b.color } : undefined"
              @click="onConfigure(li, ti)"
              @contextmenu.prevent.stop="openTagMenu($event, li, ti)"
            ><ExternalLink :size="12" /> {{ b.label || b.url }}</button>

            <button
              v-else
              class="eqt-tag-bar__btn"
              :class="editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(b)]"
              type="button"
              :style="b.color ? { '--line-color': b.color } : undefined"
              @click="editing ? onConfigure(li, ti) : onLeftClick(b)"
              @contextmenu.prevent.stop="editing ? openTagMenu($event, li, ti) : onRightClick($event, b)"
            >{{ b.label || b.tags.join(', ') }}</button>
          </template>
        </Draggable>

        <button
          v-if="editing"
          class="eqt-tag-bar__line-actions"
          type="button"
          :title="t('tagbar.lineActions')"
          aria-haspopup="dialog"
          :aria-expanded="lineMenuOpen && lineMenuIdx === li"
          @click="toggleLineMenu($event, li)"
        ><Ellipsis :size="14" /></button>
        <ContextMenu
          v-if="lineMenuIdx === li"
          v-model:open="lineMenuOpen"
          :anchor-el="lineMenuTrigger"
          :ignore="[lineMenuTrigger]"
          auto-focus
          aria-role="dialog"
          :aria-label="t('tagbar.lineActions')"
          placement="right-start"
        >
          <template v-if="lineMenuView === 'menu'">
            <button v-if="profiles.length > 1" type="button" class="eqt-context-menu__item" @click="openLineMenuView('move', $event)">
              <SquareDashedMousePointer :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.moveLine') }}</span>
            </button>
            <button type="button" class="eqt-context-menu__item" @click="duplicateLine(li)">
              <CopyPlus :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.duplicateLine') }}</span>
            </button>
            <button type="button" class="eqt-context-menu__item" @click="openLineMenuView('layout', $event)">
              <Settings :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.layout') }}</span>
            </button>
            <button type="button" class="eqt-context-menu__item" @click="openLineMenuView('color', $event)">
              <Palette :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.lineColor') }}</span>
            </button>
            <div class="eqt-context-menu__separator" />
            <button type="button" class="eqt-context-menu__item eqt-context-menu__item--danger" @click="deleteLineFromMenu(li)">
              <Trash2 :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.deleteLine') }}</span>
            </button>
          </template>
          <template v-else>
            <button ref="lineMenuBack" type="button" class="eqt-tag-bar__line-menu-back" @click="returnToLineMenu">
              <ArrowLeft :size="14" /> {{ t('common.back') }}
            </button>
            <div class="eqt-context-menu__separator" />
            <template v-if="lineMenuView === 'move'">
              <button
                v-for="(profile, pi) in profiles"
                v-show="pi !== activeProfileIdx"
                :key="pi"
                type="button"
                class="eqt-context-menu__item"
                @click="moveLine(li, pi)"
              ><span class="eqt-context-menu__label">{{ profile.name }}</span></button>
            </template>
            <SeparatorSettingsPopup
              v-else-if="lineMenuView === 'layout'"
              embedded
              :line="line"
              :default-text-align="line.kind === 'buttons' ? buttonLineTextAlign : separatorLineTextAlign"
              @update:line="onUpdateLine(li, $event)"
            />
            <LineColorSwatch
              v-else-if="lineMenuView === 'color'"
              embedded
              :model-value="line.color"
              @update:model-value="line.color = $event"
            />
          </template>
        </ContextMenu>
      </div>
    </template>
    <template #footer>
      <div
        v-if="spacerGuide"
        class="eqt-tag-bar__spacer-guide"
        :style="{
          left: `${spacerGuide.x}px`,
          top: `${spacerGuide.top}px`,
          height: `${spacerGuide.height}px`,
        }"
      ></div>
    </template>
  </Draggable>
  <ContextMenu
    v-model:open="tagMenuOpen"
    :anchor-el="tagMenuTrigger"
    :pointer-offset="tagMenuPointerOffset"
    auto-focus
    aria-role="dialog"
    :aria-label="t('tagbar.tagActions')"
    placement="bottom-start"
  >
    <template v-if="tagMenuView === 'menu'">
      <button v-if="profiles.length > 1" type="button" class="eqt-context-menu__item" @click="openTagMenuView('move', $event)">
        <SquareDashedMousePointer :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.moveTag') }}</span>
      </button>
      <button type="button" class="eqt-context-menu__item" @click="duplicateTag(tagMenuLineIdx, tagMenuButtonIdx)">
        <CopyPlus :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.duplicateTag') }}</span>
      </button>
      <button v-if="tagMenuButton?.kind !== 'spacer'" type="button" class="eqt-context-menu__item" @click="openTagMenuView('color', $event)">
        <Palette :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('common.itemColor') }}</span>
      </button>
      <div class="eqt-context-menu__separator" />
      <button type="button" class="eqt-context-menu__item eqt-context-menu__item--danger" @click="deleteTag(tagMenuLineIdx, tagMenuButtonIdx)">
        <Trash2 :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagConfig.delete') }}</span>
      </button>
    </template>
    <template v-else>
      <button ref="tagMenuBack" type="button" class="eqt-tag-bar__line-menu-back" @click="returnToTagMenu">
        <ArrowLeft :size="14" /> {{ t('common.back') }}
      </button>
      <div class="eqt-context-menu__separator" />
      <template v-if="tagMenuView === 'move'">
        <button
          v-for="(profile, pi) in profiles"
          v-show="pi !== activeProfileIdx"
          :key="pi"
          type="button"
          class="eqt-context-menu__item"
          @click="moveTag(tagMenuLineIdx, tagMenuButtonIdx, pi)"
        ><span class="eqt-context-menu__label">{{ profile.name }}</span></button>
      </template>
      <LineColorSwatch
        v-else-if="tagMenuView === 'color' && tagMenuButton && tagMenuButton.kind !== 'spacer'"
        embedded
        :model-value="tagMenuButton.color"
        @update:model-value="updateTagColor"
      />
    </template>
  </ContextMenu>
</template>
