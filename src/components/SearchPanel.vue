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
// 三個集合（用 identity 投影看）：
//   A = ids(activeChips)  — tokens(modelValue) 的鏡像，page-scoped
//   O = ids(offChips)     — 使用者點 term 變 Off 的殘留，page-scoped
//   H = ids(history)      — Off 過的歷史軌跡，cross-page GM 持久化
//   T = ids(tokenize(modelValue))  — modelValue tokenize 後的 identity 集合
//
// 不變量：
//   I1 (primitive):  A = T          activeChips 由 syncFromSearch 獨家 mutate、嚴格等於 T
//   I2 (primitive):  A ∩ H = ∅      active 跟 history 互斥
//   I3 (primitive):  O ⊆ H          off 是 history 的子集
//   I4 (derived):    A ∩ O = ∅      由 I2 + I3 推出
//
// 衍生（UI 顯示層、非資料層強制）：
//   visibleOff     = O \ buttonIds        （O 中已在 button 牆的不重複顯示）
//   visibleHistory = H \ O \ buttonIds    （重整 O 消失 ⇒ 浮回為 H \ buttonIds）
//   設計理由：button 牆內容可由 settings 動態變更，O/H 資料層保留全部 identity，
//   由 UI 層動態 filter 才能跟上 button 牆變化。
//
// Enforcer 對照：
//   syncFromSearch  →  I1 (rebuild A=T)、I2 (reclaim H)、I3 (evict O 跟 reclaim H 同步)
//   applyTermState  →  Off 分支同時 push O 和 H、且不重複（守 I3）
//   clearHistory    →  H ← H ∩ ids(O)（守 I3）
//
// Dev-mode 守門：assertInvariants() 在 syncFromSearch / clearHistory 末尾各跑一次，
//   抓 enforcer regression 跟註釋 rot——bug 在「破壞那一刻」當場炸而非症狀後 debug
//
// 設計關鍵：
//   - 不維護「跨變動穩定」entity——typing morph 由「token 數不變、位置不變」自然呈現
//   - History 只在「使用者明確按 Off」時 push，原生框造成的 token 消失不污染 history
const activeChips = ref<string[]>([])
const offChips = ref<string[]>([])
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
function assertInvariants(): void {
  if (!import.meta.env.DEV) return
  const T = new Set(tokenize(props.modelValue).map(tokenIdentity).filter(Boolean) as string[])
  const A = new Set(activeChips.value.map(tokenIdentity).filter(Boolean) as string[])
  const O = new Set(offChips.value.map(tokenIdentity).filter(Boolean) as string[])
  const H = new Set(history.value.map(tokenIdentity).filter(Boolean) as string[])

  if (A.size !== T.size || [...A].some(x => !T.has(x))) {
    console.error('[SearchChips] I1 broken: A !== T', { A: [...A], T: [...T] })
  }
  const i2Overlap = [...A].filter(x => H.has(x))
  if (i2Overlap.length) {
    console.error('[SearchChips] I2 broken: A ∩ H ≠ ∅', { overlap: i2Overlap })
  }
  const i3Missing = [...O].filter(x => !H.has(x))
  if (i3Missing.length) {
    console.error('[SearchChips] I3 broken: O ⊄ H', { missing: i3Missing })
  }
}

// Rebuild activeChips 從 tokens；evict offChips 中已重回 tokens 的 identity；
// identity 重回 tokens → 從 history 移除。
//
// History push 不在這裡——原生框造成的 token 消失（typing 過渡態、backspace、
// select-delete、paste 覆寫）一律不該污染 history，否則打字過程每個 keystroke
// 都會 push 中間態（j / ja / jap...）變成 history 垃圾。History 唯一觸發點是
// applyTermState 的 Off 路徑——使用者明確 dismiss 的 term 才是有保留價值的。
function syncFromSearch(text: string): void {
  const seenIds = new Set<string>()
  const newActive: string[] = []
  for (const tok of tokenize(text)) {
    const id = tokenIdentity(tok)
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)
    newActive.push(serializeTerm({ ...parseTerm(tok), prefix: null }))
  }

  // identity 重回 tokens → 從 history 移除（避免重複顯示）
  let historyChanged = false
  for (const id of seenIds) {
    const before = history.value.length
    history.value = history.value.filter(p => tokenIdentity(p) !== id)
    if (history.value.length !== before) historyChanged = true
  }

  // offChips evict：identity 重新出現在 tokens → 從 off 移除
  offChips.value = offChips.value.filter(p => {
    const id = tokenIdentity(p)
    return !!id && !seenIds.has(id)
  })

  activeChips.value = newActive

  if (historyChanged) schedulePersist()
  assertInvariants()
}

// 同步初始化要放 setup top-level：watch 只在「未來」變動觸發；不依賴任何
// async 結果，先把 activeChips 裝對才安全
syncFromSearch(props.modelValue)

onMounted(async () => {
  // 兩個獨立的 IO 平行跑（loadHistory 讀 GM、loadTagDb 可能拉網路），冷啟動
  // dbReady 翻為 true 從 sum(兩者) 收斂到 max(兩者)
  await Promise.all([loadHistory(), loadTagDb()])
  dbReady.value = true
})

watch(() => props.modelValue, syncFromSearch)

// === term 顯示用：state、group、display 全部從 active/off + identityIndex 推導 ===

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

  for (const p of activeChips.value) pushTerm(p, stateOf(p))
  // visibleOff = O \ buttonIds — button 牆已涵蓋的 identity 不重複顯示成 Off term
  for (const p of offChips.value) {
    const id = tokenIdentity(p)
    if (id && buttonIdentities.value.has(id)) continue
    pushTerm(p, TagState.Off)
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
// term → Off：history 的唯一 push 點。同時更新 offChips（page-scoped 留 term）和
// history（cross-page 持久化）。「使用者明確 dismiss」才有保留價值，原生框造成
// 的 token 消失不該污染這條 trace。
function applyTermState(positive: string, next: TagState): void {
  if (next === TagState.Off) {
    const id = tokenIdentity(positive)
    if (id && !offChips.value.some(p => tokenIdentity(p) === id)) {
      offChips.value.push(positive)
    }
    const idx = history.value.indexOf(positive)
    if (idx >= 0) history.value.splice(idx, 1)
    history.value.unshift(positive)
    if (history.value.length > HISTORY_CAP) history.value.length = HISTORY_CAP
    schedulePersist()
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

// 歷史 row 顯示用：去掉「已是 active / off term 身份」「已是 button 牆身份」
const visibleHistory = computed(() => {
  const sessionSet = new Set<string>()
  for (const p of activeChips.value) {
    const id = tokenIdentity(p)
    if (id) sessionSet.add(id)
  }
  for (const p of offChips.value) {
    const id = tokenIdentity(p)
    if (id) sessionSet.add(id)
  }
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

// 只清 H \ O（visible history row 顯示的部分），保留 O 對應的條目。
// 不變量 O ⊆ H 在 clearHistory 後仍成立——「清歷史」語意 = 清掉沒被 O 標記的
// 歷史條目，被使用者明確點 Off 的灰 term 對應的 history 條目留著（重整後 O
// 自然消失、那些條目就會浮上 visible history）。
function clearHistory(): void {
  const offIds = new Set(offChips.value.map(p => tokenIdentity(p)).filter(Boolean) as string[])
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
