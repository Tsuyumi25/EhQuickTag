<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import Draggable from 'vuedraggable'
import { AlignHorizontalSpaceBetween, ArrowLeft, ArrowLeftRight, ChevronLeft, ChevronRight, CopyPlus, ExternalLink, GripVertical, Trash2, Pencil, Check, Settings, Plus, Info, Ellipsis, Palette, SquareDashedMousePointer } from '@lucide/vue'
import ContentEditable from 'vue-contenteditable'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import SeparatorSettingsPopup from '@/components/SeparatorSettingsPopup.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import SearchPanel from '@/components/search/SearchPanel.vue'
import { TagState, type Line, type Button, type ButtonLine, type TagButton, type SpacerButton, type LineTextAlign } from '@/types'
import { tokenize, buildIdentityIndex, getState as _getState, setTagState, getNextRightClickState } from '@/services/tagState'
import { lines, profiles, activeProfileIdx, moveLineToProfile, moveButtonToProfile, appendToLastButtonLine, buttonLineTextAlign, separatorLineTextAlign, dblClickLeft, dblClickRight, dblClickLeftNewTabActive, dblClickRightNewTabActive, useAccentOnInclude, showSearchPanel, followCurrentSite, type DblClickAction } from '@/services/store'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
import { resolveButtonUrl } from '@/utils/ehUrl'
import { dismissTerms, recordSubmitAndFlush } from '@/services/search/searchSession'
import { t } from '@/composables/useI18n'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { computeSpacerResize, edgeSensitivity, DEFAULT_SPACER_WIDTH } from '@/services/spacerResize'

const ACTION_KEYS: Record<DblClickAction, string> = {
  search: 'tagbar.search',
  searchNewTab: 'tagbar.searchNewTab',
  clearSearch: 'tagbar.clearSearch',
  toggleEdit: 'tagbar.toggleEdit',
  openSearchPopup: 'tagbar.browseTag',
  none: 'tagbar.none',
}

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
  // newTabActive 只在 action === 'searchNewTab' 有意義：雙擊路徑帶觸發側的
  // 「切換過去」開關，非雙擊 caller 不帶（App 端 fallback 為切換）
  'search': [action: DblClickAction, newTabActive?: boolean]
  // 量到的 line-controls 寬度——App.vue 拿來在 EH form 父層設 --eqt-controls-w，
  // 讓原生 search row 的 wrapper 跟 __lines 用同一條置中縮窄公式
  'controlsWidth': [width: number]
}>()

const editing = ref(false)

const barEl = ref<HTMLElement | null>(null)
const editToggleEl = ref<HTMLButtonElement | null>(null)

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
  if (isInteractive(e)) return
  const action = dblClickLeft.value
  // editing 時只允許 toggleEdit 走（拿來退出編輯）；其他 action 仍然不能在編輯時觸發，
  // 避免「拖標籤途中誤觸搜尋」
  if (editing.value && action !== 'toggleEdit') return
  e.preventDefault()
  e.stopPropagation()
  window.getSelection()?.removeAllRanges()
  execDblClickAction(action, dblClickLeftNewTabActive.value)
}

function onBarContextMenu(e: MouseEvent) {
  if (isInteractive(e)) return
  const action = dblClickRight.value
  if (editing.value && action !== 'toggleEdit') return
  e.preventDefault()
  const now = Date.now()
  if (now - lastRightClickTime < 500) {
    execDblClickAction(action, dblClickRightNewTabActive.value)
    lastRightClickTime = 0
  } else {
    lastRightClickTime = now
  }
}

// 編輯模式的整個 TagBar 都是自訂操作面：capture phase 先封住瀏覽器原生
// context menu，但不阻止事件往子層走，tag 仍可接手開啟自己的 ContextMenu。
// 文字輸入元素（分隔線 label 的 contenteditable、profile 改名 input）除外——
// 它們需要原生選單做貼上 / 拼字建議，且沒有自訂選單可替代。
function preventNativeContextMenuWhileEditing(e: MouseEvent): void {
  if (!editing.value) return
  if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
  e.preventDefault()
}

