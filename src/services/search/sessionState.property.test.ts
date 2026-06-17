import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { tokenIdentity } from '@/services/tagState'
import {
  syncFromSearchPure,
  pushManyToHistoryPure,
  trimHistoryPure,
  markEntriesOffPure,
  clearHistoryPure,
  recordSubmitEligible,
  findEntriesByPositives,
  tokenIdentitiesFromText,
  checkI1,
  checkI3,
  HISTORY_CAP,
  type TermEntry,
} from './sessionState'
import {
  tokenArb,
  textArb,
  termEntryArb,
  sessionTermsArb,
  historyArb,
  longHistoryArb,
} from '@/services/test-helpers'

// === helpers ===

const idOf = (positive: string): string | null => tokenIdentity(positive)

const activeIds = (entries: ReadonlyArray<TermEntry>): Set<string> =>
  new Set(
    entries.filter(e => e.active)
      .map(e => tokenIdentity(e.positive))
      .filter((x): x is string => !!x),
  )

const offIds = (entries: ReadonlyArray<TermEntry>): Set<string> =>
  new Set(
    entries.filter(e => !e.active)
      .map(e => tokenIdentity(e.positive))
      .filter((x): x is string => !!x),
  )

// ============================================================
// syncFromSearchPure
// ============================================================

describe('syncFromSearchPure', () => {
  test.prop([textArb, sessionTermsArb])(
    '結果維護 I1（active ids === T）',
    (text, current) => {
      const next = syncFromSearchPure(text, current)
      expect(checkI1(text, next)).toBeNull()
    },
  )

  test.prop([textArb])(
    '從空 current 跑：active ids === tokenIdentitiesFromText(text)',
    (text) => {
      const next = syncFromSearchPure(text, [])
      expect(activeIds(next)).toEqual(tokenIdentitiesFromText(text))
    },
  )

  test.prop([textArb, sessionTermsArb])(
    '套兩次後 active ids 跟 positive 字串都穩定',
    (text, current) => {
      const once = syncFromSearchPure(text, current)
      const twice = syncFromSearchPure(text, once)
      expect(activeIds(twice)).toEqual(activeIds(once))
      // positive 字串也該 idempotent——serializeTerm 飄動會破壞這條
      const oncePositives = once.map(e => `${e.positive}|${e.active}`)
      const twicePositives = twice.map(e => `${e.positive}|${e.active}`)
      expect(twicePositives).toEqual(oncePositives)
    },
  )

  test.prop([textArb, sessionTermsArb])(
    'off entries ⊆ current 的 off entries（不憑空產生）',
    (text, current) => {
      const next = syncFromSearchPure(text, current)
      const nextOffs = offIds(next)
      const currentOffs = offIds(current)
      for (const id of nextOffs) expect(currentOffs.has(id)).toBe(true)
    },
  )

  test.prop([textArb, sessionTermsArb])(
    '現有 entries 的相對順序不變（preserves order，UX invariant）',
    (text, current) => {
      const next = syncFromSearchPure(text, current)
      // 取現有 entries 在 next 中對應 entry 的 index，應該單調遞增
      const indexes: number[] = []
      for (const entry of current) {
        const id = tokenIdentity(entry.positive)
        if (!id) continue
        const idx = next.findIndex(n => tokenIdentity(n.positive) === id)
        if (idx >= 0) indexes.push(idx)
      }
      for (let i = 1; i < indexes.length; i++) {
        expect(indexes[i]).toBeGreaterThan(indexes[i - 1])
      }
    },
  )

  test.prop([textArb, sessionTermsArb])(
    '新 ids append 在現有 entries 之後（UX invariant）',
    (text, current) => {
      const next = syncFromSearchPure(text, current)
      const currentIds = new Set(
        current.map(e => tokenIdentity(e.positive)).filter((x): x is string => !!x),
      )
      // 找最後一個「現有 entry 對應」的 index
      let lastExistingIdx = -1
      for (let i = 0; i < next.length; i++) {
        const id = tokenIdentity(next[i].positive)
        if (id && currentIds.has(id)) lastExistingIdx = i
      }
      // 之後的 entries 都該是新 ids（不在 currentIds）
      for (let i = lastExistingIdx + 1; i < next.length; i++) {
        const id = tokenIdentity(next[i].positive)
        if (id) expect(currentIds.has(id)).toBe(false)
      }
    },
  )
})

