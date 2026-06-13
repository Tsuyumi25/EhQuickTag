<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import Draggable from 'vuedraggable'
import { parseTerm } from '@/services/searchSyntax'
import { tokenize, tokenIdentity } from '@/services/tagState'
import { lines, searchPanelShowCJK as showCJK, enableHistory } from '@/services/store'
import { findEntryByNsTag, tagDbVersion } from '@/services/tagDb'
import { t } from '@/composables/useI18n'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
import { SearchSessionKey } from '@/composables/useSessionTerms'
import { useBilingualWrap } from '@/composables/useBilingualWrap'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import SearchTermRows from '@/components/SearchTermRows.vue'
import type { TagButton } from '@/types'

const props = defineProps<{
  modelValue: string
  editing?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  addToSearch: []
  search: []
  // chip drag-out 期間發給 TagBar，跟 TagBar 自己拖按鈕的 tagDragging 接同一個
  // 守衛，擋 drop 後 synthesized click 命中 TagBar 既有按鈕觸發 onConfigure
  'drag-start': []
  'drag-end': []
}>()

// term 顯示語言：預設跟 locale 走、可在 controls-row 用 toggle 按鈕 override。
// 持久化到 GM storage（store 的 searchPanelShowCJK），跨頁 / 重開瀏覽器後
// 維持上次選擇。store 端命名比較具體、檔案內 alias 成 showCJK 用習慣的短名
function toggleLang(): void { showCJK.value = !showCJK.value }

// resolvedMode / effectiveShowCJK 跟 SuggestionList / SearchTermRows 共用一份解析
// 邏輯（useDisplayConfig）。改邏輯一處到位
const { resolvedMode, effectiveShowCJK, cjkDisplay } = useDisplayConfig()

// === sessionTerms / history 狀態機從 App.vue inject ===
//
// 細節跟 invariants 證明在 composables/useSessionTerms.ts。
// SearchPanel 不再自己持有 session——App.vue 在 setup 階段呼一次 useSessionTerms
// 後 provide，這層只負責 render + 接 emit
const session = inject(SearchSessionKey)
if (!session) throw new Error('SearchPanel: SearchSessionKey not provided')
const {
  sessionTerms, history,
  sessionIdentitySet,
  dismissTerms, clearSearch, clearHistory, recordSubmitAndFlush,
  onRestoreHistory, onHistoryChange,
} = session

// loadTagDb 不在這呼叫——App.vue 已經 setup 階段觸發。historyDisplays computed
// 用 tagDb.tagDbVersion 當 reactive signal，DB ready 時自動 recompute

// button 牆已涵蓋的 identity 集合——visibleHistory 用它扣除重複
const buttonIdentities = computed(() => {
  const set = new Set<string>()
  for (const line of lines) {
    if (line.kind !== 'buttons') continue
    for (const btn of line.buttons) {
      if (btn.kind !== 'tag') continue
      for (const tag of btn.tags) {
        const id = tokenIdentity(tag)
        if (id) set.add(id)
      }
    }
  }
  return set
})

// === History row 量測：獨立一份 useBilingualWrap，container 是 history row 自己 ===
// SearchTermRows 內 namespace rows 各自有量測，跟 history row 互不干擾
const historyContainerRef = ref<HTMLElement | null>(null)

// 歷史 row 顯示用：去掉 sessionTerms 內身份（不論 active 或 off）跟 button 牆身份。
// visibleHistory 純走 cached lookup，history 變動不會 rebuild sessionIdentitySet。
const visibleHistory = computed(() => {
  return history.value.filter(p => {
    const id = tokenIdentity(p)
    if (!id) return false
    if (sessionIdentitySet.value.has(id)) return false
    if (buttonIdentities.value.has(id)) return false
    return true
  })
})

// 解析 history positive → 兩語言版本（display 跟著 showCJK 切換）。
// 無條件算兩種文字：display 給 v-render，zh/en 給 chunkByMaxWidth 量測對齊
//
// English 模式 = literal（保 suffix）徹底復現原生搜索欄字面。
// CJK 模式 = `ns_label:cjk_name`（無 suffix）給 CJK 使用者讀的友善形式。
// literal 額外存著給 drag-clone 用
function historyEntryTexts(positive: string): { display: string; zh: string; en: string; literal: string } {
  const parsed = parseTerm(positive)
  if (parsed.parseError) return { display: positive, zh: positive, en: positive, literal: positive }
  // history positive 是 canonical 形（dismissTerms 推進來時 prefix 已剝）。
  // Off state 沒 prefix，literal 直接 = positive
  const literal = positive
  if (!parsed.namespace) {
    return { display: literal, zh: literal, en: literal, literal }
  }
  const cjkEntry = findEntryByNsTag(parsed.namespace, parsed.tag)
  const enText = literal
  const zhText = cjkEntry
    ? `${t(`ns.${parsed.namespace}`)}:${cjkDisplay(cjkEntry.name)}`
    : enText
  const display = effectiveShowCJK.value ? zhText : enText
  return {
    display,
    zh: zhText,
    en: enText,
    literal,
  }
}

