import { tokenize, tokenIdentity } from '../tagState'
import { parseTerm, serializeTerm } from '../searchSyntax'

// === SearchPanel 核心狀態的純函數層 ===
//
// 集合投影定義：
//   A = ids(sessionTerms.filter(c => c.active))
//   O = ids(sessionTerms.filter(c => !c.active))
//   H = ids(history)
//   T = ids(tokenize(modelValue))
//
// 不變量：
//   I1: A = T                A === T（syncFromSearchPure 維護）
//   I3: O ⊆ H                所有 off entry 的 identity 都在 history 裡
//   I4: A ∩ O = ∅            by-construction，entry.active 互斥

export interface TermEntry { positive: string; active: boolean }

export const HISTORY_CAP = 50

/**
 * 對齊 sessionTerms 跟 search text 的 token 集合 T：
 *   - 既有 active entry 在 T 中 → 留位置、更新 positive 跟 T 對齊
 *   - 既有 off entry 在 T 中 → 從 off reclaim 回 active、留位置、更新 positive
 *   - 既有 active entry 不在 T 中 → 移除（原生框刪掉這個 token）
 *   - 既有 off entry 不在 T 中 → 保留（這正是 Off 意義）
 *   - T 中沒對應 entry 的新 id → append 到尾巴（active）
 *
 * 不 push history——typing 中間態進出不污染歷史。
 */
export function syncFromSearchPure(
  text: string,
  current: ReadonlyArray<TermEntry>,
): TermEntry[] {
  const newPositiveById = new Map<string, string>()
  for (const tok of tokenize(text)) {
    const id = tokenIdentity(tok)
    if (!id || newPositiveById.has(id)) continue
    newPositiveById.set(id, serializeTerm({ ...parseTerm(tok), prefix: null }))
  }

  const pendingNew = new Set(newPositiveById.keys())
  const next: TermEntry[] = []
  for (const entry of current) {
    const id = tokenIdentity(entry.positive)
    if (!id) continue
    if (newPositiveById.has(id)) {
      next.push({ positive: newPositiveById.get(id)!, active: true })
      pendingNew.delete(id)
    } else if (!entry.active) {
      next.push(entry)
    }
    // 否則：active entry 不在 T → 丟（原生框移除）
  }
  for (const id of pendingNew) {
    next.push({ positive: newPositiveById.get(id)!, active: true })
  }
  return next
}

/**
 * HISTORY_CAP 守門帶 I3 保護：sessionTerms 內 Off entry 對應的 H 條目永遠保留。
 *
 * A 對應條目「不」受保護：A 在 sessionTerms 已可見、被擠掉只影響「使用者編輯掉
 * A token 後 visibleHistory 是否立刻浮上來」這個小體感，不破壞核心契約；反之
 * 若擴大 protected 到 A，長 paste 觸發 cap 上限後永久無法收（finding #4）。
 *
 * 邊界：Off entry 數量 > HISTORY_CAP 時 protected 全保留會超過 cap。
 * invariant 優先於 cap（cap 只是 UI hint，invariant 是核心契約）。
 */