// ============================================================
// markEntriesOffPure
// ============================================================

describe('markEntriesOffPure', () => {
  test.prop([sessionTermsArb])(
    '空 idsToOff 是 no-op（.active flag 不變）',
    (s) => {
      const next = markEntriesOffPure(s, new Set())
      for (let i = 0; i < s.length; i++) {
        expect(next[i].active).toBe(s[i].active)
      }
    },
  )

  test.prop([sessionTermsArb])(
    '把所有 valid id 都 off 後，沒有 valid-id active entry 殘留',
    (s) => {
      const allIds = new Set(
        s.map(e => tokenIdentity(e.positive)).filter((x): x is string => !!x),
      )
      const next = markEntriesOffPure(s, allIds)
      // 注意：parseError entry（id=null）不會被 off。
      // assertion 名稱忠實反映：「valid id 的 active entry」全消失
      expect(activeIds(next).size).toBe(0)
    },
  )

  test.prop([sessionTermsArb, fc.array(fc.nat(), { maxLength: 5 })])(
    '是 idempotent（再次標 off 同 ids 結果相同）',
    (s, indexSeed) => {
      // 用 indexSeed 隨機取 s 的 id 子集（避免 deterministic 切片）
      const allIds = [...new Set(
        s.map(e => tokenIdentity(e.positive)).filter((x): x is string => !!x),
      )]
      const ids = new Set(indexSeed.map(i => allIds[i % Math.max(allIds.length, 1)]).filter((x): x is string => !!x))
      const once = markEntriesOffPure(s, ids)
      const twice = markEntriesOffPure(once, ids)
      expect(twice.map(e => ({ positive: e.positive, active: e.active })))
        .toEqual(once.map(e => ({ positive: e.positive, active: e.active })))
    },
  )

  test.prop([sessionTermsArb])(
    '長度跟順序不變（無論 idsToOff 是什麼）',
    (s) => {
      // 取 s 自己一些真實的 id 來測，比硬塞不存在 id 更有意義
      const someIds = new Set(
        s.slice(0, 2).map(e => tokenIdentity(e.positive)).filter((x): x is string => !!x),
      )
      const next = markEntriesOffPure(s, someIds)
      expect(next).toHaveLength(s.length)
      for (let i = 0; i < s.length; i++) {
        expect(next[i].positive).toBe(s[i].positive)
      }
    },
  )
})

// ============================================================
// clearHistoryPure
// ============================================================

describe('clearHistoryPure', () => {
  test.prop([historyArb, sessionTermsArb])(
    '結果 ⊆ 原 history',
    (h, s) => {
      const original = new Set(h)
      const cleared = clearHistoryPure(h, s)
      for (const item of cleared) expect(original.has(item)).toBe(true)
    },
  )

  test.prop([historyArb, sessionTermsArb])(
    '結果的 identity 全部在 O ids 內（守 I3）',
    (h, s) => {
      const cleared = clearHistoryPure(h, s)
      const O = offIds(s)
      for (const item of cleared) {
        const id = tokenIdentity(item)
        expect(id).not.toBeNull()
        expect(O.has(id!)).toBe(true)
      }
    },
  )

  test.prop([historyArb])(
    '空 sessionTerms 把 history 清空',
    (h) => {
      expect(clearHistoryPure(h, [])).toEqual([])
    },
  )

  test.prop([historyArb, sessionTermsArb])(
    '是 idempotent',
    (h, s) => {
      const once = clearHistoryPure(h, s)
      expect(clearHistoryPure(once, s)).toEqual(once)
    },
  )
})

// ============================================================
// pushManyToHistoryPure
// ============================================================