interface HistoryTerm { positive: string; display: string; zh: string; en: string; literal: string; cloneLabel: string }

// computed memoize history display——visibleHistory / showCJK 不變就直接拿快取，
// 不在 v-for 內逐項重跑 parseTerm + findEntryByNsTag。
// 跟 da4ae79（identityIndex 從 N 顆按鈕收成 1 張共用 Map）同形式
//
// dbReady 依賴：tagDb 未載入時 findEntryByNsTag 回 undefined → historyEntryTexts
// fallback 到英文。dbReady 翻 true 後要重算才能切到 CJK 翻譯，不然要使用者點
// 兩次 toggle 才會變中文（第一次切走、第二次切回時 tagDb 已載入）
const historyDisplays = computed<HistoryTerm[]>(() => {
  void tagDbVersion.value
  return visibleHistory.value.map(positive => {
    const texts = historyEntryTexts(positive)
    // history chip 沒有 misc / namespace 之分，cloneLabel 跟 display 同源
    return { positive, ...texts, cloneLabel: texts.display }
  })
})

const { chunkBilingual: chunkBilingualHistory } = useBilingualWrap({
  containerRef: historyContainerRef,
  itemSelector: '.eqt-search-panel__button',
  rowSelector: '.eqt-search-panel__cells',
  itemsSignal: () => historyDisplays.value,
})

const historyRows = computed<HistoryTerm[][]>(() => {
  return chunkBilingualHistory(historyDisplays.value, c => c.zh, c => c.en)
})

// === Drag options ===
// History chip 走 move 語意（跟 TagBar 內部按鈕重排同一條路徑）——sortablejs
// 把 source DOM 整顆搬走、原位真的不見，跟 namespace chip 的 clone 視覺自然
// 區分。drop 成功時 @change 接 removed 事件、同步把 entry 從 history.value 剔掉、
// schedulePersist。drop 取消（拖到空白處放開）sortablejs 自動 revert source、
// 也不會發 removed，history.value 不動
//
// 視覺三 class 沿用同一套——跟 TagBar 內部 drag 對齊「正常拖拽」觀感。
// 不要對 ghostClass 用 display: none：sortablejs forceFallback 模式下浮動
// ghostEl 是 dragEl.cloneNode 出來的，在 cloneNode 之前 ghostClass 已套到
// dragEl，display:none 讓 dragEl rect=0×0 → ghostEl 跟著拿到 width:0 → 連
// 跟著游標的浮動 ghost 都看不見
const moveDragOptions = {
  ...baseDragOptions,
  group: { name: EQT_TAGS_GROUP, pull: true, put: false },
  sort: false,
  ghostClass: 'eqt-search-panel__button--ghost-drag',
  chosenClass: 'eqt-search-panel__button--chosen',
  dragClass: 'eqt-search-panel__button--drag',
}

// 跟 :item-key 綁的 callback：hoist 成 module-scope 常數，避免 inline arrow
// 每次 template render 生新 function identity ⇒ vuedraggable 的 getKey computed
// 看 itemKey 變 ⇒ 每 render 重跑 computeNodes
const historyItemKey = (h: HistoryTerm): string => h.positive

// History chip 拖出 → TagButton（source 已把 literal + cloneLabel 算好）
function cloneToButton({ literal, cloneLabel }: { literal: string; cloneLabel: string }): TagButton {
  return { kind: 'tag', tags: [literal], label: cloneLabel }
}

// history chip click = 把 term 加回搜尋，editing 時鎖住、只剩拖拽路徑
function onHistoryClick(positive: string): void {
  if (props.editing) return
  onRestoreHistory(positive)
}

function onAddClick(): void { emit('addToSearch') }
// 送出前先把當前 A 推進 H + sync flush GM storage：
//   - navigate 走後新頁面 mount 也會在 loadHistory 補一次，但若不 await flush，
//     form.submit() 同步 navigate 跟 cacheSet async write 會競賽（finding #3）
//   - searchNewTab 路徑當前 tab 不 navigate，flush 也只是把 100ms debounce 提前
//     觸發，無副作用
async function onSearchClick(): Promise<void> {
  await recordSubmitAndFlush()
  emit('search')
}
</script>

