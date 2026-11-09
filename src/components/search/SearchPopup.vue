<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, computed } from 'vue'
import { loadTagDb, getFallbackEntries, type TagEntry } from '@/services/tags/tagDb'
import { nsFormat, defaultExactMatch, dblClickLeft, dblClickRight, dblClickLeftNewTabActive, dblClickRightNewTabActive, type DblClickAction } from '@/services/store'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { parseTerm, serializeEntry } from '@/services/search/searchSyntax'
import { tokenize, tokenIdentity, buildIdentityIndex, nextTagState } from '@/services/search/tagState'
import type { Selection } from '@/services/tagPick'
import { sessionTerms, dismissTerms, recordSubmitAndFlush, setTermsState } from '@/services/search/searchSession'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import SearchTermRows from '@/components/search/SearchTermRows.vue'
import SearchControls from '@/components/search/SearchControls.vue'
import TagIntroPanel from '@/components/TagIntroPanel.vue'
import { createIntroPanel } from '@/composables/useIntroPanel'
import { TagState } from '@/types'

// === 心智模型 ===
//
// SearchPopup 是「深度編輯 search」的全功能 popup——SearchPanel 提供的功能
// 這裡都有，外加候選池、namespace 篩選與標籤說明。由左到右跟圖庫頁的 tagging 同一個排法：
//   - namespace 篩選按鈕（影響候選池內容）
//   - input + SuggestionList（候選池，每 item 上色顯示當前 search state）
//   - SearchTermRows（當前 search chip）+ SearchControls（lang toggle / clear search / submit）
//   - 標籤說明：最後一個按下或刷過的標籤
//
// 這層 toggle 走的 dismissTerms 跟 SearchPanel 內部 chip toggle 是同個 ref，
// 行為等價（共用 services/searchSession 的 state）。
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  // 帶 action payload：背景雙擊路徑要區分 search / searchNewTab，搜尋送出端
  // 才能走對 branch。SearchControls submit 永遠送 'search'。
  // newTabActive 只在 searchNewTab 有意義：帶觸發側的「切換過去」開關
  search: [action: DblClickAction, newTabActive?: boolean]
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


// 包成 computed 給 SuggestionList 用的 nsList prop——避免 template 內每次 render
// 都建一個新的 [selectedNs] 陣列字面量、讓 SuggestionList 的 nsColWidth 在每次
// 父 re-render（譬如 selectedIdx / query 變動）都因為 prop reference 不同而 dirty
const popupNsList = computed(() => selectedNs.value ? [selectedNs.value] : undefined)


// 跟其他 popup 同套：onClickOutside + Escape + useScrollLock 一條龍，
// 避免 SearchPopup 開啟時滾輪穿透到背景 EH 列表
usePopupBehavior({ popupEl, onClose: () => emit('close') })

// 自己一份說明面板狀態：在圖庫頁打開時，跟頁面 #gd5 那份互不干擾
const intro = createIntroPanel()
const { openTag: introTag } = intro

function inspectEntry(entry: TagEntry): void {
  intro.setPanelTag({ ns: entry.ns, raw: entry.raw, nsRaw: entry.fullTag })
}

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
// 其他態走 setTermsState（in-place 替換、保留位置）；筆刷一個事件裡會連改好幾筆，不能拿 prop 算
function applyEntryState(entry: TagEntry, next: TagState): void {
  const token = tokenForEntry(entry)
  if (next === TagState.Off) dismissTerms([token])
  else setTermsState([token], next)
}

