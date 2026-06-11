<script lang="ts">
// Module-level export：給 TagBar 之類 template ref 的 caller import 用。
// 跟 defineExpose 內的 shape 必須一致——後者用 satisfies 守住一致性
export interface SearchPanelExposed {
  dismissTerms(positives: string[]): void
  recordSubmitAndFlush(): Promise<void>
}
</script>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import Draggable from 'vuedraggable'
import { parseTerm, serializeTerm, type Prefix } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, getNextRightClickState, setTagState, buildIdentityIndex } from '@/services/tagState'
import { nsOrder, lines, searchPanelShowCJK as showCJK, enableHistory } from '@/services/store'
import { loadTagDb, findEntryByNsTag } from '@/services/tagDb'
import { t } from '@/composables/useI18n'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
import { useSessionTerms } from '@/composables/useSessionTerms'
import { useBilingualWrap } from '@/composables/useBilingualWrap'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { TagState, type TagButton } from '@/types'

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

// TermGroup.key 是 string | null（null = 「無 namespace」/ misc 列）。typed null
// 比字串 sentinel 強：TS 強制每個 consumer 明確 handle null 分支，未來不會被
// 「e站新增名為 __misc__ 的 namespace」這種 collision 偷襲
const MISC_KEY = null

// term 顯示語言：預設跟 locale 走、可在 controls-row 用 toggle 按鈕 override。
// 持久化到 GM storage（store 的 searchPanelShowCJK），跨頁 / 重開瀏覽器後
// 維持上次選擇。store 端命名比較具體、檔案內 alias 成 showCJK 用習慣的短名
function toggleLang(): void { showCJK.value = !showCJK.value }

// resolvedMode / effectiveShowCJK / effectiveConvertTW / cjkDisplay 跟
// SuggestionList 共用一份解析邏輯（useDisplayConfig）。改邏輯一處到位
const { resolvedMode, effectiveShowCJK, cjkDisplay } = useDisplayConfig()

// tagDb 載入完通知 groups computed 重算（term 從 raw 翻成 entry.name）
const dbReady = ref(false)

// === sessionTerms / history 狀態機（A/O/H/T 不變式 + persistence）===
// 細節跟 invariants 證明在 composables/useSessionTerms.ts
const {
  sessionTerms, history,
  sessionIdentitySet,
  dismissTerms, clearSearch, clearHistory, recordSubmitAndFlush,
  onRestoreHistory, onHistoryChange,
} = useSessionTerms({
  modelValue: () => props.modelValue,
  emitUpdate: (v) => emit('update:modelValue', v),
})

onMounted(async () => {
  await loadTagDb()
  dbReady.value = true
})

// === term 顯示用：state、group、display 全部從 sessionTerms + identityIndex 推導 ===

const identityIndex = computed(() => buildIdentityIndex(tokenize(props.modelValue)))

interface TermInfo {
  positive: string
  state: TagState
  displayShort: string  // namespace row 用：CJK = 翻譯名稱（無 ns）、English = 原生 token literal
  displayFull: string   // misc row 用：原生 token literal（state prefix + tag + suffix）
  literal: string       // raw search-syntax token（state prefix + ns + tag + suffix），給 drag-clone 用
  cloneLabel: string    // chip 當前顯示文字（namespace row = displayShort、misc row = displayFull）
  // 量測對齊用：兩語言版本的「實際渲染文字」。
  // namespace row 取 short 對應 CJK / Latin；misc row 兩者相同（literal 不翻譯）
  measureZh: string
  measureEn: string
}

interface TermGroup {
  key: string | null    // namespace name；null = misc/無 namespace 列
  label: string
  terms: TermInfo[]
}

// Off 給 explicit class（即使沒對應 style）：給 e2e / 外部觀察者一個正面條件
// 可 assert，避免 negate 推論在新 state 加入時靜默漏掉
const STATE_CLASS: Record<TagState, string> = {
  [TagState.Include]: 'eqt-search-panel__button--include',
  [TagState.Or]:      'eqt-search-panel__button--or',
  [TagState.Exclude]: 'eqt-search-panel__button--exclude',
  [TagState.Off]:     'eqt-search-panel__button--off',
}

// State → prefix 的對應表。跟 STATE_CLASS 對稱；直接給 serializeTerm 用，
// 不需要 unsound cast 把 string 強塞進 Prefix union
const STATE_PREFIX: Record<TagState, Prefix> = {
  [TagState.Include]: null,
  [TagState.Or]:      '~',
  [TagState.Exclude]: '-',
  [TagState.Off]:     null,
}

