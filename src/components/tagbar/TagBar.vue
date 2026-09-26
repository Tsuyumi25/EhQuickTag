<script setup lang="ts">
import { ref, computed } from 'vue'
import Draggable from 'vuedraggable'
import { AlignHorizontalSpaceBetween, ArrowLeftRight, ExternalLink, GripVertical, Pencil, Check, Settings, Plus, Info } from '@lucide/vue'
import TagBarProfileSwitcher from './TagBarProfileSwitcher.vue'
import TagBarLines from './TagBarLines.vue'
import SearchPanel from '@/components/search/SearchPanel.vue'
import TagConfigPopup from './TagConfigPopup.vue'
import UrlConfigPopup from './UrlConfigPopup.vue'
import type { Line, SpacerButton } from '@/types'
import { dblClickLeft, dblClickRight, dblClickLeftNewTabActive, dblClickRightNewTabActive, useAccentOnInclude, showSearchPanel, nsFormat, defaultExactMatch, type DblClickAction } from '@/services/store'
import { openSettings, openSearchPopup } from '@/services/appOverlays'
import { baseDragOptions, EQT_TAGS_GROUP, EQT_LINES_GROUP } from '@/utils/drag'
import { recordSubmitAndFlush } from '@/services/search/searchSession'
import { t } from '@/composables/useI18n'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { useTagButtonEditor } from '@/composables/useTagButtonEditor'
import { useEhFormHost } from '@/composables/useEhFormHost'
import { usePageSearch } from '@/composables/usePageSearch'
import { DEFAULT_SPACER_WIDTH } from '@/services/tagbar/spacerResize'

const ACTION_KEYS: Record<DblClickAction, string> = {
  search: 'tagbar.search',
  searchNewTab: 'tagbar.searchNewTab',
  clearSearch: 'tagbar.clearSearch',
  toggleEdit: 'tagbar.toggleEdit',
  openSearchPopup: 'tagbar.browseTag',
  none: 'tagbar.none',
}

const host = useEhFormHost()!
const { searchText, search } = usePageSearch()

const {
  tagPopupValue,
  urlPopupValue,
  editingLineColor,
  pendingAdd,
  onConfigure: openButtonEditor,
  onAdd,
  onSave,
  onClose,
} = useTagButtonEditor()

const editing = ref(false)
const onCreationPage = ref(false)
const dragging = ref(false)
const lineArea = ref<InstanceType<typeof TagBarLines> | null>(null)
const editToggleEl = ref<HTMLButtonElement | null>(null)

function onTagStart() {
  dragging.value = true
  lineArea.value?.closeActionMenus()
}

function onTagEnd() {
  setTimeout(() => { dragging.value = false }, 0)
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
    openSearchPopup()
    return
  }
  if (action === 'clearSearch') {
    searchText.value = ''
  } else {
    // await flush 確保 navigate 前 GM_setValue resolve。
    await recordSubmitAndFlush()
    // 旗標只跟 searchNewTab 走：其他 action 不帶，避免隱藏的側設定值漏進
    // 搜尋送出端（那裡收不到旗標時走寫死的切換）
    search(action, action === 'searchNewTab' ? newTabActive : undefined)
  }
}

// 底部工具箱：四種新元素都靠拖曳落位，不再有「新增到預設位置」的點擊入口。
// 兩箱分屬不同 group——行工具落進 line-rows,行內工具落進某一行的 buttons。
// 模板本身是唯讀樣板,靠 :clone 深拷貝後才交給目標清單,否則 vuedraggable
// 預設的 clone 是 identity,拖出去的物件會跟工具箱裡那個共用參考。
const lineTools: Line[] = [
  { kind: 'buttons', buttons: [] },
  { kind: 'separator' },
]

const spacerTools: SpacerButton[] = [
  { kind: 'spacer', mode: 'fixed', width: DEFAULT_SPACER_WIDTH },
  { kind: 'spacer', mode: 'flex' },
]

function cloneTool<T>(tool: T): T {
  return JSON.parse(JSON.stringify(tool)) as T
}

const lineToolDragOptions = {
  ...baseDragOptions,
  group: { name: EQT_LINES_GROUP, pull: 'clone' as const, put: false },
  sort: false,
  ghostClass: 'eqt-tag-bar__tool--ghost',
  chosenClass: 'eqt-tag-bar__tool--chosen',
  dragClass: 'eqt-tag-bar__tool--drag',
}

const spacerToolDragOptions = {
  ...lineToolDragOptions,
  group: { name: EQT_TAGS_GROUP, pull: 'clone' as const, put: false },
}

// 說明面板列的可拖曳項目直接由工具箱資料推導，增減或改名時不會漏改說明
const dragToolNames = computed(() => [
  ...lineTools.map(tool => t(tool.kind === 'separator' ? 'tagbar.addSeparatorLine' : 'tagbar.addButtonLine')),
  ...spacerTools.map(tool => t(tool.mode === 'flex' ? 'tagbar.spacerModeFlex' : 'tagbar.spacerModeFixed')),
].join(t('tagbar.infoListSeparator')))
</script>