async function execDblClickAction(action: DblClickAction, newTabActive?: boolean) {
  if (action === 'none') return
  if (action === 'toggleEdit') {
    editing.value = !editing.value
    return
  }
  if (action === 'openSearchPopup') {
    // 重用既有的 + 鈕 event chain：TagBar emit → App.onAddToSearch → showSearchPopup
    emit('addToSearch')
    return
  }
  if (action === 'clearSearch') {
    emit('update:searchText', '')
  } else {
    // 跟 SearchPanel.onSearchClick 同邏輯：先 recordSubmit + flush 再 emit。
    // await flush 確保 navigate 前 GM_setValue resolve（finding #3）
    await recordSubmitAndFlush()
    // 旗標只跟 searchNewTab 走：其他 action 不帶，避免隱藏的側設定值漏進
    // App 端 fallback（那裡收不到旗標時走寫死的切換）
    emit('search', action, action === 'searchNewTab' ? newTabActive : undefined)
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

// 選單開著時拖曳重排會讓選單捕捉的 (li, ti) 索引指到別顆按鈕——
// 拖曳一開始就把兩個選單關掉，過期索引沒有機會被套用
function closeActionMenus() {
  lineMenuOpen.value = false
  tagMenuOpen.value = false
}

function onTagStart() { tagDragging = true; closeActionMenus() }
function onTagEnd() { setTimeout(() => { tagDragging = false }, 0) }

function onAddButtonLine() { lines.push({ kind: 'buttons', buttons: [] }) }
function onAddSeparatorLine() { lines.push({ kind: 'separator' }) }

// --- spacers ---

// 新增入口跟 moveButtonToProfile 同一條承接政策（appendToLastButtonLine）:
// 進最後一個普通行、沒有就建一行,再由使用者在編輯模式拖到目標位置

// 單一「新增空位」入口,點擊冒出兩項選單(固定 / 彈性)——模式在新增時
// 一次選定,不佔兩顆入口鈕、也不用事後翻右鍵選單切換
const addSpacerMenuOpen = ref(false)
const addSpacerTrigger = ref<HTMLButtonElement | null>(null)

function toggleAddSpacerMenu(e: MouseEvent): void {
  if (addSpacerMenuOpen.value) {
    addSpacerMenuOpen.value = false
    return
  }
  addSpacerTrigger.value = e.currentTarget as HTMLButtonElement
  addSpacerMenuOpen.value = true
}

function onAddSpacer(mode: SpacerButton['mode']): void {
  appendToLastButtonLine(lines, mode === 'fixed'
    ? { kind: 'spacer', mode, width: DEFAULT_SPACER_WIDTH }
    : { kind: 'spacer', mode })
  addSpacerMenuOpen.value = false
}

// --- fixed spacer resize ---
// 數學核心（閉環實測 + gap 恆等式吸附）住在 services/spacerResize.ts 的
// 純函式裡,這邊只當薄 DOM adapter：pointerdown 收集吸附目標、pointermove
// 量 rect 餵給 computeSpacerResize、把結果套回資料與 guide 線。
// 目標集合在 pointerdown 收集一次即可：拖曳只影響自己這一行,其他行的
// x 座標不動（自己行折行數變化只造成下方行的垂直位移,目標只存 x）。

// 吸附輔助線。x 是對齊軸,top / height 讓線只涵蓋「目標行 ↔ spacer 行」這一段
// 而不是縱貫整個 TagBar——線穿過每一行的話,看的人不知道自己對齊到誰。
// 座標都已換算到 __line-rows 座標系
const spacerGuide = ref<{ x: number; top: number; height: number } | null>(null)
const resizingSpacer = ref<SpacerButton | null>(null)
// 拖曳中的顯示寬——故意不寫進 lines 樹:store 的自動存檔 watcher 沒有
// debounce,每次 pointermove 寫 btn.width 會觸發「全 profile 深拷貝 +
// JSON 序列化 + GM 寫入」的風暴。拖曳期間只更新這個 ref,pointerup 才
// commit 進 btn.width——整場拖曳只存檔一次
const resizingWidth = ref<number | null>(null)

// 拖曳中以 resizingWidth 為準,其餘時候讀資料值;fallback 同時涵蓋
// 手編 JSON 沒帶 width 的資料(避免顯示 undefinedpx)
function spacerRenderWidth(b: SpacerButton): number {
  if (resizingSpacer.value === b && resizingWidth.value !== null) return resizingWidth.value
  return b.width ?? DEFAULT_SPACER_WIDTH
}

function lineAlignOf(line: ButtonLine): LineTextAlign {
  return line.style?.textAlign ?? buttonLineTextAlign.value
}

function resolveUrl(raw: string): string {
  return resolveButtonUrl(raw, followCurrentSite.value, location.origin)
}

// 這一緣拖得動嗎。規則的唯一來源是 spacerResize 的 edgeSensitivity——靈敏度 0
// 表示那一緣被行釘死(left 行的左緣、right 行的右緣),拖再多都不動。把手的
// v-if 與方括號的 class 共用這條判斷,兩者永遠指向同一緣
function spacerHasGrip(b: SpacerButton, align: LineTextAlign, side: 'left' | 'right'): boolean {
  return b.mode === 'fixed' && edgeSensitivity(align, side) !== 0
}

let spacerResizeCtx: {
  btn: SpacerButton
  pointerId: number    // 一次只允許一場 resize:move / up 都驗 pointerId,
                       // 第二根手指按上別顆把手不會覆寫進行中的 session
  lastX: number        // 上一次 move 的 clientX——逐次增量的唯一狀態
  widthF: number       // 意圖寬度的浮點累積（避免逐次 round 漂移）
  align: LineTextAlign
  side: 'left' | 'right'   // 被拖的把手（center 行兩緣都有把手）
  spacerEl: HTMLElement
  rowsEl: Element
  targetsL: number[]   // 參照 item 左緣集合,viewport 絕對 x（供 spacer 左緣吸）
  targetsR: number[]   // 參照 item 右緣集合,viewport 絕對 x（供 spacer 右緣吸）
  targetEls: Element[] // 與上面兩個集合平行:命中時當場重量它的 y 範圍畫輔助線
} | null = null

function onSpacerGripDown(e: PointerEvent, li: number, b: SpacerButton, align: LineTextAlign, side: 'left' | 'right'): void {
  e.preventDefault()
  e.stopPropagation()   // 擋住 sortable 把 grip 拖曳當成排序拖曳
  if (spacerResizeCtx) return   // 已有進行中的 resize(多指):忽略後來者
  const grip = e.currentTarget as HTMLElement
  grip.setPointerCapture(e.pointerId)
  const rowsEl = barEl.value?.querySelector('.eqt-tag-bar__line-rows')
  const spacerEl = grip.parentElement
  if (!rowsEl || !spacerEl) return
  // 兩邊都收：left 行只用右緣集、right 行只用左緣集、center 行兩集都用。
  // 參照 item 含按鈕與兩種 spacer——spacer 也是幾何 item,邊緣同樣是有效參照。
  // 存 viewport 絕對座標:吸附判斷是「絕對對絕對」做差,天然就是相對量,
  // 只有畫 guide 線時才換算回 __line-rows 座標系
  const targetsL: number[] = []
  const targetsR: number[] = []
  const targetEls: Element[] = []
  rowsEl.querySelectorAll('.eqt-tag-bar__line-wrap').forEach((wrap, wi) => {
    if (wi === li) return
    wrap.querySelectorAll('.eqt-tag-bar__btn, .eqt-tag-bar__spacer').forEach((item) => {
      const r = item.getBoundingClientRect()
      targetsL.push(r.left)
      targetsR.push(r.right)
      targetEls.push(item)
    })
  })
  const startWidth = spacerEl.getBoundingClientRect().width
  spacerResizeCtx = {
    btn: b,
    pointerId: e.pointerId,
    lastX: e.clientX,
    widthF: startWidth,
    align,
    side,
    spacerEl,
    rowsEl,
    targetsL,
    targetsR,
    targetEls,
  }
  resizingSpacer.value = b
  resizingWidth.value = Math.round(startWidth)
}

// 輔助線的幾何:垂直範圍取「目標 item ∪ spacer」的聯集,線因此從目標那一行連到
// 被拖的這一行。目標的 y 在此刻才量——pointerdown 的快照會被拖曳中的折行數變化
// 作廢(自己這行少一折,下方所有行整批往上移),x 不受影響所以那個仍可快照
function buildSpacerGuide(
  ctx: NonNullable<typeof spacerResizeCtx>,
  guideX: number,
  guideIndex: number,
  spacerRect: DOMRect,
): { x: number; top: number; height: number } | null {
  const targetRect = ctx.targetEls[guideIndex]?.getBoundingClientRect()
  if (!targetRect) return null
  const rows = ctx.rowsEl.getBoundingClientRect()
  const top = Math.min(targetRect.top, spacerRect.top)
  const bottom = Math.max(targetRect.bottom, spacerRect.bottom)
  return { x: guideX - rows.left, top: top - rows.top, height: bottom - top }
}

function onSpacerGripMove(e: PointerEvent): void {
  const ctx = spacerResizeCtx
  if (!ctx || e.pointerId !== ctx.pointerId) return
  const rect = ctx.spacerEl.getBoundingClientRect()
  const result = computeSpacerResize({
    align: ctx.align,
    side: ctx.side,
    widthF: ctx.widthF,
    deltaX: e.clientX - ctx.lastX,
    rectLeft: rect.left,
    rectRight: rect.right,
    targetsL: ctx.targetsL,
    targetsR: ctx.targetsR,
    // 上限 = 行容器寬（實測）:間隔永遠不寬於它的行
    maxWidth: ctx.spacerEl.parentElement?.getBoundingClientRect().width ?? Infinity,
  })
  ctx.lastX = e.clientX
  ctx.widthF = result.widthF
  resizingWidth.value = result.width
  spacerGuide.value = result.guideX !== null && result.guideIndex !== null
    ? buildSpacerGuide(ctx, result.guideX, result.guideIndex, rect)
    : null
}

// commit + 清理。除了 pointerup / pointercancel,退出編輯模式也走這裡——
// grip 是 v-if="editing" 的,拖曳中按「完成」會讓元素 unmount、pointerup
// 永遠送不到,不清的話 resizing 視覺會殘留到下次進編輯
function finishSpacerResize(): void {
  const ctx = spacerResizeCtx
  if (!ctx) return
  if (resizingWidth.value !== null) ctx.btn.width = resizingWidth.value
  spacerResizeCtx = null
  resizingSpacer.value = null
  resizingWidth.value = null
  spacerGuide.value = null
}

function onSpacerGripUp(e: PointerEvent): void {
  if (spacerResizeCtx && e.pointerId !== spacerResizeCtx.pointerId) return
  finishSpacerResize()
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
  if (!editing.value) return
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
  const actions = barEl.value?.querySelectorAll<HTMLElement>('.eqt-tag-bar__line-actions') ?? []
  ;(actions[Math.min(lineMenuIdx.value, actions.length - 1)] ?? editToggleEl.value)?.focus()
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
  if (!editing.value || !line || line.kind !== 'buttons' || !line.buttons[ti]) return
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

watch(editing, (enabled) => {
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
  const wrap = barEl.value?.querySelectorAll('.eqt-tag-bar__line-wrap')[tagMenuLineIdx.value]
  const buttons = wrap?.querySelectorAll<HTMLElement>('.eqt-tag-bar__btn, .eqt-tag-bar__spacer') ?? []
  const fallback = buttons[Math.min(tagMenuButtonIdx.value, buttons.length - 1)]
    ?? wrap?.querySelector<HTMLElement>('.eqt-tag-bar__line-actions')
    ?? editToggleEl.value
  fallback?.focus()
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

// toggle Off 走 dismissTerms（殘留 off 灰按鈕 + push history），跟 SearchPanel
// 內部 button 被點 Off 的行為一致。session 是 module-level singleton、不需要
// showSearchPanel 守衛（即使 panel 視覺收起，session 邏輯仍在）
function dispatchTransition(tags: string[], next: TagState): void {
  if (next === TagState.Off) {
    dismissTerms(tags)
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
  <div
    ref="barEl"
    class="eqt-tag-bar"
    :class="[currentTagStyleClass, { 'eqt-tag-bar--accent-on-include': useAccentOnInclude }]"
    @dblclick="onBarDblClick"
    @contextmenu.capture="preventNativeContextMenuWhileEditing"
    @contextmenu="onBarContextMenu"
  >
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
        <div v-for="n in lines.length" :key="n" class="eqt-tag-bar__line-wrap eqt-tag-bar__line-wrap--placeholder">
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
                  ></span>
                  <span
                    v-if="editing && spacerHasGrip(b, lineAlignOf(line), 'right')"
                    class="eqt-tag-bar__spacer-grip"
                    :title="t('tagbar.spacerResizeTitle')"
                    @pointerdown="onSpacerGripDown($event, li, b, lineAlignOf(line), 'right')"
                    @pointermove="onSpacerGripMove"
                    @pointerup="onSpacerGripUp"
                    @pointercancel="onSpacerGripUp"
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
      <div v-if="showSearchPanel" class="eqt-tag-bar__search-area">
        <span class="eqt-tag-bar__search-area-label">{{ t('tagbar.searchPanel') }}</span>
        <SearchPanel
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
        <!-- 空位加的是行內物而不是行，所以不併進左邊那條 split -->
        <div v-if="editing" class="eqt-tag-bar__item-add">
          <button
            class="eqt-tag-bar__item-add-btn"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="addSpacerMenuOpen"
            @click="toggleAddSpacerMenu"
          ><Plus :size="12" /> {{ t('tagbar.addSpacer') }}</button>
          <ContextMenu
            v-model:open="addSpacerMenuOpen"
            :anchor-el="addSpacerTrigger"
            :ignore="[addSpacerTrigger]"
            auto-focus
            :aria-label="t('tagbar.addSpacer')"
            placement="top-start"
          >
            <button type="button" class="eqt-context-menu__item" @click="onAddSpacer('fixed')">
              <ArrowLeftRight :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.spacerModeFixed') }}</span>
            </button>
            <button type="button" class="eqt-context-menu__item" @click="onAddSpacer('flex')">
              <AlignHorizontalSpaceBetween :size="14" class="eqt-context-menu__icon" /><span class="eqt-context-menu__label">{{ t('tagbar.spacerModeFlex') }}</span>
            </button>
          </ContextMenu>
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
            ref="editToggleEl"
            class="eqt-tag-bar__ctrl eqt-tag-bar__ctrl--toggle"
            :class="{ 'is-active': editing }"
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
    color: var(--eqt-text);
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
    // spacer resize guide 的定位基準：輔助線用絕對座標橫跨行與行之間
    position: relative;
    display: flex;
    flex-direction: column;
    // 列間距歸屬到各 row 的 padding，避免 hover / drag hit area 中間出現死區。
    gap: 0;
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
    display: grid;
    grid-template-columns:
      var(--eqt-controls-w, var(--eqt-row-h))
      minmax(0, 1fr)
      var(--eqt-controls-w, var(--eqt-row-h));
    align-items: flex-start;
    padding-block: 2px;
    margin-inline: calc(-1 * var(--eqt-controls-w, var(--eqt-row-h)));

    // 建立新 profile 時只畫中央空行；沒有左右 controls 也必須留在內容欄。
    &--placeholder > .eqt-tag-bar__line {
      grid-column: 2;
    }

    // 左右 controls 都代表「操作這一行」：hover 任一側時高亮完整三欄 row；
    // 行操作 popup 離開 DOM 到 Teleport 後，則由 actions-active 延續狀態。
    &:has(> .eqt-tag-bar__line-controls .eqt-tag-bar__handle:hover),
    &:has(> .eqt-tag-bar__line-actions:hover),
    &--actions-active {
      background: var(--eqt-bg-hover);
      border-radius: var(--eqt-radius-sm);
    }

    &--ghost {
      opacity: 0.4;
    }
  }

  &__line-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
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
    margin-top: 6px;
    margin-bottom: 6px;
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

  // 「+ 空位」自成一格。它加的是行內物（Button）不是行（Line）——併進左邊那條
  // split 會讓兩個層級讀起來像三個平行選項，使用者得自己把層級補回來。
  // hug content：撐滿留給真正管「行」的那組
  &__item-add {
    @include btn-split-group;
  }
  &__item-add-btn {
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
    color: var(--eqt-text);
  }

  // btn-icon 的非正方變體：高度照樣是 row-h，但寬度由內容決定（保留 padding）。
  // hover 走 danger 色（不變底）給「會刪行」的視覺暗示。
  &__line-actions {
    @include btn-icon;
    width: 100%;
    padding: 0;
    flex-shrink: 0;

    &:hover:not(:disabled) {
      color: var(--eqt-danger);
    }
  }

  &__line-menu-back {
    @include btn-ghost;
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px;
    color: var(--eqt-text);
    font-weight: 600;
  }

  &__line {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: var(--eqt-row-h);

    &--buttons-align-center {
      justify-content: center;
    }

    &--buttons-align-right {
      justify-content: flex-end;
    }
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
    color: var(--eqt-text);
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
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg);
    color: var(--eqt-text);
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
    color: var(--eqt-text);
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

  // 行內空位：非編輯時純佔位、完全隱形；編輯時畫虛線框給拖曳 / 右鍵一個可視
  // 目標，拖得動的邊再加一個方括號。flex 變體吃掉整行剩餘空間（把兩側按鈕
  // 推開）、fixed 變體寬度由使用者拖把手調出的 px 快照（inline style 設定）。
  &__spacer {
    $spacer: &;

    position: relative;
    box-sizing: border-box;
    height: var(--eqt-row-h);

    &--flex {
      flex: 1 1 0;
      min-width: 8px;
    }

    &--fixed {
      flex: 0 0 auto;
      // 渲染端保險:不管資料存了多大的 width(舊髒資料、換窄視窗載入),
      // 都 clamp 在行容器寬內,不溢出破版
      max-width: 100%;
    }

    &--editing {
      border: var(--eqt-border-width) dashed color-mix(in srgb, var(--eqt-border) 60%, transparent);
      border-radius: var(--eqt-radius-sm);
      cursor: grab;

      &:focus-visible {
        outline: var(--eqt-border-width) solid var(--eqt-green);
        outline-offset: 1px;
      }
    }

    // 拖得動的那一緣就是把手,畫成實線主文字色的方括號——豎線標出那條邊,
    // 上下再各往內延伸一小段包住轉角,整體讀作「這一整塊邊區抓得住」,跟另外
    // 三邊的虛線分開(虛線說「這是佔位物」)。
    //
    // 用偽元素畫成一個有右側圓角的 border box,而不是疊一根直條上去:圓角因此
    // 自動吻合外框。定位相對 padding box,所以三個方向各外推一個 border-width
    // 才貼齊 border box。寬度 cap 在半寬內,免得最小寬的間隔上兩個括號對撞
    &--grip-left#{$spacer}--editing::before,
    &--grip-right#{$spacer}--editing::after {
      content: '';
      position: absolute;
      box-sizing: border-box;
      top: calc(-1 * var(--eqt-border-width));
      bottom: calc(-1 * var(--eqt-border-width));
      width: min(6px, calc(50% + var(--eqt-border-width)));
      border: var(--eqt-border-width) solid var(--eqt-text);
      pointer-events: none;
    }

    &--grip-left#{$spacer}--editing::before {
      left: calc(-1 * var(--eqt-border-width));
      border-right: none;
      border-radius: var(--eqt-radius-sm) 0 0 var(--eqt-radius-sm);
    }

    &--grip-right#{$spacer}--editing::after {
      right: calc(-1 * var(--eqt-border-width));
      border-left: none;
      border-radius: 0 var(--eqt-radius-sm) var(--eqt-radius-sm) 0;
    }
  }

  &__spacer-body {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--eqt-text-hint);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    user-select: none;
  }

  // 右緣 resize 把手:純透明熱區,沒有自己的視覺——使用者看到的把手是 --grip-right
  // 畫的那個方括號。照 VS Code sash 的模型,熱區比視覺寬得多:2px 的線點不到,
  // 所以向外擴 4px、向內吃一段。
  // 寬度 cap 在「spacer 半寬 + 外擴」內:居中行雙把手在接近最小寬的間隔上,
  // 向內的熱區各不超過半寬,兩把手不重疊搶點
  &__spacer-grip {
    position: absolute;
    top: calc(-1 * var(--eqt-border-width));
    bottom: calc(-1 * var(--eqt-border-width));
    right: -6px;
    width: min(12px, calc(50% + 6px));
    cursor: ew-resize;
    touch-action: none;
    z-index: 2;

    // 右對齊行的鏡像：flex-end 下右緣是不動錨點、左緣才是拖了會動的邊,
    // 把手移到左緣才不會「手在右邊拖、內容往左跑」
    &--left {
      right: auto;
      left: -6px;
    }
  }

  // smart guide 吸附輔助線：resize 命中其他行的邊緣時，從那一行連到被拖的這
  // 一行。垂直範圍由 JS 逐幀給（top / height），這裡只定形狀
  &__spacer-guide {
    position: absolute;
    width: 2px;
    background: var(--eqt-status-or);
    pointer-events: none;
    z-index: 5;
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

      // editing 時 bg 填成 border 色——border 跟 bg 同色變實心填充，
      // 從外圍快速一瞄就能看出當前在編輯模式（不用先讀「完成 / 編輯」文字）。
      // hover 也維持同色，否則 hover overlay 會把實心填充蓋掉、看起來像
      // 退出了 editing 狀態
      &.is-active,
      &.is-active:hover {
        background: var(--eqt-border);
      }
    }
  }

  &__ctrl-hidden {
    visibility: hidden;
  }
}
</style>
