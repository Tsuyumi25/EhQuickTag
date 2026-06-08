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
// sessionTerms：page-scoped term entry 列表，array 順序 = 顯示順序。
//   每個 entry = { positive, active }，active 標記在 A 還是 O：
//     active=true   ⇒ 屬於 A（term 顯示為 stateOf(positive) 推導的 Include/Or/Exclude）
//     active=false  ⇒ 屬於 O（term 固定顯示為 Off 灰色）
//   單一資料源——A 和 O 從 sessionTerms filter 而來，沒有「兩 list 要 sync」的隱性 contract。
//   term 從 A 變 O 只改 entry.active、位置不動 ⇒ 不會跳到 list 尾巴。
//
// 集合投影（derived）：
//   A = ids(sessionTerms.filter(c => c.active))
//   O = ids(sessionTerms.filter(c => !c.active))
//   H = ids(history)
//   T = ids(tokenize(modelValue))
//
// 不變量：
//   I1 (primitive):       A = T            syncFromSearch 獨家 enforce
//   I2 (primitive):       A ∩ H = ∅        syncFromSearch reclaim H 中重回 A 的 id
//   I3 (primitive):       O ⊆ H            applyTermState Off 同 push、clearHistory 保留 O
//   I4 (by-construction): A ∩ O = ∅        entry.active 互斥 ⇒ 結構上不可能違反
//
// 衍生（UI 顯示層）：
//   visibleOff     = O \ buttonIds         O 中已在 button 牆的不重複顯示
//   visibleHistory = H \ O \ buttonIds     重整 O 消失 ⇒ 浮回為 H \ buttonIds
//   button 牆內容可動態變更（settings），故 O/H 資料層保全部、UI 層動態 filter
//
// Enforcer 對照：
//   syncFromSearch  →  I1 + I2（rebuild active 跟 T 對齊、reclaim H 中回到 A 的 id）
//   applyTermState  →  Off 分支 mutate entry.active = false + push H（守 I3）
//   clearHistory    →  H ← H ∩ ids(O)（守 I3）
//
// Dev-mode 守門：assertInvariants() 在 syncFromSearch / clearHistory 末尾各跑一次
//
// 設計關鍵：
//   - Off term 位置保留——entry.active = false 不動 array index、就在原位變灰
//   - Typing morph (j → ja)：舊 'j' entry 移除、新 'ja' entry append，
//     視覺由 v-for unmount + mount 呈現（length 不變看起來像 morph）
//   - History 只在「term 明確按 Off」時 push，原生框造成的 token 消失不污染 history
interface TermEntry { positive: string; active: boolean }
const sessionTerms = ref<TermEntry[]>([])
const history = ref<string[]>([])

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