export function trimHistoryPure(
  history: ReadonlyArray<string>,
  sessionTerms: ReadonlyArray<TermEntry>,
): string[] {
  if (history.length <= HISTORY_CAP) return [...history]
  const offIds = new Set(
    sessionTerms.filter(c => !c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[],
  )
  if (offIds.size === 0) {
    return history.slice(0, HISTORY_CAP)
  }
  const result: string[] = []
  let unprotectedSlots = Math.max(0, HISTORY_CAP - offIds.size)
  for (const p of history) {
    const id = tokenIdentity(p)
    if (id && offIds.has(id)) {
      result.push(p)
    } else if (unprotectedSlots > 0) {
      result.push(p)
      unprotectedSlots--
    }
  }
  return result
}

/**
 * dedup by identity → unshift → trim（with O protection）。
 *
 * 回傳 { history, mutated }：mutated=false 時 caller 可省略 persist schedule。
 * entries 內 parseError token（id=null）會被跳過、不算 mutation。
 */
export function pushManyToHistoryPure(
  entries: ReadonlyArray<TermEntry>,
  currentHistory: ReadonlyArray<string>,
  sessionTerms: ReadonlyArray<TermEntry>,
): { history: string[]; mutated: boolean } {
  // 預掃一輪先決定有沒有 mutation——避免無效 push 也付 O(N) spread copy 的代價
  const hasValidId = entries.some(e => !!tokenIdentity(e.positive))
  if (!hasValidId) return { history: currentHistory as string[], mutated: false }

  const newHistory: string[] = [...currentHistory]
  for (const entry of entries) {
    const id = tokenIdentity(entry.positive)
    if (!id) continue
    const dupIdx = newHistory.findIndex(p => tokenIdentity(p) === id)
    if (dupIdx >= 0) newHistory.splice(dupIdx, 1)
    newHistory.unshift(entry.positive)
  }
  return { history: trimHistoryPure(newHistory, sessionTerms), mutated: true }
}

/**
 * 把 sessionTerms 內指定 identity 的 entry 標 off，回傳新陣列。
 * 未匹配的 entry 直接保留 reference。idsToOff 內沒對應 entry 的 id 直接忽略。
 */
export function markEntriesOffPure(
  sessionTerms: ReadonlyArray<TermEntry>,
  idsToOff: ReadonlySet<string>,
): TermEntry[] {
  return sessionTerms.map(e => {
    const id = tokenIdentity(e.positive)
    return id && idsToOff.has(id) ? { ...e, active: false } : e
  })
}

/**
 * clearHistory: H ← H ∩ ids(O)。只保留 O 對應的條目守 I3，A 對應的清掉。
 */
export function clearHistoryPure(
  history: ReadonlyArray<string>,
  sessionTerms: ReadonlyArray<TermEntry>,
): string[] {
  const offIds = new Set(
    sessionTerms.filter(c => !c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[],
  )
  return history.filter(p => {
    const id = tokenIdentity(p)
    return !!id && offIds.has(id)
  })
}

/**
 * recordSubmit 用：篩出 active entries，若有 restrictTo 則限該 identity 子集。
 */
export function recordSubmitEligible(
  sessionTerms: ReadonlyArray<TermEntry>,
  restrictTo?: ReadonlySet<string>,
): TermEntry[] {
  return sessionTerms.filter(c => {
    if (!c.active) return false
    if (!restrictTo) return true
    const id = tokenIdentity(c.positive)
    return !!id && restrictTo.has(id)
  })
}

/**
 * 從 search text 計算 token identity 集合（給 mount-initial 路徑當 snapshot）。
 */
export function tokenIdentitiesFromText(text: string): Set<string> {
  return new Set(tokenize(text).map(tokenIdentity).filter(Boolean) as string[])
}

/**
 * dismissTerms 用：給定 positive 字串陣列，從 sessionTerms 找出對應的 entries
 * （by identity 比對）。回傳 entries 順序按 sessionTerms 原順序。
 */
export function findEntriesByPositives(
  sessionTerms: ReadonlyArray<TermEntry>,
  positives: ReadonlyArray<string>,
): TermEntry[] {
  const targetIds = new Set(positives.map(p => tokenIdentity(p)).filter(Boolean) as string[])
  if (targetIds.size === 0) return []
  return sessionTerms.filter(e => {
    const id = tokenIdentity(e.positive)
    return !!id && targetIds.has(id)
  })
}

// === Dev-mode invariant checks（純驗算，caller 負責 console.error）===

export function checkI1(
  text: string,
  sessionTerms: ReadonlyArray<TermEntry>,
): { A: string[]; T: string[] } | null {
  const T = new Set(tokenize(text).map(tokenIdentity).filter(Boolean) as string[])
  const A = new Set(
    sessionTerms.filter(c => c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[],
  )
  if (A.size !== T.size || [...A].some(x => !T.has(x))) {
    return { A: [...A], T: [...T] }
  }
  return null
}

export function checkI3(
  sessionTerms: ReadonlyArray<TermEntry>,
  history: ReadonlyArray<string>,
): string[] {
  const H = new Set(history.map(tokenIdentity).filter(Boolean) as string[])
  const missing: string[] = []
  for (const c of sessionTerms) {
    if (c.active) continue
    const id = tokenIdentity(c.positive)
    if (id && !H.has(id)) missing.push(id)
  }
  return missing
}