function stateOf(positive: string): TagState {
  const id = tokenIdentity(positive)
  if (!id) return TagState.Off
  const present = identityIndex.value.get(id)
  if (!present) return TagState.Off
  // 用 parseTerm 推 prefix，跟 codebase 其他地方一致；不依賴 normalizeNs 不動
  // prefix 位置的隱含 contract
  const prefix = parseTerm(present).prefix
  if (prefix === '-') return TagState.Exclude
  if (prefix === '~') return TagState.Or
  return TagState.Include
}

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

const groups = computed<TermGroup[]>(() => {
  void dbReady.value

  const buckets = new Map<string | null, TermInfo[]>()

  function pushTerm(positive: string, state: TagState): void {
    const parsed = parseTerm(positive)
    const groupKey: string | null = parsed.namespace ?? MISC_KEY
    const prefix = STATE_PREFIX[state]
    const prefixStr = prefix ?? ''

    // literal = 原生 search token 字面：state prefix + ns + tag + suffix。
    // 不再剝 suffix——使用者搜 'tag$' 拖出來要徹底復現「精確匹配」這個事實，
    // 不是默默 normalize 成 loose match
    const literal = serializeTerm({ ...parsed, prefix })

    // 兩語言文字無條件算出來。
    // CJK 模式 = state prefix + 翻譯名稱（無 ns 前綴、無 suffix）。
    // English 模式 = literal（原生 token 字面，包含 ns + suffix）——徹底復現原生搜尋欄
    const cjkEntry = parsed.namespace
      ? findEntryByNsTag(parsed.namespace, parsed.tag)
      : undefined
    const zhText = cjkEntry ? prefixStr + cjkDisplay(cjkEntry.name) : prefixStr + parsed.tag
    const enText = literal
    const displayShort = effectiveShowCJK.value ? zhText : enText
    const displayFull = literal

    // misc row 用 displayFull = literal，兩語言相等
    const isMisc = groupKey === MISC_KEY
    const cloneLabel = isMisc ? displayFull : displayShort
    const term: TermInfo = {
      positive, state, displayShort, displayFull, literal, cloneLabel,
      measureZh: isMisc ? literal : zhText,
      measureEn: isMisc ? literal : enText,
    }
    if (!buckets.has(groupKey)) buckets.set(groupKey, [])
    buckets.get(groupKey)!.push(term)
  }

  // 按 sessionTerms 順序 iterate——entry.active 決定 state 來源，位置由 array 自然維護。
  // Off entry 全部顯示（即使 button 牆已有同 identity）——本 session 內手動 Off
  // 過的 term 應該維持灰 chip 讓使用者一鍵 reactivate，不該被 button 牆「吃掉」
  for (const entry of sessionTerms.value) {
    if (entry.active) {
      pushTerm(entry.positive, stateOf(entry.positive))
    } else {
      pushTerm(entry.positive, TagState.Off)
    }
  }

  const result: TermGroup[] = []
  for (const ns of nsOrder.value) {
    if (buckets.has(ns)) {
      result.push({ key: ns, label: t(`ns.${ns}`), terms: buckets.get(ns)! })
      buckets.delete(ns)
    }
  }
  for (const [key, terms] of buckets) {
    if (key === MISC_KEY) continue
    result.push({ key, label: key, terms })
  }
  if (buckets.has(MISC_KEY)) {
    result.push({ key: MISC_KEY, label: t('tagbar.miscRow'), terms: buckets.get(MISC_KEY)! })
  }
  return result
})

// === 中英 wrap 對齊：useBilingualWrap 負責量測 + JS chunk ===
// 設計細節跟 cache key / 字型 ready / metrics ground truth 等坑在 composable 內
const containerRef = ref<HTMLElement | null>(null)

const { chunkBilingual } = useBilingualWrap({
  containerRef,
  itemSelector: '.eqt-search-panel__button',
  rowSelector: '.eqt-search-panel__cells',
  itemsSignal: () => groups.value,
})

interface TermGroupRows {
  key: string | null
  label: string
  rows: TermInfo[][]
}

const groupRows = computed<TermGroupRows[]>(() => {
  return groups.value.map(g => ({
    key: g.key,
    label: g.label,
    rows: chunkBilingual(g.terms, c => c.measureZh, c => c.measureEn),
  }))
})

// === 按鈕語意：跟 TagBar button 同套 ===
//
// term → Off：history 的唯一 push 點。Vue watch 是 deferred microtask，整個
// sync stack 跑完才觸發 syncFromSearch ⇒ 同步區內 mutation / emit 的先後順序
// 不影響 syncFromSearch 觀察結果（不需要 ordering guards）
// dismissTerms 從 useSessionTerms 取得，TagBar 也透過 defineExpose 走同一條路徑。

