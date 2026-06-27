<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, computed } from 'vue'
import { loadTagDb, getFallbackEntries, DEFAULT_NS_ORDER, type TagEntry } from '@/services/tagDb'
import { nsFormat, defaultExactMatch, dblClickLeft, dblClickRight, type DblClickAction } from '@/services/store'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { parseTerm, serializeEntry } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, buildIdentityIndex, getNextRightClickState, setTagState } from '@/services/tagState'
import { sessionTerms, dismissTerms, recordSubmitAndFlush } from '@/services/search/searchSession'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import SearchTermRows from '@/components/search/SearchTermRows.vue'
import SearchControls from '@/components/search/SearchControls.vue'
import { TagState } from '@/types'

// === 心智模型 ===
//
// SearchPopup 是「深度編輯 search」的全功能 popup——SearchPanel 提供的功能
// 這裡都有，外加候選池跟 namespace 篩選：
//   - 左 sidebar：namespace 篩選按鈕（影響候選池內容）
//   - 中 上：input + SuggestionList（候選池，每 item 上色顯示當前 search state）
//   - 中 中：SearchTermRows（當前 search chip）
//   - 中 下：SearchControls（lang toggle / clear search / submit）
//
// 這層 toggle 走的 dismissTerms 跟 SearchPanel 內部 chip toggle 是同個 ref，
// 行為等價（共用 services/searchSession 的 state）。
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  // 帶 action payload：背景雙擊路徑要區分 search / searchNewTab，App.onSearch
  // 才能走對 branch。SearchControls submit 永遠送 'search'
  search: [action: DblClickAction]
  close: []
}>()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)
const selectedIdx = ref(0)
// shallowRef：跟 useTagSuggestions.suggestions 同理，永遠整批 reassign
const fallbackEntries = shallowRef<TagEntry[]>([])

// 篩選按鈕：單選 + 可清除。null = 不篩選（預設，顯示全部 namespace 的 nh 熱榜）；
// 點一個 ns = 只看該 ns；點同一個 = 取消回 null
const selectedNs = ref<string | null>(null)

function toggleNs(ns: string): void {
  selectedNs.value = selectedNs.value === ns ? null : ns
}

// 包成 computed 給 SuggestionList 用的 nsList prop——避免 template 內每次 render
// 都建一個新的 [selectedNs] 陣列字面量、讓 SuggestionList 的 nsColWidth 在每次
// 父 re-render（譬如 selectedIdx / query 變動）都因為 prop reference 不同而 dirty
const popupNsList = computed(() => selectedNs.value ? [selectedNs.value] : undefined)

const SEARCH_NS_LIST = DEFAULT_NS_ORDER.filter(ns => ns !== 'temp')

// 跟其他 popup 同套：onClickOutside + Escape + useScrollLock 一條龍，
// 避免 SearchPopup 開啟時滾輪穿透到背景 EH 列表
usePopupBehavior({ popupEl, onClose: () => emit('close') })

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  namespaces: () => selectedNs.value ? [selectedNs.value] : undefined,
  emptyFallback: () => fallbackEntries.value,
})

// suggestions 換新清單時拉回頂端，避免過濾完按 Enter 拿到 undefined / 高亮看不見
watch(suggestions, () => { selectedIdx.value = 0 })

// 篩選按鈕變動：重抓 fallbackEntries（query 結果由 useTagSuggestions 內部 watcher 處理）
watch(selectedNs, () => {
  if (!dbReady.value) return
  fallbackEntries.value = getFallbackEntries({
    namespaces: selectedNs.value ? [selectedNs.value] : undefined,
  })
})

onMounted(async () => {
  await loadTagDb()
  fallbackEntries.value = getFallbackEntries()
  inputEl.value?.focus()
})

// === state lookup：把 modelValue 解析後給 SuggestionList 上色 ===
// SuggestionList 自己不知道 search syntax，靠 stateOf function prop 查狀態。
//
// 為什麼是 function 而不是預算好的 Map：popup 開啟時 suggestions 可能上千筆，
// 但只有 SuggestionList 虛擬滾動可見的 ~20 個 item 需要 state。預先全量算 Map
// 是 popup 開啟時 long task 的主要結構性 cost（O(N) computed iterate 全部
// suggestions），改成 function 後只對 visible items call ~20 次
const identityIndex = computed(() => buildIdentityIndex(tokenize(props.modelValue)))

function entryStateOf(entry: TagEntry): TagState {
  const id = tokenIdentity(entry.fullTag)
  if (!id) return TagState.Off
  const present = identityIndex.value.get(id)
  if (!present) return TagState.Off
  const prefix = parseTerm(present).prefix
  if (prefix === '-') return TagState.Exclude
  if (prefix === '~') return TagState.Or
  return TagState.Include
}

