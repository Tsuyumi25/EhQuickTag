<script setup lang="ts">
import { computed, ref, watch, onMounted, onScopeDispose } from 'vue'
import { parseTerm, serializeTerm, type Prefix } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, setTagState, removeTag, buildIdentityIndex, getNextRightClickState } from '@/services/tagState'
import { nsOrder, lines } from '@/services/store'
import { loadTagDb, findEntryByNsTag } from '@/services/tagDb'
import { cacheGet, cacheSet } from '@/services/gmStorage'
import { t, isCJKLocale } from '@/composables/useI18n'
import { TagState } from '@/types'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  addToSearch: []
}>()

// TermGroup.key 是 string | null（null = 「無 namespace」/ misc 列）。typed null
// 比字串 sentinel 強：TS 強制每個 consumer 明確 handle null 分支，未來不會被
// 「e站新增名為 __misc__ 的 namespace」這種 collision 偷襲
const MISC_KEY = null
const HISTORY_KEY = 'eqt-search-history'
const HISTORY_CAP = 50
const PERSIST_DEBOUNCE_MS = 100

// term 顯示語言：預設跟 locale 走，可在 controls-row 用 toggle 按鈕 override（page-scoped）
const showCJK = ref(isCJKLocale())
function toggleLang(): void { showCJK.value = !showCJK.value }

// tagDb 載入完通知 groups computed 重算（term 從 raw 翻成 entry.name）
const dbReady = ref(false)

// === 進階搜索的核心資料模型 ===
//
// sessionTerms：page-scoped 的 term 身份清單，每個元素是 canonical positive form
// （撥掉 - / ~ 後的形式）。新身份 append 到尾巴；state 切換不動位置；Off term 留在
// list 裡顯示成灰色（跟 TagBar 的 button 同型）。 重整就清空、Off 的會落到 history。
//
// history：跨頁 GM 持久化的歷史。term 變成 Off 的瞬間把 positive 推進去，重整後
// 該身份在新 sessionTerms 裡不存在 → 顯示在歷史 row。
const sessionTerms = ref<string[]>([])
const history = ref<string[]>([])

let prevIds = new Set<string>()

async function loadHistory(): Promise<void> {
  const raw = await cacheGet(HISTORY_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) history.value = parsed.filter(x => typeof x === 'string')
  } catch { /* corrupted blob → 從空 */ }
}

// debounce 寫入 GM：連續觸發只送最後一筆，且 payload 在 flush 那刻才 stringify
// 確保寫入的是 latest snapshot 而非觸發時的 snapshot。避免快速操作導致多筆 in-flight
// 寫入順序顛倒覆蓋成舊資料
let persistTimer = 0
function schedulePersist(): void {
  clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    persistTimer = 0
    cacheSet(HISTORY_KEY, JSON.stringify(history.value))
  }, PERSIST_DEBOUNCE_MS)
}
onScopeDispose(() => {
  // unmount 前還有未 flush 的變更就 fire-and-forget 一發
  if (persistTimer) {
    clearTimeout(persistTimer)
    cacheSet(HISTORY_KEY, JSON.stringify(history.value))
  }
})

// 把 searchText 裡新出現的身份 append 進 sessionTerms（既有身份不動位置）。
// tokenIdentity 對 parseError token 已經回 null，下方 !id 守門已涵蓋 — 不另外加
// parseError check（雙重 guard 反而隱藏 contract 漂移）
function syncSessionFromSearch(text: string): void {
  const seen = new Set(sessionTerms.value.map(p => tokenIdentity(p)).filter(Boolean) as string[])
  for (const tok of tokenize(text)) {
    const id = tokenIdentity(tok)
    if (!id || seen.has(id)) continue
    const positive = serializeTerm({ ...parseTerm(tok), prefix: null })
    sessionTerms.value.push(positive)
    seen.add(id)
  }
}

// 同步初始化要放 setup top-level：watch 已掛上但只在「未來」變動時觸發，
// onMounted 內的 await 是危險時段——modelValue 在那期間若變動，watch 會用
// 沒裝好的 prevIds 做 diff、把對應 history 條目誤殺。這兩行同步不依賴任何
// async 結果，先把 prevIds 裝對才安全
syncSessionFromSearch(props.modelValue)
prevIds = new Set(tokenize(props.modelValue).map(tokenIdentity).filter(Boolean) as string[])

