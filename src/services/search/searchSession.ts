import { ref, computed, watch, onScopeDispose, getCurrentScope } from 'vue'
import { tokenIdentity, removeTag, setTagState } from '../tagState'
import { cacheGet, cacheSet } from '../gmStorage'
import { enableHistory } from '../store'
import { TagState } from '@/types'
import {
  syncFromSearchPure,
  pushManyToHistoryPure,
  markEntriesOffPure,
  clearHistoryPure,
  recordSubmitEligible,
  tokenIdentitiesFromText,
  findEntriesByPositives,
  checkI1,
  checkI3,
  type TermEntry,
} from './sessionState'

// === SearchPanel session：跨 component 共享的 sessionTerms + history 狀態機 ===
//
// 集合投影：
//   A = ids(sessionTerms.filter(c => c.active))
//   O = ids(sessionTerms.filter(c => !c.active))
//   H = ids(history)
//   T = ids(tokenize(modelValue))
//
// 不變量：
//   I1 (primitive):       A = T            syncFromSearch 獨家 enforce
//   I3 (primitive):       O ⊆ H            markEntriesOff push、clearHistory 保留 O 對應
//   I4 (by-construction): A ∩ O = ∅        entry.active 互斥 ⇒ 結構上不可能違反

export const sessionTerms = ref<TermEntry[]>([])
export const history = ref<string[]>([])

// sessionTerms 的 identity 集合——抽 computed 讓 history 變動不會 rebuild
// （只在 sessionTerms 變動時重算），visibleHistory 純走 cached lookup
export const sessionIdentitySet = computed(() => {
  const s = new Set<string>()
  for (const entry of sessionTerms.value) {
    const id = tokenIdentity(entry.positive)
    if (id) s.add(id)
  }
  return s
})

export type { TermEntry } from './sessionState'

const HISTORY_KEY = 'eqt-search-history'
const PERSIST_DEBOUNCE_MS = 100

// === 持久化（內部）===

// debounce 寫入 GM：連續觸發只送最後一筆，且 payload 在 flush 那刻才 stringify
// 確保寫入的是 latest snapshot 而非觸發時的 snapshot。避免快速操作導致多筆
// in-flight 寫入順序顛倒覆蓋成舊資料。
let persistTimer = 0
function schedulePersist(): void {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = 0
    cacheSet(HISTORY_KEY, JSON.stringify(history.value))
  }, PERSIST_DEBOUNCE_MS)
}

function flushPersist(): Promise<void> {
  if (!persistTimer) return Promise.resolve()
  clearTimeout(persistTimer)
  persistTimer = 0
  return cacheSet(HISTORY_KEY, JSON.stringify(history.value))
}

// historyLoaded 不是「load 成功」而是「load attempted」——corrupted blob 也算數，
// 用來給 bindSearchBar 守「load 在 bind 之前完成」的順序契約
let historyLoaded = false

/**
 * main.ts 在 createApp 前呼叫。setup() 階段拿到的 history.value 已經是 GM
 * 載入後的狀態，bindSearchBar 內 recordSubmit 直接 push 進 loaded H。
 */
export async function loadSessionHistory(): Promise<void> {
  const raw = await cacheGet(HISTORY_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) history.value = parsed.filter(x => typeof x === 'string')
    } catch { /* corrupted blob → 從空 */ }
  }
  historyLoaded = true
}

// === Search bar 連線 ===
//
// bindSearchBar 必須在 component setup() 內呼叫——watch + onScopeDispose 依
// component scope。throwing default 讓任何 command 在 bind 前被呼叫都立刻
// 報明確錯，不會 silent fail。

const UNBOUND_GETTER: () => string = () => {
  throw new Error('searchSession: bindSearchBar must be called before reading modelValue')
}
const UNBOUND_EMITTER: (v: string) => void = () => {
  throw new Error('searchSession: bindSearchBar must be called before emitUpdate')
}

let getModelValue: () => string = UNBOUND_GETTER
let emitUpdate: (value: string) => void = UNBOUND_EMITTER

