import { ref, computed, watch, onMounted, onScopeDispose } from 'vue'
import { parseTerm, serializeTerm } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, removeTag, setTagState } from '@/services/tagState'
import { cacheGet, cacheSet } from '@/services/gmStorage'
import { enableHistory } from '@/services/store'
import { TagState } from '@/types'

// === SearchPanel 的核心狀態機：sessionTerms + history + invariants ===
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
// H 的 push 觸發點：
//   - markEntriesOff：A → O 那刻 push（dismissTerms / clearSearch；不論 submitted 與否）
//   - recordSubmit：當前 A 全部 push H（loadHistory 完成那刻為 mount initial、
//     SearchPanel.onSearchClick / TagBar dblclick 'search' 為 submit）
//   - syncFromSearch 不 push H——typing 中間態、原生框 morph、backspace 不污染 history
//
// 不變量：
//   I1 (primitive):       A = T            syncFromSearch 獨家 enforce
//   I3 (primitive):       O ⊆ H            markEntriesOff push、clearHistory 保留 O 對應
//   I4 (by-construction): A ∩ O = ∅        entry.active 互斥 ⇒ 結構上不可能違反
//
//   （沒有 A ∩ H = ∅——A 在 mount initial / submit 後會進 H，visibleHistory 在 SearchPanel
//   那層投影 H \ ids(sessionTerms) 排除 TagBar 已顯示的，使用者不會看到重複）
//
// Enforcer 對照：
//   syncFromSearch  →  I1（rebuild active 跟 T 對齊）
//   markEntriesOff  →  mutate entry.active = false + pushToHistory（守 I3）
//   recordSubmit    →  pushToHistory(A)；mount 路徑限 initial-submitted id 子集擋 race
//   clearHistory    →  H ← H ∩ ids(O)（守 I3）
//
// Dev-mode 守門：assertInvariants() 在 syncFromSearch / loadHistory / clearHistory 末尾各跑一次

export interface TermEntry { positive: string; active: boolean }

const HISTORY_KEY = 'eqt-search-history'
const HISTORY_CAP = 50
const PERSIST_DEBOUNCE_MS = 100