// 跟 SearchTermRows.pressTerm 同一套按法
function pressEntry(entry: TagEntry, key: Selection): void {
  const cur = entryStateOf(entry)
  const next = nextTagState([entry.fullTag], cur, key)
  if (next !== cur) applyEntryState(entry, next)
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
  'button, a, input, select, textarea, [contenteditable], .eqt-popup__suggestion, .eqt-search-panel__button, .eqt-intro-panel'

function isInteractive(e: MouseEvent): boolean {
  return !!(e.target as HTMLElement).closest(INTERACTIVE_SELECTOR)
}

// async 因為 search / searchNewTab 路徑要先 await recordSubmitAndFlush——
// 跟 TagBar.execDblClickAction / SearchControls.onSearchClick 同邏輯，避免
// form.submit() navigate 跑在 GM_setValue 100ms debounce 寫入前面
async function execBgDblClick(action: DblClickAction, newTabActive?: boolean): Promise<void> {
  if (!BG_DBL_ALLOWED.has(action)) return
  if (action === 'clearSearch') {
    emit('update:modelValue', '')
  } else {
    await recordSubmitAndFlush()
    // 同 TagBar：旗標只跟 searchNewTab 走，其他 action 不帶
    emit('search', action, action === 'searchNewTab' ? newTabActive : undefined)
  }
}

function onBgDblClick(e: MouseEvent): void {
  if (isInteractive(e)) return
  e.preventDefault()
  window.getSelection()?.removeAllRanges()
  execBgDblClick(dblClickLeft.value, dblClickLeftNewTabActive.value)
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
    execBgDblClick(action, dblClickRightNewTabActive.value)
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
    if (!entry) return
    pressEntry(entry, 'positive')
    inspectEntry(entry)
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
      <div class="eqt-search-popup__rail">
        <NamespaceFilter v-model="selectedNs" />
        <button
          class="eqt-popup__btn eqt-search-popup__close-btn"
          type="button"
          @click="emit('close')"
        >
          {{ t('settings.close') }}
        </button>
      </div>
      <div class="eqt-search-popup__finder">
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
          @select="pressEntry"
          @inspect="inspectEntry"
        />
        <div v-else-if="dbReady" class="eqt-search-popup__empty">
          {{ t('tagConfig.noResult') }}
        </div>
      </div>
      <div class="eqt-search-popup__terms">
        <div class="eqt-search-popup__chips-scroll">
          <SearchTermRows
            class="eqt-search-popup__chips"
            :model-value="modelValue"
            :session-terms="sessionTerms"
            :identity-index="identityIndex"
            @inspect="intro.setPanelTag"
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
      <div class="eqt-search-popup__intro">
        <TagIntroPanel :panel="intro" />
        <p v-if="!introTag" class="eqt-search-popup__intro-hint">{{ t('intro.pickHint') }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

// 由左到右：namespace 篩選 | 輸入框 + 候選池 | 當前搜尋 chip + 按鈕 | 標籤說明
// 尺寸要壓過 popup.scss 的 .eqt-popup：同權重時它排在後面，寬高會被它蓋掉
.eqt-popup.eqt-search-popup {
  // 整個 popup 等比例放大——zoom 比 transform: scale 乾淨，會影響 layout 計算所以
  // overlay 置中跟 click 位置不會錯位
  zoom: 1.15;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr);
  width: clamp(48rem, 80vw, 100rem);
  height: 80vh;
  min-height: 0;
  max-height: none;
  padding: 10px;
  gap: 10px;
  overflow: hidden;
}

.eqt-search-popup__rail {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

// 關閉鍵：margin-top auto 推到底，跟 namespace 按鈕中間留空
.eqt-search-popup__close-btn {
  margin-top: auto;
  flex-shrink: 0;
}

// 每一欄都是撐滿高度的 flex column；捲動交給欄裡那個主要區塊
.eqt-search-popup__finder,
.eqt-search-popup__terms,
.eqt-search-popup__intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
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

// 外 wrap 負責 scroll、內 chips 只當 grid container——兩者拆開避免 flex item
// 預設 min-height: auto 讓高度限制失效造成內部 row 重疊（無 scrollbar）
.eqt-search-popup__chips-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-sm);
}

.eqt-search-popup__chips {
  padding: 6px 4px 2px;
}

.eqt-search-popup__controls {
  flex-shrink: 0;
}

.eqt-search-popup__intro {
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-sm);
  overflow: hidden;

  > .eqt-intro-panel {
    flex: 1;
    min-height: 0;
  }
}

.eqt-search-popup__intro-hint {
  margin: auto;
  padding: 12px;
  color: var(--eqt-text-hint);
  font-size: var(--eqt-fs-md);
  text-align: center;
}
</style>