export function bindSearchBar(opts: {
  modelValue: () => string
  emitUpdate: (value: string) => void
}): void {
  // scope guard：watch / onScopeDispose 都依賴 active effectScope，
  // 在 scope 外呼叫會 silent fail（watch 掛 null scope 永不觸發）。
  // getCurrentScope 涵蓋 component setup 跟 effectScope().run()，後者讓
  // 測試能在無 component 環境下 bind。
  if (!getCurrentScope()) {
    throw new Error('searchSession: bindSearchBar must be called inside an active effect scope (component setup or effectScope().run())')
  }
  // dev-mode 順序契約：loadSessionHistory 必須在 bindSearchBar 之前 await 完，
  // 否則 mount-initial recordSubmit 推進空 history、之後 load 灌入時順序錯位
  if (import.meta.env.DEV && !historyLoaded) {
    console.warn('[searchSession] bindSearchBar called before loadSessionHistory; mount-initial history will not include cached entries')
  }

  getModelValue = opts.modelValue
  emitUpdate = opts.emitUpdate

  // initialSubmittedIds：「mount 那一刻就已存在於 modelValue 的 token id」snapshot。
  // 用來限制 recordSubmit 只 push 這個子集——若未來 bindSearchBar 改成在 async
  // gap 內呼叫（例如 mount 後才連線），typing 中間態不會被推進 H。
  const initialSubmittedIds = tokenIdentitiesFromText(opts.modelValue())

  // 同步初始化要放 setup top-level：watch 只在「未來」變動觸發；先把
  // sessionTerms 裝對才安全。
  syncFromSearch(opts.modelValue())

  // history 已 load 完，把 initial A 視同「已提交」推進 H 頂端。
  // 「直接從 URL 進到帶 search 的頁面」這條路徑視同 submit。
  recordSubmit(initialSubmittedIds)
  assertInvariants()

  // 監聽未來 modelValue 變動（外部 typing / setModelValue 都會觸發）。
  watch(opts.modelValue, syncFromSearch)

  onScopeDispose(() => {
    // 未 flush 的變更 fire-and-forget 一發
    if (persistTimer) {
      clearTimeout(persistTimer)
      cacheSet(HISTORY_KEY, JSON.stringify(history.value))
    }
    // 清回 throwing default，避免 unmount 後 stale closure 被讀（hot reload /
    // remount 場景），下一次 bindSearchBar 才會正確重設
    getModelValue = UNBOUND_GETTER
    emitUpdate = UNBOUND_EMITTER
  })
}

// === 內部 helper（不 export）===

function syncFromSearch(text: string): void {
  sessionTerms.value = syncFromSearchPure(text, sessionTerms.value)
  assertInvariants()
}

// enableHistory 關掉時整段 no-op（不 push、不 persist）；caller 端的 mutate
// （entry.active=false）已先跑過、不靠這條保證 chip 視覺殘留。
function pushManyToHistory(entries: ReadonlyArray<TermEntry>): void {
  if (!enableHistory.value) return
  const { history: newHistory, mutated } = pushManyToHistoryPure(
    entries, history.value, sessionTerms.value,
  )
  if (!mutated) return
  history.value = newHistory
  schedulePersist()
}

// dismissTerms / clearSearch 共用 body：把指定 entries mutate 成 off + push history。
// 不檢查 entry.active 是否已 false——dup positive 各處理一次（caller 自己決定
// 要不要先 filter active）。
function markEntriesOff(entries: ReadonlyArray<TermEntry>): void {
  const idsToOff = new Set(entries.map(e => tokenIdentity(e.positive)).filter(Boolean) as string[])
  sessionTerms.value = markEntriesOffPure(sessionTerms.value, idsToOff)
  pushManyToHistory(entries)
  // 不在這守 assertInvariants：emit 後 props.modelValue 還沒同步更新
  // （Vue prop 更新是 microtask），當下 T 是舊值、A 是新值 ⇒ I1 假陽性。
  // emit → watch → syncFromSearch 結尾的 assertInvariants 會處理整個 cycle
}

// 把當前 A 推進 H 頂端（dedup by identity）。
function recordSubmit(restrictTo?: ReadonlySet<string>): void {
  pushManyToHistory(recordSubmitEligible(sessionTerms.value, restrictTo))
}