describe('pushManyToHistoryPure', () => {
  test.prop([historyArb, sessionTermsArb])(
    '空 entries → mutated=false 且 history value 跟原 history 等價',
    (h, s) => {
      const { history: next, mutated } = pushManyToHistoryPure([], h, s)
      expect(mutated).toBe(false)
      expect(next).toEqual(h)
      // 注意：source 在 mutated=false 時零拷貝直接 alias 回傳，效能優化。
      // caller 收到 next 後不應 in-place mutate（會 mutate 外部 array）
    },
  )

  test.prop([fc.array(termEntryArb, { minLength: 1, maxLength: 3 }), historyArb, sessionTermsArb])(
    '有合法 id 的 entries 被 unshift 到頂端（最後 push 的在 index 0）',
    (entries, h, s) => {
      const { history: next, mutated } = pushManyToHistoryPure(entries, h, s)
      const validEntries = entries.filter(e => !!tokenIdentity(e.positive))
      if (validEntries.length === 0) {
        expect(mutated).toBe(false)
        return
      }
      expect(mutated).toBe(true)
      // 最後 push 的 entry 在 index 0（dedup 不改變這條，因為最後 unshift）
      const lastValid = validEntries[validEntries.length - 1]
      expect(next[0]).toBe(lastValid.positive)
    },
  )

  test.prop([fc.array(termEntryArb, { maxLength: 5 }), historyArb, sessionTermsArb])(
    'push + trim 後 length ≤ max(HISTORY_CAP, |O|)（pipeline bound）',
    (entries, h, s) => {
      const { history: next } = pushManyToHistoryPure(entries, h, s)
      const offCount = offIds(s).size
      expect(next.length).toBeLessThanOrEqual(Math.max(HISTORY_CAP, offCount + entries.length))
    },
  )
})

// ============================================================
// trimHistoryPure（用 longHistoryArb 確保真的進入 trim 邏輯）
// ============================================================

describe('trimHistoryPure', () => {
  test.prop([historyArb, sessionTermsArb])(
    'length <= HISTORY_CAP 時不變',
    (h, s) => {
      const short = h.slice(0, HISTORY_CAP)
      expect(trimHistoryPure(short, s)).toEqual(short)
    },
  )

  test.prop([longHistoryArb])(
    '超過 cap + 沒 off entry → 截到 cap',
    (h) => {
      const result = trimHistoryPure(h, [])
      expect(result).toHaveLength(HISTORY_CAP)
      expect(result).toEqual(h.slice(0, HISTORY_CAP))
    },
  )

  test.prop([longHistoryArb, sessionTermsArb])(
    '超過 cap：所有 off entry 對應的 history 條目都保留（守 I3）',
    (h, s) => {
      const offEntryIds = offIds(s)
      const result = trimHistoryPure(h, s)
      const resultIds = new Set(result.map(p => tokenIdentity(p)).filter((x): x is string => !!x))
      const protectedFromOriginal = h.filter(p => {
        const id = tokenIdentity(p)
        return id && offEntryIds.has(id)
      })
      const protectedIds = new Set(protectedFromOriginal.map(p => tokenIdentity(p)).filter((x): x is string => !!x))
      for (const id of protectedIds) {
        expect(resultIds.has(id)).toBe(true)
      }
    },
  )

  test.prop([longHistoryArb, sessionTermsArb])(
    '超過 cap：result.length ≤ max(HISTORY_CAP, |O|)',
    (h, s) => {
      const result = trimHistoryPure(h, s)
      const offCount = offIds(s).size
      expect(result.length).toBeLessThanOrEqual(Math.max(HISTORY_CAP, offCount))
    },
  )
})

// ============================================================
// recordSubmitEligible
// ============================================================

