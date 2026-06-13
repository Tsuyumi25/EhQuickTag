<script setup lang="ts">
import { ref, watch, onMounted, computed, inject } from 'vue'
import { loadTagDb, getFallbackEntries, DEFAULT_NS_ORDER, type TagEntry } from '@/services/tagDb'
import { useNhWeight, nsFormat, defaultExactMatch } from '@/services/store'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { parseTerm, serializeEntry } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, buildIdentityIndex, getNextRightClickState, setTagState } from '@/services/tagState'
import { SearchSessionKey } from '@/composables/useSessionTerms'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import SearchTermRows from '@/components/SearchTermRows.vue'
import SearchControls from '@/components/SearchControls.vue'
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
// session 從 inject 拿——App.vue 統一持有 useSessionTerms，這層 toggle 走的
// dismissTerms 跟 SearchPanel 內部 chip toggle 是同個 instance，行為等價
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: []
  close: []
}>()

const session = inject(SearchSessionKey)
if (!session) throw new Error('SearchPopup: SearchSessionKey not provided')
const { sessionTerms, dismissTerms } = session

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)
const selectedIdx = ref(0)
const fallbackEntries = ref<TagEntry[]>([])

// 篩選按鈕：單選 + 可清除。null = 不篩選（預設，顯示全部 namespace 的 nh 熱榜）；
// 點一個 ns = 只看該 ns；點同一個 = 取消回 null
const selectedNs = ref<string | null>(null)

function toggleNs(ns: string): void {
  selectedNs.value = selectedNs.value === ns ? null : ns
}

// 跟其他 popup 同套：onClickOutside + Escape + useScrollLock 一條龍，
// 避免 SearchPopup 開啟時滾輪穿透到背景 EH 列表
usePopupBehavior({ popupEl, onClose: () => emit('close') })

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  useNhWeight: () => useNhWeight.value,
  namespaces: () => selectedNs.value ? [selectedNs.value] : undefined,
  emptyFallback: () => fallbackEntries.value,
})

// suggestions 換新清單時拉回頂端，避免過濾完按 Enter 拿到 undefined / 高亮看不見
watch(suggestions, () => { selectedIdx.value = 0 })

// 篩選按鈕 / useNhWeight 變動：重抓 fallbackEntries（query 結果由 useTagSuggestions
// 內部 watcher 處理）。useNhWeight 必須進這個 watcher，否則設定關閉時 fallback 清單
// 仍會帶 nh 加權順序
watch([selectedNs, useNhWeight], () => {
  if (!dbReady.value) return
  fallbackEntries.value = getFallbackEntries({
    namespaces: selectedNs.value ? [selectedNs.value] : undefined,
    useNhWeight: useNhWeight.value,
  })
})

onMounted(async () => {
  await loadTagDb()
  fallbackEntries.value = getFallbackEntries({ useNhWeight: useNhWeight.value })
  inputEl.value?.focus()
})

// === state map：把 modelValue 解析後給 SuggestionList 上色 ===
// SuggestionList 自己不知道 search syntax，靠 entryStates prop（Map<fullTag, state>）
// 看出哪些 entry 已在 search 內
const identityIndex = computed(() => buildIdentityIndex(tokenize(props.modelValue)))

const entryStates = computed(() => {
  const map = new Map<string, TagState>()
  for (const entry of suggestions.value) {
    const id = tokenIdentity(entry.fullTag)
    if (!id) continue
    const present = identityIndex.value.get(id)
    if (!present) continue
    const prefix = parseTerm(present).prefix
    if (prefix === '-') map.set(entry.fullTag, TagState.Exclude)
    else if (prefix === '~') map.set(entry.fullTag, TagState.Or)
    else map.set(entry.fullTag, TagState.Include)
  }
  return map
})

function entryStateOf(entry: TagEntry): TagState {
  return entryStates.value.get(entry.fullTag) ?? TagState.Off
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
// Off 直接呼 dismissTerms（session inject 來的）→ markEntriesOff + push history +
// emit update。其他態走 update:modelValue + setTagState（in-place 替換、保留位置）
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
    <div ref="popupEl" class="eqt-popup eqt-search-popup" @keydown="onKeydown">
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
          v-for="ns in DEFAULT_NS_ORDER"
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
          :entry-states="entryStates"
          @update:selected-idx="selectedIdx = $event"
          @pick="onPick"
          @ctxmenu="onCtxMenu"
        />
        <div v-else-if="dbReady" class="eqt-search-popup__empty">
          {{ t('tagConfig.noResult') }}
        </div>
        <SearchTermRows
          class="eqt-search-popup__chips"
          :model-value="modelValue"
          :session-terms="sessionTerms"
          :identity-index="identityIndex"
          @update:model-value="emit('update:modelValue', $event)"
          @dismiss-terms="dismissTerms"
        />
        <SearchControls
          class="eqt-search-popup__controls"
          show-lang-toggle
          show-clear-search
          show-search
          @search="emit('search')"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

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
    border-color: var(--eqt-text-secondary);
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
// max-height 防 session 內 term 太多時把 popup 撐爆；overflow auto 內部捲動
.eqt-search-popup__chips {
  flex-shrink: 0;
  max-height: 35vh;
  overflow-y: auto;
  padding: 6px 4px 2px;
  border-top: var(--eqt-border-width) solid var(--eqt-border);
}

// SearchControls 在 chip 區下方，自然高度（不參與 flex 1）
.eqt-search-popup__controls {
  flex-shrink: 0;
}
</style>