// Dev-mode invariant checker。生產環境被 bundler 整段 dead-code-elim 掉、零成本。
// I4 (A ∩ O = ∅) 由 entry.active 互斥 by-construction 保證，這裡只 check
// primitive 兩條。enableHistory 關掉時跳過 I3——使用者明確 opt-out、Off chip
// 無 H 對應是預期狀態。
function assertInvariants(): void {
  if (!import.meta.env.DEV) return
  const i1 = checkI1(getModelValue(), sessionTerms.value)
  if (i1) console.error('[searchSession] I1 broken: A !== T', i1)
  if (!enableHistory.value) return
  const i3Missing = checkI3(sessionTerms.value, history.value)
  if (i3Missing.length) {
    console.error('[searchSession] I3 broken: O ⊄ H', { missing: i3Missing })
  }
}

// === Public commands ===

/**
 * 把指定 positives 對應的 sessionTerm entry mark off + emit removeTag。
 * TagBar button click toggle Off 時也透過這條路徑（讓 TagBar 也走「殘留 off +
 * push history」，不要走 syncFromSearch 推導路徑被當 active entry 不在 T 直接丟）。
 */
export function dismissTerms(positives: string[]): void {
  const entries = findEntriesByPositives(sessionTerms.value, positives)
  if (!entries.length) return  // 無對應 sessionTerm → no-op，不 push ghost history
  markEntriesOff(entries)
  emitUpdate(removeTag(getModelValue(), positives))
}

/**
 * 清空搜尋框：所有 active entry 標 off + emit ''。
 * 不能只 emit ''：syncFromSearch 看 T=∅ 會走 I1 (A=T) 把所有 active entry 從推導
 * 路徑丟掉，term 直接消失不進 history。先 in-place 把 entry.active 標 false ⇒
 * syncFromSearch 走「!entry.active 保留」分支殘留成灰 chip。
 */
export function clearSearch(): void {
  const entries = sessionTerms.value.filter(c => c.active)
  markEntriesOff(entries)
  emitUpdate('')
}

/**
 * 只清 H \ O（visible history row 顯示的部分），保留 O 對應條目守 I3。
 * A 對應條目「不」保留：清歷史是使用者主動清空動作，留下 A 的條目會在使用者
 * 接著 backspace 掉那個 A token 時意外浮成 ghost chip（finding #2），體感像
 * 「我剛清掉怎麼又出來」。A 在 sessionTerms 已可見、不需要 H 鏡像。
 */
export function clearHistory(): void {
  history.value = clearHistoryPure(history.value, sessionTerms.value)
  schedulePersist()
  assertInvariants()
}

/**
 * submit 路徑專用：navigate 走前 sync 把 pending persist flush 進 GM storage。
 * 若不 await，emit('search') → form.submit() 同步 navigate → onScopeDispose 雖然
 * 也會 fire-and-forget cacheSet，但 cacheSet 是 async，unload 比它 resolve 快時
 * 寫入丟失（finding #3）。
 */
export async function recordSubmitAndFlush(): Promise<void> {
  recordSubmit()
  await flushPersist()
}

/**
 * 點 history ghost chip 把該 token 加回搜尋（Include state）。
 */
export function onRestoreHistory(positive: string): void {
  emitUpdate(setTagState(getModelValue(), [positive], TagState.Include))
}

/**
 * history Draggable @change：drop 成功時 sortablejs 已搬走 DOM、emit removed。
 * 同步把 entry 從 history.value 剔掉並 persist，讓資料層跟視覺對齊。
 * drop 取消（拖到空白處放開）sortablejs 自動 revert、不會發 removed。
 */
export function onHistoryChange(evt: { removed?: { element: { positive: string } } }): void {
  if (!evt.removed) return
  const positive = evt.removed.element.positive
  const id = tokenIdentity(positive)
  if (!id) return
  const idx = history.value.findIndex(p => tokenIdentity(p) === id)
  if (idx >= 0) {
    history.value.splice(idx, 1)
    schedulePersist()
  }
}