<template>
  <div
    class="eqt-tag-bar"
    :class="[currentTagStyleClass, { 'eqt-tag-bar--accent-on-include': useAccentOnInclude }]"
    @dblclick="onBarDblClick"
    @contextmenu.capture="preventNativeContextMenuWhileEditing"
    @contextmenu="onBarContextMenu"
  >
    <!-- info hover 觸發的覆蓋層，樣式定義在 .eqt-tag-bar__overlay -->
    <div class="eqt-tag-bar__overlay"></div>
    <div class="eqt-tag-bar__lines">
      <TagBarProfileSwitcher v-model:on-creation-page="onCreationPage" :editing="editing">
        <span class="eqt-tag-bar__info"><Info :size="16" /><span class="eqt-tag-bar__info-text">
          <span class="eqt-tag-bar__info-section">{{ t('tagbar.infoPreviewSection') }}</span>
          <span class="eqt-tag-bar__info-row">{{ t('tagbar.infoPreviewLeft', { action: t(ACTION_KEYS[dblClickLeft]) }) }}</span>
          <span class="eqt-tag-bar__info-row">{{ t('tagbar.infoPreviewRight', { action: t(ACTION_KEYS[dblClickRight]) }) }}</span>
          <span class="eqt-tag-bar__info-hint">{{ t('tagbar.infoHint') }}</span>
          <span class="eqt-tag-bar__info-section">{{ t('tagbar.infoEditSection') }}</span>
          <span class="eqt-tag-bar__info-row">{{ t('tagbar.infoEditLeft') }}</span>
          <span class="eqt-tag-bar__info-row">{{ t('tagbar.infoEditRight') }}</span>
          <span class="eqt-tag-bar__info-row">{{ t('tagbar.infoEditDrag', { tools: dragToolNames }) }}</span>
        </span></span>
      </TagBarProfileSwitcher>

      <TagBarLines
        ref="lineArea"
        v-model="searchText"
        :editing="editing"
        :on-creation-page="onCreationPage"
        :dragging="dragging"
        @configure="openButtonEditor"
        @drag-start="onTagStart"
        @drag-end="onTagEnd"
        @controls-width="host.setControlsWidth"
        @focus-edit-toggle="editToggleEl?.focus()"
      />

      <div v-if="showSearchPanel" class="eqt-tag-bar__search-area">
        <span class="eqt-tag-bar__search-area-label">{{ t('tagbar.searchPanel') }}</span>
        <SearchPanel
          v-model="searchText"
          :editing="editing"
          @add-to-search="openSearchPopup"
          @search="search('search')"
          @drag-start="onTagStart"
          @drag-end="onTagEnd"
        />
      </div>
      <div class="eqt-tag-bar__bottom-row">
        <Draggable
          v-if="editing"
          v-bind="lineToolDragOptions"
          :model-value="lineTools"
          :item-key="(tool: Line) => tool.kind"
          :clone="cloneTool"
          tag="div"
          class="eqt-tag-bar__line-add"
        >
          <template #item="{ element: tool }">
            <div class="eqt-tag-bar__tool">
              <GripVertical :size="12" />
              {{ t(tool.kind === 'separator' ? 'tagbar.addSeparatorLine' : 'tagbar.addButtonLine') }}
            </div>
          </template>
        </Draggable>
        <!-- 空位加的是行內物而不是行，所以不併進左邊那條 split -->
        <Draggable
          v-if="editing"
          v-bind="spacerToolDragOptions"
          :model-value="spacerTools"
          :item-key="(tool: SpacerButton) => tool.mode"
          :clone="cloneTool"
          tag="div"
          class="eqt-tag-bar__item-add"
        >
          <template #item="{ element: tool }">
            <div class="eqt-tag-bar__tool">
              <component :is="tool.mode === 'flex' ? AlignHorizontalSpaceBetween : ArrowLeftRight" :size="12" />
              {{ t(tool.mode === 'flex' ? 'tagbar.spacerModeFlex' : 'tagbar.spacerModeFixed') }}
            </div>
          </template>
        </Draggable>
        <div class="eqt-tag-bar__controls">
          <div class="eqt-tag-bar__ctrl-split">
            <button
              class="eqt-tag-bar__ctrl-split-btn"
              type="button"
              @click="onAdd('tag')"
            ><Plus :size="12" /> {{ t('tagbar.addTag') }}</button>
            <button
              class="eqt-tag-bar__ctrl-split-btn"
              type="button"
              @click="onAdd('url')"
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
            @click="openSettings()"
          ><Settings :size="12" /> {{ t('tagbar.settings') }}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- TagBar 整棵樹被 teleport 到 host 的 #eqt-bar-anchor，那裡的 stacking
       context 與字體 reset 都跟著 host search row 走。popup 再 teleport 回
       #eqt-app，維持與其他 overlay 相同的定位基準、字體與 translate=no 保護。 -->
  <Teleport to="#eqt-app">
    <TagConfigPopup
      v-if="tagPopupValue"
      :tag="tagPopupValue"
      :line-color="editingLineColor"
      :is-add="pendingAdd"
      :ns-format="nsFormat"
      :default-exact-match="defaultExactMatch"
      @save="onSave"
      @close="onClose"
    />

    <UrlConfigPopup
      v-if="urlPopupValue"
      :tag="urlPopupValue"
      :line-color="editingLineColor"
      @save="onSave"
      @close="onClose"
    />
  </Teleport>
</template>