// 把 entry 序列化成 e站合法 search token——細節（quoting / nsFormat / exactMatch）
// 集中在 serializeEntry 內，跟 useSearchTerm.applySuggestionPick 走同一條路徑。
// entry.fullTag 是裸 `ns:raw` 不夠用：含空格的 raw 餵 setTagState 會被空格切開
// 成兩個 token、進 misc row（symptom：search panel 看到孤兒 chip）
function tokenForEntry(entry: TagEntry): string {
  return serializeEntry(entry, {
    nsFormat: nsFormat.value,
    exactMatch: defaultExactMatch.value,
  })
}

// === toggle 路徑：跟 SearchTermRows / TagBar 同邏輯 ===
// Off 直接呼 dismissTerms → markEntriesOff + push history + emit update。
// 其他態走 update:modelValue + setTagState（in-place 替換、保留位置）
function applyEntryState(entry: TagEntry, next: TagState): void {
  const token = tokenForEntry(entry)
  if (next === TagState.Off) {
    dismissTerms([token])
  } else {
    emit('update:modelValue', setTagState(props.modelValue, [token], next))
  }
}

function onPick(entry: TagEntry): void {
  // 跟 SearchTermRows.onTermClick 同邏輯：Include → Off，其他態 → Include
  const cur = entryStateOf(entry)
  const next = cur === TagState.Include ? TagState.Off : TagState.Include
  applyEntryState(entry, next)
}

function onCtxMenu(entry: TagEntry): void {
  const cur = entryStateOf(entry)
  const next = getNextRightClickState([entry.fullTag], undefined, cur)
  if (next === null) return
  applyEntryState(entry, next)
}

// === 背景雙擊 action ===
// 白名單只走 search / searchNewTab / clearSearch；toggleEdit / openSearchPopup
// 在 SearchPopup 內無語意（沒有 editing 態、已開啟），none 不動。
//
// 「背景」= popup 內非互動區域。用 closest(INTERACTIVE_SELECTOR) 過濾——
// 用 @dblclick.self 太嚴格（popup 子節點幾乎填滿視覺空間，使用者感知的
// 「背景」其實大多落在 SuggestionList wrapper 等子元素上）。
//
// dblclick 預設會選下層文字，即使 action 不執行也要 preventDefault 殺掉，
// 否則背景雙擊冒出劃詞選單。contextmenu 同理對稱處理
const BG_DBL_ALLOWED: ReadonlySet<DblClickAction> = new Set<DblClickAction>([
  'search', 'searchNewTab', 'clearSearch',
])

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, [contenteditable], .eqt-popup__suggestion, .eqt-search-panel__button'

function isInteractive(e: MouseEvent): boolean {
  return !!(e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)
}

// async 因為 search / searchNewTab 路徑要先 await recordSubmitAndFlush——
// 跟 TagBar.execDblClickAction / SearchControls.onSearchClick 同邏輯，避免
// form.submit() navigate 跑在 GM_setValue 100ms debounce 寫入前面
async function execBgDblClick(action: DblClickAction): Promise<void> {
  if (!BG_DBL_ALLOWED.has(action)) return
  if (action === 'clearSearch') {
    emit('update:modelValue', '')
  } else {
    await recordSubmitAndFlush()
    emit('search', action)
  }
}

function onBgDblClick(e: MouseEvent): void {
  if (isInteractive(e)) return
  e.preventDefault()
  window.getSelection()?.removeAllRanges()
  execBgDblClick(dblClickLeft.value)
}

let lastRightClickTime = 0
function onBgContextMenu(e: MouseEvent): void {
  if (isInteractive(e)) return
  // preventDefault 先呼叫——whitelist 失敗也要擋原生 context menu，跟
  // onBgDblClick 永遠 preventDefault 對稱（action='none' 等也不冒選單）
  e.preventDefault()
  const action = dblClickRight.value
  if (!BG_DBL_ALLOWED.has(action)) return
  const now = Date.now()
  if (now - lastRightClickTime < 500) {
    execBgDblClick(action)
    lastRightClickTime = 0
  } else {
    lastRightClickTime = now
  }
}

// Escape 走 usePopupBehavior 統一處理；這裡只 handle 清單導覽 + Enter 沿用左鍵語意
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const entry = suggestions.value[selectedIdx.value]
    if (entry) onPick(entry)
  }
}
</script>

