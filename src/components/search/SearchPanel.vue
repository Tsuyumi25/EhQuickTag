<script setup lang="ts">
import { computed, ref } from 'vue'
import Draggable from 'vuedraggable'
import { parseTerm } from '@/services/searchSyntax'
import { tokenize, tokenIdentity } from '@/services/tagState'
import { lines, enableHistory } from '@/services/store'
import { findEntryByNsTag, tagDbVersion } from '@/services/tagDb'
import { t } from '@/composables/useI18n'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
import {
  sessionTerms, history, sessionIdentitySet,
  dismissTerms, onRestoreHistory, onHistoryChange,
} from '@/services/search/searchSession'
import { useBilingualWrap } from '@/composables/useBilingualWrap'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import SearchTermRows from '@/components/search/SearchTermRows.vue'
import SearchControls from '@/components/search/SearchControls.vue'
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

// effectiveShowCJK 跟 SuggestionList / SearchTermRows 共用一份解析邏輯（useDisplayConfig）
const { effectiveShowCJK, cjkDisplay } = useDisplayConfig()

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

    <SearchControls
      class="eqt-search-panel__controls"
      show-lang-toggle
      show-clear-history
      show-add-to-search
      show-clear-search
      show-search
      @add-to-search="emit('addToSearch')"
      @search="emit('search')"
    />
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

// SearchControls 在 outer grid 內當第三個 row，跨整列。視覺樣式由 SearchControls
// 自家 CSS 負責，這層只給跨欄定位
.eqt-search-panel__controls {
  grid-column: 1 / -1;
}
</style>