// Dev-mode invariant checker。生產環境被 bundler 整段 dead-code-elim 掉、零成本。
// I4 (A ∩ O = ∅) 由 entry.active 互斥 by-construction 保證，這裡只 check primitive 三條
function assertInvariants(): void {
  if (!import.meta.env.DEV) return
  const T = new Set(tokenize(props.modelValue).map(tokenIdentity).filter(Boolean) as string[])
  const A = new Set(
    sessionTerms.value.filter(c => c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
  )
  const H = new Set(history.value.map(tokenIdentity).filter(Boolean) as string[])

  if (A.size !== T.size || [...A].some(x => !T.has(x))) {
    console.error('[SearchPanel] I1 broken: A !== T', { A: [...A], T: [...T] })
  }
  const i2Overlap = [...A].filter(x => H.has(x))
  if (i2Overlap.length) {
    console.error('[SearchPanel] I2 broken: A ∩ H ≠ ∅', { overlap: i2Overlap })
  }
  const i3Missing: string[] = []
  for (const c of sessionTerms.value) {
    if (c.active) continue
    const id = tokenIdentity(c.positive)
    if (id && !H.has(id)) i3Missing.push(id)
  }
  if (i3Missing.length) {
    console.error('[SearchPanel] I3 broken: O ⊄ H', { missing: i3Missing })
  }
}

// 對齊 sessionTerms 跟 T：
//   - 既有 active entry 在 T 中 → 留位置、更新 positive（typing morph 自然帶過）
//   - 既有 off entry 在 T 中 → 從 off reclaim 回 active、留位置、更新 positive
//   - 既有 active entry 不在 T 中 → 移除（原生框刪掉這個 token）
//   - 既有 off entry 不在 T 中 → 保留（這正是 Off 意義）
//   - T 中沒對應 entry 的新 id → append 到尾巴（active）
//
// History push 不在這裡——原生框造成的 token 消失（typing 過渡態、backspace、
// select-delete、paste 覆寫）一律不該污染 history，否則打字每個 keystroke 都會
// push 中間態變垃圾。History 唯一觸發點是 applyTermState 的 Off 路徑。
function syncFromSearch(text: string): void {
  const newPositiveById = new Map<string, string>()
  for (const tok of tokenize(text)) {
    const id = tokenIdentity(tok)
    if (!id || newPositiveById.has(id)) continue
    newPositiveById.set(id, serializeTerm({ ...parseTerm(tok), prefix: null }))
  }

  const pendingNew = new Set(newPositiveById.keys())
  const next: TermEntry[] = []
  for (const entry of sessionTerms.value) {
    const id = tokenIdentity(entry.positive)
    if (!id) continue
    if (newPositiveById.has(id)) {
      // entry 對應的 id 還在 T → 保留位置；positive 跟 T 對齊；active=true（off 也 reclaim）
      next.push({ positive: newPositiveById.get(id)!, active: true })
      pendingNew.delete(id)
    } else if (!entry.active) {
      // off entry 不在 T → 保留（user 明確 dismiss、留位置等使用者操作）
      next.push(entry)
    }
    // 否則：active entry 不在 T → 丟（原生框移除）
  }
  // T 中剩下沒對應 entry 的 id → append 新 active entry
  for (const id of pendingNew) {
    next.push({ positive: newPositiveById.get(id)!, active: true })
  }
  sessionTerms.value = next

  // History reclaim：identity 回到 A 就從 H 移除（守 I2）。single pass：
  // O(K+H) 取代每 reclaimed id 跑一次 filter 的 O(K×H)
  const reclaimedIds = new Set(newPositiveById.keys())
  const filteredHistory = history.value.filter(p => {
    const id = tokenIdentity(p)
    return !id || !reclaimedIds.has(id)
  })
  if (filteredHistory.length !== history.value.length) {
    history.value = filteredHistory
    schedulePersist()
  }
  assertInvariants()
}

// 同步初始化要放 setup top-level：watch 只在「未來」變動觸發；不依賴任何
// async 結果，先把 sessionTerms 裝對才安全
syncFromSearch(props.modelValue)

onMounted(async () => {
  // 兩個獨立的 IO 平行跑（loadHistory 讀 GM、loadTagDb 可能拉網路），冷啟動
  // dbReady 翻為 true 從 sum(兩者) 收斂到 max(兩者)
  await Promise.all([loadHistory(), loadTagDb()])
  dbReady.value = true
})

watch(() => props.modelValue, syncFromSearch)

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

// button 牆已涵蓋的 identity 集合——visibleOff 跟 visibleHistory 都用它扣除重複
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

    const cjkEntry = showCJK.value && parsed.namespace
      ? findEntryByNsTag(parsed.namespace, parsed.tag)
      : undefined
    const displayShort = cjkEntry ? prefixStr + cjkEntry.name : prefixStr + parsed.tag
    const displayFull = serializeTerm({ ...parsed, prefix, suffix: null })

    const term: TermInfo = { positive, state, displayShort, displayFull }
    if (!buckets.has(groupKey)) buckets.set(groupKey, [])
    buckets.get(groupKey)!.push(term)
  }

  // 按 sessionTerms 順序 iterate——entry.active 決定 state 來源，位置由 array 自然維護
  // off entry 已在 button 牆的不重複顯示（visibleOff = O \ buttonIds）
  for (const entry of sessionTerms.value) {
    if (entry.active) {
      pushTerm(entry.positive, stateOf(entry.positive))
    } else {
      const id = tokenIdentity(entry.positive)
      if (id && buttonIdentities.value.has(id)) continue
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

// === 按鈕語意：跟 TagBar button 同套 ===
//
// term → Off：history 的唯一 push 點。Vue watch 是 deferred microtask，整個
// sync stack 跑完才觸發 syncFromSearch ⇒ 同步區內 mutation / emit 的先後順序
// 不影響 syncFromSearch 觀察結果（不需要 ordering guards）
function applyTermState(positive: string, next: TagState): void {
  if (next === TagState.Off) {
    const id = tokenIdentity(positive)
    if (id) {
      const entry = sessionTerms.value.find(c => tokenIdentity(c.positive) === id)
      if (entry) entry.active = false
      // history dedup 用 identity 比較：同 identity 的不同 positive 形式
      // (`l:chinese` vs `language:chinese`) 必須視為同條 history entry
      const dupIdx = history.value.findIndex(p => tokenIdentity(p) === id)
      if (dupIdx >= 0) history.value.splice(dupIdx, 1)
      history.value.unshift(positive)
      if (history.value.length > HISTORY_CAP) history.value.length = HISTORY_CAP
      schedulePersist()
    }
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

// sessionTerms 的 identity 集合——抽 computed 後 history 變動不會 rebuild 這個 set
// （只在 sessionTerms 變動時重算），visibleHistory 純走 cached lookup
const sessionIdentitySet = computed(() => {
  const s = new Set<string>()
  for (const entry of sessionTerms.value) {
    const id = tokenIdentity(entry.positive)
    if (id) s.add(id)
  }
  return s
})

// 歷史 row 顯示用：去掉 sessionTerms 內身份（不論 active 或 off）跟 button 牆身份
const visibleHistory = computed(() => {
  return history.value.filter(p => {
    const id = tokenIdentity(p)
    if (!id) return false
    if (sessionIdentitySet.value.has(id)) return false
    if (buttonIdentities.value.has(id)) return false
    return true
  })
})

function onRestoreHistory(positive: string): void {
  // history 存的就是 positive，直接 setTagState Include
  emit('update:modelValue', setTagState(props.modelValue, [positive], TagState.Include))
}

// 只清 H \ O（visible history row 顯示的部分），保留 O 對應的條目。
// 不變量 O ⊆ H 在 clearHistory 後仍成立——「清歷史」語意 = 清掉沒被 O 標記的
// 歷史條目，被使用者明確點 Off 的灰 term 對應的 history 條目留著（重整後 O
// 自然消失、那些條目就會浮上 visible history）。
function clearHistory(): void {
  const offIds = new Set(
    sessionTerms.value.filter(c => !c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
  )
  history.value = history.value.filter(p => {
    const id = tokenIdentity(p)
    return !!id && offIds.has(id)
  })
  schedulePersist()
  assertInvariants()
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

// computed memoize history display——visibleHistory / showCJK 不變就直接拿快取，
// 不在 v-for 內逐項重跑 parseTerm + findEntryByNsTag。
// 跟 da4ae79（identityIndex 從 N 顆按鈕收成 1 張共用 Map）同形式
//
// dbReady 依賴：tagDb 未載入時 findEntryByNsTag 回 undefined → formatHistoryEntry
// fallback 到英文。dbReady 翻 true 後要重算才能切到 CJK 翻譯，不然要使用者點
// 兩次 toggle 才會變中文（第一次切走、第二次切回時 tagDb 已載入）
const historyDisplays = computed(() => {
  void dbReady.value
  return visibleHistory.value.map(positive => ({
    positive,
    display: formatHistoryEntry(positive),
  }))
})
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