function applyTermState(positive: string, next: TagState): void {
  if (next === TagState.Off) {
    dismissTerms([positive])
  } else {
    emit('update:modelValue', setTagState(props.modelValue, [positive], next))
  }
}

defineExpose({ dismissTerms, recordSubmitAndFlush } satisfies SearchPanelExposed)

function onTermClick(term: TermInfo): void {
  // editing 時 chip 只負責被拖拽，不再切態——避免「拖之前不小心點到變 Off」
  // 的 UX 雷區。click handler 還掛著是要讓 sortablejs 的 mousedown/mouseup
  // 鏈走完，cursor 也維持 grab（暗示拖拽是唯一可用互動）
  if (props.editing) return
  // 跟 TagBar.onLeftClick 同邏輯：Include → Off，其他態 → Include
  const next = term.state === TagState.Include ? TagState.Off : TagState.Include
  applyTermState(term.positive, next)
}

function onTermContextMenu(e: MouseEvent, term: TermInfo): void {
  e.preventDefault()
  if (props.editing) return
  const next = getNextRightClickState([term.positive], undefined, term.state)
  if (next === null) return
  applyTermState(term.positive, next)
}

// history chip click = 把 term 加回搜尋，editing 時同樣鎖住，只剩拖拽路徑
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

// === Drag-out to TagBar：chip clone 成 TagButton ===
//
// 規則（cc80078 那串 commit 後對齊的 UX 契約）：
//   - TagBar editing 時 chip 才可拖（disabled prop 自 TagBar 下傳）
//   - 拖出 = clone，原 chip 不動（sortablejs pull: 'clone'）
//   - TagBar → SearchPanel 拒收（put: false），SearchPanel 純當 source
//   - 拖出物 = TagButton {tags: [chip 對應的 raw search token literal], label: 當前 chip 顯示文字}
//     - 「徹底復現原生搜索欄」契約：原生搜索欄寫什麼 token，拖出來的 button
//       tags 就存什麼。state prefix (~/-) + syntax suffix ($/*) + ns 一律保留
//     - label = chip 當下視覺文字（CJK / English 跟著 showCJK 拍快照）
//
// sort: false：source 端 chunked row 順序由我們的 JS chunk 算，不讓
// sortablejs 重排內部位置（會破 cells-row layout）
//
// ghostClass / chosenClass / dragClass：sortablejs 預設套 sortable-ghost
// 等三個 class，codebase 沒對應 style ⇒ 拖拽時原位 chip 完全沒視覺反饋。
// 用 SearchPanel 自家 namespace 的 modifier 跟 TagBar __btn--ghost 同視覺契約
const cloneDragOptions = {
  ...baseDragOptions,
  group: { name: EQT_TAGS_GROUP, pull: 'clone' as const, put: false },
  sort: false,
  ghostClass: 'eqt-search-panel__button--ghost-drag',
  chosenClass: 'eqt-search-panel__button--chosen',
  dragClass: 'eqt-search-panel__button--drag',
}

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
const termItemKey = (t: TermInfo): string => t.positive
const historyItemKey = (t: HistoryTerm): string => t.positive

// 兩種 chip source 共用 clone fn——source 已經把 literal + cloneLabel 算好
// （pushTerm / historyEntryTexts 階段），這裡只負責包成 TagButton
function cloneToButton({ literal, cloneLabel }: { literal: string; cloneLabel: string }): TagButton {
  return { kind: 'tag', tags: [literal], label: cloneLabel }
}

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
  void dbReady.value
  return visibleHistory.value.map(positive => {
    const texts = historyEntryTexts(positive)
    // history chip 沒有 misc / namespace 之分，cloneLabel 跟 display 同源
    return { positive, ...texts, cloneLabel: texts.display }
  })
})

const historyRows = computed<HistoryTerm[][]>(() => {
  return chunkBilingual(historyDisplays.value, c => c.zh, c => c.en)
})
</script>