<template>
  <div
    class="eqt-search-panel"
    :class="{ 'eqt-search-panel--editing': editing }"
  >
    <SearchTermRows
      flat
      :model-value="modelValue"
      :session-terms="sessionTerms"
      :editing="editing"
      @update:model-value="emit('update:modelValue', $event)"
      @dismiss-terms="dismissTerms"
      @drag-start="emit('drag-start')"
      @drag-end="emit('drag-end')"
    />

    <div
      v-if="enableHistory && historyDisplays.length"
      ref="historyContainerRef"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ t('tagbar.history') }}:</div>
      <div class="eqt-search-panel__cells">
        <Draggable
          v-for="(row, rowIdx) in historyRows"
          :key="rowIdx"
          v-bind="moveDragOptions"
          tag="div"
          class="eqt-search-panel__cells-row"
          :model-value="row"
          :item-key="historyItemKey"
          :clone="cloneToButton"
          :disabled="!editing"
          @start="emit('drag-start')"
          @end="emit('drag-end')"
          @change="onHistoryChange"
        >
          <template #item="{ element: item }">
            <button
              class="eqt-search-panel__button eqt-search-panel__button--ghost"
              type="button"
              @click="onHistoryClick((item as HistoryTerm).positive)"
            >{{ (item as HistoryTerm).display }}</button>
          </template>
        </Draggable>
      </div>
    </div>

    <div class="eqt-search-panel__controls-row">
      <div class="eqt-search-panel__controls-group">
        <button
          v-if="resolvedMode === 'toggle'"
          class="eqt-search-panel__lang-toggle"
          type="button"
          :title="t('tagbar.toggleLang')"
          @click="toggleLang"
        ><span :class="{ 'eqt-search-panel__lang-hidden': !showCJK }">中文</span><span :class="{ 'eqt-search-panel__lang-hidden': showCJK }">EN</span></button>
        <button
          v-if="enableHistory"
          class="eqt-search-panel__text-btn"
          type="button"
          data-testid="clear-history"
          @click="clearHistory"
        >{{ t('tagbar.clearHistory') }}</button>
      </div>
      <button
        class="eqt-search-panel__add"
        type="button"
        :title="t('tagbar.findTag')"
        @click="onAddClick"
      ><span class="eqt-search-panel__add-icon">+</span><span class="eqt-search-panel__add-label">{{ t('tagbar.findTag') }}</span></button>
      <div class="eqt-search-panel__controls-group">
        <button
          class="eqt-search-panel__text-btn"
          type="button"
          data-testid="clear-search"
          @click="clearSearch"
        >{{ t('tagbar.clearSearch') }}</button>
        <button
          class="eqt-search-panel__text-btn"
          type="button"
          data-testid="search-submit"
          @click="onSearchClick"
        >{{ t('tagbar.search') }}</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// Panel root 是 outer grid auto 1fr：SearchTermRows（flat 模式）攤平內部 namespace
// row、history row（display: contents）、controls-row（跨欄）全部共用同一 grid
// column，label 跨 row 自動對齊
.eqt-search-panel {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 8px;
  row-gap: 4px;
  align-items: start;
}

// 工具列：左群組（lang toggle + clear history）／右群組（clear search + search + 新增）。
// grid-column: 1 / -1 跨完整寬度——這是 outer grid 共用 column 換來的成本
.eqt-search-panel__controls-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eqt-search-panel__controls-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.eqt-search-panel__lang-toggle {
  display: inline-grid;
  align-items: center;
  justify-items: center;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: var(--eqt-transition-base);

  > span {
    grid-area: 1 / 1;
  }

  &:hover {
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}

.eqt-search-panel__lang-hidden {
  visibility: hidden;
}

// 中間的「尋找標籤」按鈕：兩側 control group 之間撐滿剩餘寬度——這是打開
// AddTagPopup 的主要入口，視覺上做大方便瞄準。
// 「+」icon 用 22px 當視覺主角；label 12px 跟旁邊 text-btn 字級對齊
.eqt-search-panel__add {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  transition: var(--eqt-transition-base);

  &:hover {
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}

.eqt-search-panel__add-icon {
  font-size: 22px;
}

.eqt-search-panel__add-label {
  font-size: 12px;
}

// 文字按鈕：跟 __add / __lang-toggle 同高，寬度跟著文字 + 水平 padding。
// 跟 __lang-toggle 統一 font-size 12px，視覺上是同一組控制項
.eqt-search-panel__text-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  transition: var(--eqt-transition-base);

  &:hover {
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}
</style>