onMounted(async () => {
  // 兩個獨立的 IO 平行跑（loadHistory 讀 GM、loadTagDb 可能拉網路），冷啟動
  // dbReady 翻為 true 從 sum(兩者) 收斂到 max(兩者)
  await Promise.all([loadHistory(), loadTagDb()])
  dbReady.value = true
})

// searchText 任何變動 → 同步 sessionTerms（新身份）+ 維護 history
watch(() => props.modelValue, (val) => {
  const currIds = new Set(tokenize(val).map(tokenIdentity).filter(Boolean) as string[])
  let historyChanged = false

  // 身份從 active 變 Off → push 對應 positive 進 history（最近的在最前）
  for (const id of prevIds) {
    if (!currIds.has(id)) {
      const positive = sessionTerms.value.find(p => tokenIdentity(p) === id)
      if (!positive) continue
      const idx = history.value.indexOf(positive)
      if (idx >= 0) history.value.splice(idx, 1)
      history.value.unshift(positive)
      if (history.value.length > HISTORY_CAP) history.value.length = HISTORY_CAP
      historyChanged = true
    }
  }
  // 身份從 Off 變 active → 從 history 清掉（避免歷史 row 跟 active term 重複出現）
  for (const id of currIds) {
    if (!prevIds.has(id)) {
      const before = history.value.length
      history.value = history.value.filter(p => tokenIdentity(p) !== id)
      if (history.value.length !== before) historyChanged = true
    }
  }

  syncSessionFromSearch(val)
  prevIds = currIds

  if (historyChanged) schedulePersist()
})

// === term 顯示用：state、group、display 全部從 sessionTerms + identityIndex 推導 ===

const identityIndex = computed(() => buildIdentityIndex(tokenize(props.modelValue)))

interface TermInfo {
  positive: string
  state: TagState
  displayShort: string  // namespace row 用：無 namespace prefix、$ 拿掉、CJK 翻譯
  displayFull: string   // misc row 用：保留 qualifier / namespace
}

interface TermGroup {
  key: string | null    // namespace name；null = misc/無 namespace 列
  label: string
  terms: TermInfo[]
}