export function useSessionTerms(opts: {
  modelValue: () => string
  emitUpdate: (value: string) => void
}) {
  const sessionTerms = ref<TermEntry[]>([])
  const history = ref<string[]>([])

  async function loadHistory(): Promise<void> {
    const raw = await cacheGet(HISTORY_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) history.value = parsed.filter(x => typeof x === 'string')
      } catch { /* corrupted blob → 從空 */ }
    }
    // 「直接從 URL 進到帶 search 的頁面」這條路徑：onMounted 才拿到舊 history，
    // 載入完才把 mount initial 的 A 視為「已提交」推進 H 頂端。先 cacheGet 後 push
    // 才不會被 cache load 蓋掉剛 push 的條目。
    //
    // 帶 initialSubmittedIds：async gap 期間 watch 可能 fire 把 sessionTerms 同步成
    // typing 中間態，這條限制只 push「mount 那一刻已存在於 modelValue」的 id 子集，
    // 把 mount-initial 與後續 typing 中間態結構上隔開（finding #1）。
    recordSubmit(initialSubmittedIds)
    assertInvariants()
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
  // I4 (A ∩ O = ∅) 由 entry.active 互斥 by-construction 保證，這裡只 check primitive 兩條。
  // enableHistory 關掉時跳過 I3——使用者明確 opt-out、Off chip 無 H 對應是預期狀態
  function assertInvariants(): void {
    if (!import.meta.env.DEV) return
    const T = new Set(tokenize(opts.modelValue()).map(tokenIdentity).filter(Boolean) as string[])
    const A = new Set(
      sessionTerms.value.filter(c => c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
    )
    const H = new Set(history.value.map(tokenIdentity).filter(Boolean) as string[])

    if (A.size !== T.size || [...A].some(x => !T.has(x))) {
      console.error('[useSessionTerms] I1 broken: A !== T', { A: [...A], T: [...T] })
    }
    if (!enableHistory.value) return
    const i3Missing: string[] = []
    for (const c of sessionTerms.value) {
      if (c.active) continue
      const id = tokenIdentity(c.positive)
      if (id && !H.has(id)) i3Missing.push(id)
    }
    if (i3Missing.length) {
      console.error('[useSessionTerms] I3 broken: O ⊄ H', { missing: i3Missing })
    }
  }

  // 對齊 sessionTerms 跟 T：
  //   - 既有 active entry 在 T 中 → 留位置、更新 positive（typing morph 自然帶過）
  //   - 既有 off entry 在 T 中 → 從 off reclaim 回 active、留位置、更新 positive
  //   - 既有 active entry 不在 T 中 → 移除（原生框刪掉這個 token）
  //   - 既有 off entry 不在 T 中 → 保留（這正是 Off 意義）
  //   - T 中沒對應 entry 的新 id → append 到尾巴（active）
  //
  // H 的 push / reclaim 都不在這裡——typing 中間態進出不污染歷史，A 進 H 由
  // recordSubmit 另外觸發（mount initial / submit）、O 進 H 由 markEntriesOff 觸發
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
    assertInvariants()
  }

  // HISTORY_CAP 守門帶 I3 保護：sessionTerms 內 Off entry 對應的 H 條目永遠保留。
  // 純 `history.length = HISTORY_CAP` 會把舊條目擠掉，若擠掉的是 Off entry 對應
  // 的 H 條目，I3 (O ⊆ H) 破裂——使用者會看到「孤兒灰按鈕」（sessionTerms 內仍有
  // Off entry 但 H 沒對應條目，clearHistory 也救不回來）。
  //
  // A 對應條目「不」受保護：A 在 sessionTerms 已可見、被擠掉只影響「使用者編輯
  // 掉 A token 後 visibleHistory 是否立刻浮上來」這個小體感，不破壞核心契約；
  // 反之若擴大 protected 到 A，長 paste 觸發 cap 上限後永久無法收（finding #4）。
  //
  // 邊界情況：Off entry 數量 > HISTORY_CAP 時，protected 全保留會超過 cap。
  // 此時 invariant 優先於 cap（cap 只是 UI hint，invariant 是核心契約）。
  function trimHistory(): void {
    if (history.value.length <= HISTORY_CAP) return
    const offIds = new Set(
      sessionTerms.value.filter(c => !c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
    )
    if (offIds.size === 0) {
      history.value.length = HISTORY_CAP
      return
    }
    const result: string[] = []
    let unprotectedSlots = Math.max(0, HISTORY_CAP - offIds.size)
    for (const p of history.value) {
      const id = tokenIdentity(p)
      if (id && offIds.has(id)) {
        result.push(p)  // protected, 一律保留
      } else if (unprotectedSlots > 0) {
        result.push(p)
        unprotectedSlots--
      }
    }
    history.value = result
  }

  // markEntriesOff / recordSubmit 共用底層：dedup by identity → unshift → trim → persist。
  // entry.positive 已是 syncFromSearch normalize 過的 canonical form（strip prefix，保
  // suffix，保 namespace 原形）；history 跟 sessionTerms 都存 canonical。caller 傳入
  // raw form（含 prefix / alias / suffix）不會洩漏進 history。dedup 跨 form 用
  // tokenIdentity 比對。
  //
  // enableHistory 關掉時整段 no-op（不 push、不 persist）；caller 端的 mutate
  // （entry.active=false）已先跑過、不靠這條保證 chip 視覺殘留。
  function pushManyToHistory(entries: ReadonlyArray<TermEntry>): void {
    if (!enableHistory.value) return
    let mutated = false
    for (const entry of entries) {
      const id = tokenIdentity(entry.positive)
      if (!id) continue
      const dupIdx = history.value.findIndex(p => tokenIdentity(p) === id)
      if (dupIdx >= 0) history.value.splice(dupIdx, 1)
      history.value.unshift(entry.positive)
      mutated = true
    }
    if (mutated) {
      trimHistory()
      schedulePersist()
    }
  }

  // dismissTerms / clearSearch 共用 body：把指定 entries mutate 成 off + push history。
  // 不檢查 entry.active 是否已 false——保留原 dismissTerms 「dup positive 各處理一次」
  // 的語意（caller 自己決定要不要先 filter active）。
  function markEntriesOff(entries: TermEntry[]): void {
    for (const entry of entries) {
      entry.active = false
    }
    pushManyToHistory(entries)
    // 不在這守 assertInvariants：emit 後 props.modelValue 還沒同步更新
    // （Vue prop 更新是 microtask），當下 T 是舊值、A 是新值 ⇒ I1 假陽性。
    // emit → watch → syncFromSearch 結尾的 assertInvariants 會處理整個 cycle
  }

  // dismissTerms：把指定 positives 對應的 sessionTerm entry mark off + emit removeTag。
  // TagBar button click toggle Off 時也透過這條路徑（讓 TagBar 也走「殘留 off + push
  // history」，不要走 syncFromSearch 推導路徑被當 active entry 不在 T 直接丟）。
  function dismissTerms(positives: string[]): void {
    const entries: TermEntry[] = []
    for (const positive of positives) {
      const id = tokenIdentity(positive)
      if (!id) continue
      const entry = sessionTerms.value.find(c => tokenIdentity(c.positive) === id)
      if (entry) entries.push(entry)
    }
    if (!entries.length) return  // 無對應 sessionTerm → no-op，不 push ghost history
    markEntriesOff(entries)
    opts.emitUpdate(removeTag(opts.modelValue(), positives))
  }

  // 清空搜尋框：所有 active entry 標 off + emit ''。
  // 不能只 emit ''：syncFromSearch 看 T=∅ 會走 I1 (A=T) 把所有 active entry 從推導路徑
  // 丟掉，term 直接消失不進 history。先 in-place 把 entry.active 標 false ⇒
  // syncFromSearch 走「!entry.active 保留」分支殘留成灰 chip。
  // 順序保證：Vue prop 更新是 microtask、整個 sync stack 跑完才觸發 watch
  function clearSearch(): void {
    const entries = sessionTerms.value.filter(c => c.active)
    markEntriesOff(entries)
    opts.emitUpdate('')
  }

  // 把當前 A 推進 H 頂端（dedup by identity）。觸發點：
  //   - loadHistory 載完那刻：mount initial modelValue 已有 active term ⇒ 「直接從
  //     URL 進到帶 search 的頁面」這條路徑視同 submit。loadHistory 路徑傳入
  //     initialSubmittedIds 把可推 id 鎖在「mount 那一刻已存在」的子集——隔絕
  //     async gap 期間 typing 出來的中間態（finding #1）。
  //   - SearchPanel.onSearchClick / TagBar dblclick 'search'：實際 submit 動作。
  //     此路徑不帶 restrictTo，當下 A 全部推進。
  //
  // 純 mutate history、不動 sessionTerms。enableHistory 關掉時 no-op（pushManyToHistory 守）。
  function recordSubmit(restrictTo?: ReadonlySet<string>): void {
    const eligible = sessionTerms.value.filter(c => {
      if (!c.active) return false
      if (!restrictTo) return true
      const id = tokenIdentity(c.positive)
      return !!id && restrictTo.has(id)
    })
    pushManyToHistory(eligible)
  }

  // submit 路徑專用：navigate 走前 sync 把 pending persist flush 進 GM storage。
  // 若不 await，emit('search') → form.submit() 同步 navigate → onScopeDispose 雖然
  // 也會 fire-and-forget cacheSet，但 cacheSet 是 async，unload 比它 resolve 快時
  // 寫入丟失（finding #3）。先 recordSubmit 排好 schedulePersist 的 timer，再
  // flushPersist 把 timer 清掉 + await cacheSet，確保 navigate 前 GM_setValue resolve。
  async function recordSubmitAndFlush(): Promise<void> {
    recordSubmit()
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = 0
      await cacheSet(HISTORY_KEY, JSON.stringify(history.value))
    }
  }

  // 只清 H \ O（visible history row 顯示的部分），保留 O 對應條目守 I3。
  // A 對應條目「不」保留：清歷史是使用者主動清空動作，留下 A 的條目會在使用者
  // 接著 backspace 掉那個 A token 時意外浮成 ghost chip（finding #2），體感像
  // 「我剛清掉怎麼又出來」。A 在 sessionTerms 已可見、不需要 H 鏡像。
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

  function onRestoreHistory(positive: string): void {
    // history 存的就是 positive，直接 setTagState Include
    opts.emitUpdate(setTagState(opts.modelValue(), [positive], TagState.Include))
  }

  // history Draggable @change：拖拽完成 (drop 成功) 時 sortablejs 已經把 source
  // DOM 搬走、emit removed 事件帶 source item。同步把 entry 從 history.value 剔掉並
  // persist，讓資料層跟視覺對齊。drop 取消（拖到空白處放開）sortablejs 自動 revert
  // source、不會發 removed，這條路徑天然不會誤刪
  function onHistoryChange(evt: { removed?: { element: { positive: string } } }): void {
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

  // 同步初始化要放 setup top-level：watch 只在「未來」變動觸發；不依賴任何
  // async 結果，先把 sessionTerms 裝對才安全
  //
  // initialSubmittedIds 是「mount 那一刻就已存在於 modelValue 的 token id」snapshot。
  // 純粹給 loadHistory 走 mount-initial 路徑時用：onMounted → await cacheGet 的 async gap
  // 期間 watch 可能 fire 把 sessionTerms 同步成 typing 中間態（a:f / a:fo），若
  // recordSubmit 讀「當下」 sessionTerms 就會把中間態推進 H、破壞「typing 不污染」trade-off。
  // 用 initial snapshot 限制 recordSubmit 只 push「曾在 initial modelValue 出現」的 id，
  // mount-initial 與 typing 中間態結構上隔開。
  const initialSubmittedIds = new Set(
    tokenize(opts.modelValue()).map(tokenIdentity).filter(Boolean) as string[]
  )
  syncFromSearch(opts.modelValue())

  onMounted(loadHistory)
  watch(opts.modelValue, syncFromSearch)

  return {
    sessionTerms,
    history,
    sessionIdentitySet,
    dismissTerms,
    clearSearch,
    clearHistory,
    recordSubmitAndFlush,
    onRestoreHistory,
    onHistoryChange,
  }
}