<template>
  <div class="eqt-popup-overlay">
    <div
      ref="popupEl"
      class="eqt-popup eqt-search-popup"
      @keydown="onKeydown"
      @dblclick="onBgDblClick"
      @contextmenu="onBgContextMenu"
    >
      <aside
        class="eqt-search-popup__ns-filter"
        role="group"
        :aria-label="t('nsFilter.label')"
      >
        <button
          type="button"
          class="eqt-search-popup__ns-btn"
          :class="{ 'is-active': selectedNs === null }"
          @click="selectedNs = null"
        >
          {{ t('nsFilter.all') }}
        </button>
        <button
          v-for="ns in SEARCH_NS_LIST"
          :key="ns"
          type="button"
          class="eqt-search-popup__ns-btn"
          :class="{ 'is-active': selectedNs === ns }"
          :title="t('ns.' + ns)"
          @click="toggleNs(ns)"
        >
          {{ t('ns.' + ns) }}
        </button>
        <button
          class="eqt-popup__btn eqt-search-popup__close-btn"
          type="button"
          @click="emit('close')"
        >
          {{ t('settings.close') }}
        </button>
      </aside>
      <div class="eqt-search-popup__main">
        <input
          ref="inputEl"
          v-model="query"
          class="eqt-popup__input eqt-search-popup__input"
          type="text"
          :placeholder="t('tagConfig.searchPlaceholder')"
          autocomplete="off"
          spellcheck="false"
        />
        <SuggestionList
          v-if="suggestions.length"
          class="eqt-search-popup__list"
          :suggestions="suggestions"
          :selected-idx="selectedIdx"
          :state-of="entryStateOf"
          :ns-list="popupNsList"
          @update:selected-idx="selectedIdx = $event"
          @pick="onPick"
          @ctxmenu="onCtxMenu"
        />
        <div v-else-if="dbReady" class="eqt-search-popup__empty">
          {{ t('tagConfig.noResult') }}
        </div>
        <div class="eqt-search-popup__chips-scroll">
          <SearchTermRows
            class="eqt-search-popup__chips"
            :model-value="modelValue"
            :session-terms="sessionTerms"
            :identity-index="identityIndex"
            @update:model-value="emit('update:modelValue', $event)"
            @dismiss-terms="dismissTerms"
          />
        </div>
        <SearchControls
          class="eqt-search-popup__controls"
          show-lang-toggle
          show-clear-search
          show-search
          @search="emit('search', 'search')"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

// fzf 風 popup：左側 namespace 篩選 sidebar，右側 input + 候選池 + 當前搜尋 chip 區
.eqt-search-popup {
  // 整個 popup 等比例放大——zoom 比 transform: scale 乾淨，會影響 layout 計算所以
  // overlay 置中跟 click 位置不會錯位
  zoom: 1.15;
  display: flex;
  flex-direction: row;
  width: clamp(30rem, 60vw, 52rem);
  min-height: auto;
  max-height: 80vh;
  padding: 10px;
  gap: 10px;
  overflow: hidden;
}

// 左側 sidebar：單列直排，按鈕寬度跟著最寬 namespace label 走，main 區得到更多空間
.eqt-search-popup__ns-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  overflow-y: auto;
}

// 關閉鍵：margin-top auto 推到底，跟 namespace 按鈕中間留空
.eqt-search-popup__close-btn {
  margin-top: auto;
  flex-shrink: 0;
}

.eqt-search-popup__ns-btn {
  @include btn-toned;
  padding: 2px 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  // 選中態：用 bg-active + 加深 border 區分，跟整體統一的中性風格一致
  &.is-active {
    background: var(--eqt-bg-active);
    border-color: var(--eqt-text);
  }
}

// 右側主區：input → SuggestionList → SearchTermRows 垂直排
//
// 高度分配：input 跟 SearchTermRows 自然高度，SuggestionList 用 flex: 1 撐滿
// 剩餘空間（候選池才是視覺主角）。chip 區自然高度避免擠壓候選池
.eqt-search-popup__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.eqt-search-popup__input {
  flex-shrink: 0;
}

// SuggestionList 額外給的 flex 撐滿規則——SuggestionList 自帶 background / border /
// overflow-y / text-align，這裡只補「在 flex column 裡撐滿剩餘空間」的部分
.eqt-search-popup__list {
  flex: 1;
  min-height: 0;
}

.eqt-search-popup__empty {
  padding: 12px;
  color: var(--eqt-text-hint);
  font-size: var(--eqt-fs-md);
  text-align: center;
}

// 當前 search chip 區：在候選池下方，自然高度（不擠壓上方候選池）。
// 外 wrap 負責 scroll、內 chips 只當 grid container——兩者拆開避免 flex item
// 預設 min-height: auto 讓 max-height 失效造成內部 row 重疊（無 scrollbar）
.eqt-search-popup__chips-scroll {
  flex-shrink: 0;
  min-height: 0;
  max-height: 35vh;
  overflow-y: auto;
  border-top: var(--eqt-border-width) solid var(--eqt-border);
}

.eqt-search-popup__chips {
  padding: 6px 4px 2px;
}

// SearchControls 在 chip 區下方，自然高度（不參與 flex 1）
.eqt-search-popup__controls {
  flex-shrink: 0;
}
</style>