const STATE_CLASS: Record<TagState, string | null> = {
  [TagState.Include]: 'eqt-search-panel__button--include',
  [TagState.Or]:      'eqt-search-panel__button--or',
  [TagState.Exclude]: 'eqt-search-panel__button--exclude',
  [TagState.Off]:     null,
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

const groups = computed<TermGroup[]>(() => {
  void dbReady.value

  const buckets = new Map<string | null, TermInfo[]>()

  for (const positive of sessionTerms.value) {
    const parsed = parseTerm(positive)
    const state = stateOf(positive)

    const groupKey: string | null = parsed.namespace ?? MISC_KEY
    const prefix = STATE_PREFIX[state]
    const prefixStr = prefix ?? ''

    const cjkEntry = showCJK.value && parsed.namespace
      ? findEntryByNsTag(parsed.namespace, parsed.tag)
      : undefined
    const displayShort = cjkEntry ? prefixStr + cjkEntry.name : prefixStr + parsed.tag
    const displayFull = serializeTerm({ ...parsed, prefix, suffix: null })

    const term: TermInfo = { positive, state, displayShort, displayFull }
    if (!buckets.has(groupKey)) buckets.set(groupKey, [])
    buckets.get(groupKey)!.push(term)
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

// === 按鈕語意：跟 TagBar button 同套 ===
function applyTermState(positive: string, next: TagState): void {
  if (next === TagState.Off) {
    emit('update:modelValue', removeTag(props.modelValue, [positive]))
  } else {
    emit('update:modelValue', setTagState(props.modelValue, [positive], next))
  }
}

function onTermClick(term: TermInfo): void {
  // 跟 TagBar.onLeftClick 同邏輯：Include → Off，其他態 → Include
  const next = term.state === TagState.Include ? TagState.Off : TagState.Include
  applyTermState(term.positive, next)
}

function onTermContextMenu(e: MouseEvent, term: TermInfo): void {
  e.preventDefault()
  const next = getNextRightClickState([term.positive], undefined, term.state)
  if (next === null) return
  applyTermState(term.positive, next)
}

function onAddClick(): void { emit('addToSearch') }

// === TagBar 已涵蓋身份不重複顯示在 history ===
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

// 歷史 row 顯示用：去掉「已是 sessionTerms 內身份」「已是 button 牆身份」
const visibleHistory = computed(() => {
  const sessionSet = new Set(sessionTerms.value.map(p => tokenIdentity(p)).filter(Boolean) as string[])
  return history.value.filter(p => {
    const id = tokenIdentity(p)
    if (!id) return false
    if (sessionSet.has(id)) return false
    if (buttonIdentities.value.has(id)) return false
    return true
  })
})

function onRestoreHistory(positive: string): void {
  // history 存的就是 positive，直接 setTagState Include
  emit('update:modelValue', setTagState(props.modelValue, [positive], TagState.Include))
}

function clearHistory(): void {
  history.value = []
  schedulePersist()
}

function formatHistoryEntry(positive: string): string {
  const parsed = parseTerm(positive)
  if (parsed.parseError) return positive
  if (!parsed.namespace) return serializeTerm({ ...parsed, suffix: null })
  if (showCJK.value) {
    const cjkEntry = findEntryByNsTag(parsed.namespace, parsed.tag)
    if (cjkEntry) return `${t(`ns.${parsed.namespace}`)}:${cjkEntry.name}`
  }
  return serializeTerm({ ...parsed, suffix: null })
}

// computed 把整批 history display 結果 memoize 起來——visibleHistory / showCJK 不變
// 就直接拿快取，不在 v-for 內逐項重跑 parseTerm + findEntryByNsTag。
// 跟 da4ae79（identityIndex 從 N 顆按鈕收成 1 張共用 Map）同形式
const historyDisplays = computed(() =>
  visibleHistory.value.map(positive => ({
    positive,
    display: formatHistoryEntry(positive),
  })),
)
</script>

<template>
  <div class="eqt-search-panel">
    <div
      v-for="group in groups"
      :key="group.key ?? '__misc__'"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ group.label }}:</div>
      <div class="eqt-search-panel__cells">
        <button
          v-for="term in group.terms"
          :key="term.positive"
          class="eqt-search-panel__button"
          :class="STATE_CLASS[term.state]"
          type="button"
          @click="onTermClick(term)"
          @contextmenu="onTermContextMenu($event, term)"
        >{{ group.key === MISC_KEY ? term.displayFull : term.displayShort }}</button>
      </div>
    </div>

    <div
      v-if="historyDisplays.length"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ t('tagbar.history') }}:</div>
      <div class="eqt-search-panel__cells">
        <button
          v-for="(entry, idx) in historyDisplays"
          :key="`hist-${idx}-${entry.positive}`"
          class="eqt-search-panel__button eqt-search-panel__button--ghost"
          type="button"
          @click="onRestoreHistory(entry.positive)"
        >{{ entry.display }}</button>
        <button
          class="eqt-search-panel__button eqt-search-panel__button--ghost"
          type="button"
          @click="clearHistory"
        >{{ t('tagbar.clearHistory') }}</button>
      </div>
    </div>

    <div class="eqt-search-panel__controls-row">
      <button
        class="eqt-search-panel__lang-toggle"
        type="button"
        :title="t('tagbar.toggleLang')"
        @click="toggleLang"
      ><span :class="{ 'eqt-search-panel__lang-hidden': !showCJK }">中</span><span :class="{ 'eqt-search-panel__lang-hidden': showCJK }">EN</span></button>
      <button
        class="eqt-search-panel__add"
        type="button"
        title="新增"
        @click="onAddClick"
      >+</button>
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
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: var(--eqt-row-h);
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
}

// 工具列：左 lang toggle、右 + 新增入口
.eqt-search-panel__controls-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eqt-search-panel__lang-toggle {
  display: inline-grid;
  align-items: center;
  justify-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 11px;
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

.eqt-search-panel__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: var(--eqt-transition-base);

  &:hover {
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}
</style>