describe('recordSubmitEligible', () => {
  test.prop([sessionTermsArb])(
    '無 restrictTo → 回傳所有 active entries',
    (s) => {
      const result = recordSubmitEligible(s)
      const expectedActive = s.filter(c => c.active)
      expect(result).toEqual(expectedActive)
    },
  )

  test.prop([sessionTermsArb])(
    '帶 restrictTo → 結果 ⊆ 無 restrictTo 的結果',
    (s) => {
      const restrictTo = new Set(['||foo', '||bar'])
      const restricted = recordSubmitEligible(s, restrictTo)
      const unrestricted = recordSubmitEligible(s)
      for (const e of restricted) expect(unrestricted).toContain(e)
    },
  )

  test.prop([sessionTermsArb])(
    '空 restrictTo → 空結果',
    (s) => {
      const result = recordSubmitEligible(s, new Set())
      expect(result).toEqual([])
    },
  )
})

// ============================================================
// findEntriesByPositives
// ============================================================

describe('findEntriesByPositives', () => {
  test.prop([sessionTermsArb])(
    '空 positives → 空結果',
    (s) => {
      expect(findEntriesByPositives(s, [])).toEqual([])
    },
  )

  test.prop([sessionTermsArb, fc.array(tokenArb, { maxLength: 3 })])(
    '結果 ⊆ sessionTerms',
    (s, positives) => {
      const result = findEntriesByPositives(s, positives)
      for (const e of result) expect(s).toContain(e)
    },
  )

  test.prop([sessionTermsArb, fc.array(tokenArb, { maxLength: 3 })])(
    '結果中每個 entry 的 identity 都對應到 positives 之一',
    (s, positives) => {
      const targetIds = new Set(positives.map(p => tokenIdentity(p)).filter((x): x is string => !!x))
      const result = findEntriesByPositives(s, positives)
      for (const e of result) {
        const id = tokenIdentity(e.positive)
        expect(id).not.toBeNull()
        expect(targetIds.has(id!)).toBe(true)
      }
    },
  )
})

// ============================================================
// checkI1 / checkI3
// ============================================================

describe('checkI1 / checkI3', () => {
  test.prop([textArb])(
    'checkI1(text, syncFromSearchPure(text, [])) === null（sync 後 I1 必成立）',
    (text) => {
      const synced = syncFromSearchPure(text, [])
      expect(checkI1(text, synced)).toBeNull()
    },
  )

  test.prop([sessionTermsArb])(
    'checkI3(s, []): 空 history 時 missing 為所有 off entry 的 valid ids',
    (s) => {
      const missing = checkI3(s, [])
      const expected = [...offIds(s)]
      expect(new Set(missing)).toEqual(new Set(expected))
    },
  )
})

// ============================================================
// 組合性質：markEntriesOffPure + pushManyToHistoryPure 後 I3 必成立
// ============================================================

describe('組合性質', () => {
  test.prop([sessionTermsArb, historyArb, fc.array(fc.nat(), { maxLength: 3 })])(
    'markEntriesOff(s, ids) + pushManyToHistory(被 off 的 entries, h, newS) → I3 成立',
    (s, h, indexSeed) => {
      // 取 s 中一些 active entries 來 off
      const activeEntries = s.filter(c => c.active)
      const targetEntries = indexSeed
        .map(i => activeEntries[i % Math.max(activeEntries.length, 1)])
        .filter((x): x is TermEntry => !!x)
      if (targetEntries.length === 0) return
      const idsToOff = new Set(targetEntries.map(e => tokenIdentity(e.positive)).filter((x): x is string => !!x))

      const newSessionTerms = markEntriesOffPure(s, idsToOff)
      const { history: newHistory } = pushManyToHistoryPure(targetEntries, h, newSessionTerms)

      // 驗 I3：所有 off entry 對應 ids 都在 newHistory 內
      const missing = checkI3(newSessionTerms, newHistory)
      // missing 內可能還有原本就 off 的 entries 沒被 push（在原 h 中也沒），
      // 所以只驗「targetEntries 對應的 ids 已在 newHistory 內」
      for (const e of targetEntries) {
        const id = tokenIdentity(e.positive)
        if (!id) continue
        const inHistory = newHistory.some(p => tokenIdentity(p) === id)
        expect(inHistory).toBe(true)
        // 對應的 missing 不該包含這個 id（被剛 push 進去）
        expect(missing).not.toContain(id)
      }
    },
  )
})