<template>
  <div
    ref="containerRef"
    class="eqt-search-panel"
    :class="{ 'eqt-search-panel--editing': editing }"
  >
    <div
      v-for="group in groupRows"
      :key="group.key ?? '__misc__'"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ group.label }}:</div>
      <div class="eqt-search-panel__cells">
        <Draggable
          v-for="(row, rowIdx) in group.rows"
          :key="rowIdx"
          v-bind="cloneDragOptions"
          tag="div"
          class="eqt-search-panel__cells-row"
          :model-value="row"
          :item-key="termItemKey"
          :clone="cloneToButton"
          :disabled="!editing"
          @start="emit('drag-start')"
          @end="emit('drag-end')"
        >
          <template #item="{ element: term }">
            <button
              class="eqt-search-panel__button"
              :class="STATE_CLASS[(term as TermInfo).state]"
              type="button"
              @click="onTermClick(term as TermInfo)"
              @contextmenu="onTermContextMenu($event, term as TermInfo)"
            >{{ group.key === MISC_KEY ? (term as TermInfo).displayFull : (term as TermInfo).displayShort }}</button>
          </template>
        </Draggable>
      </div>
    </div>

    <div
      v-if="enableHistory && historyDisplays.length"
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
.eqt-search-panel {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 8px;
  row-gap: 4px;
  align-items: start;
}

.eqt-search-panel__row {
  display: contents;
}

.eqt-search-panel__label {
  color: var(--eqt-text-hint);
  font-size: 12px;
  line-height: var(--eqt-row-h);
  text-align: right;
  white-space: nowrap;
  user-select: none;
}

.eqt-search-panel__cells {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: var(--eqt-row-h);
  // grid 1fr 預設 minmax(auto, 1fr)，auto = min-content。row 是 flex-wrap: nowrap
  // 容器、min-content = 該 row 所有 item 寬度總和。沒這條的話 chunk 還沒跑或算
  // 偏小時，1fr 欄會被某一 row 的 min-content 撐到大於可用寬度，整列從 panel
  // 右邊視覺溢出。同時也是 useBilingualWrap 量 containerWidth 的取樣對象，
  // 撐爆會讓 chunk 用錯誤寬度連環誤判
  min-width: 0;
}

// JS chunk 切出的「視覺一行」：flex nowrap 強制 term 不自動換行；
// 中英切換時換行點由 chunkByMaxWidth 決定，跟容器 flex-wrap 算法解耦
.eqt-search-panel__cells-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
}


// term 視覺：跟 TagBar __btn 同色系（Off 灰、Include 綠、Or 黃、Exclude 紅）。
// 左右鍵切態，沒有 × 移除按鈕——term 本身就是 button，Off 變灰留在原位
.eqt-search-panel__button {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--eqt-row-h);
  padding: 0 8px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 3px;
  background: var(--eqt-bg-btn);
  color: var(--eqt-text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  user-select: none;
  transition: var(--eqt-transition-base);

  &:hover {
    background: var(--eqt-bg-hover);
  }

  &--include {
    background: color-mix(in srgb, var(--eqt-status-include) 55%, transparent);
    border-color: var(--eqt-status-include);

    &:hover {
      background: color-mix(in srgb, var(--eqt-status-include) 70%, transparent);
    }
  }

  &--or {
    background: color-mix(in srgb, var(--eqt-status-or) 55%, transparent);
    border-color: var(--eqt-status-or);

    &:hover {
      background: color-mix(in srgb, var(--eqt-status-or) 70%, transparent);
    }
  }

  &--exclude {
    background: color-mix(in srgb, var(--eqt-status-exclude) 55%, transparent);
    border-color: var(--eqt-status-exclude);

    &:hover {
      background: color-mix(in srgb, var(--eqt-status-exclude) 70%, transparent);
    }
  }

  // 歷史 ghost term：透明度 + hint 灰色傳達「不在搜尋裡，點一下加回」。
  // padding 維持 0 8px（base 已對稱、沒 × 不用偏心）
  &--ghost {
    opacity: 0.55;
    border-color: var(--eqt-border);
    background: transparent;
    color: var(--eqt-text-hint);

    &:hover {
      opacity: 1;
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  // Drag-time 視覺反饋——sortablejs 套這三個 class 期間原 chip / 漂浮 clone
  // 各自的狀態。跟 TagBar __btn--ghost / --chosen / --drag 同套視覺契約
  // （--ghost-drag 命名避開上面歷史 chip 用的 --ghost）
  &--ghost-drag {
    opacity: 0.4;
  }

  &--chosen {
    cursor: grabbing;
  }

  &--drag {
    opacity: 0.8;
  }
}

// TagBar editing 時 chip 變 grab cursor 暗示可拖入。click handler 還在，
// 只是滑鼠提示換成拖拽。grabbing 由 sortablejs 的 --chosen class 觸發
// （= 真正進入 drag 後），不用 :active（mousedown 階段就會誤觸發）
.eqt-search-panel--editing .eqt-search-panel__button {
  cursor: grab;
}

// 工具列：左群組（lang toggle + clear history）／右群組（clear search + search + 新增）
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
