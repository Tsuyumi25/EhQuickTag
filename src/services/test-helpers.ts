import { fc } from '@fast-check/vitest'
import { tokenIdentity } from './tagState'
import type { TermEntry } from './search/sessionState'

// === Property test 共用 arbitraries ===
//
// tokenArb 模擬 E-hentai search syntax 的 token：optional prefix + optional
// namespace + tag body + optional suffix。三個 property test 檔共用，避免
// generator 分散在多檔導致 coverage 不對等。

export const tokenArb = fc.tuple(
  fc.constantFrom('', '-', '~'),
  fc.constantFrom('', 'female:', 'male:', 'language:', 'l:', 'a:'),
  fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
    minLength: 1,
    maxLength: 8,
  }),
  fc.constantFrom('', '$', '*'),
).map(([pre, ns, tag, suf]) => pre + ns + tag + suf)

export const tagsArb = fc.array(tokenArb, { minLength: 1, maxLength: 3 })
export const textArb = fc.array(tokenArb, { maxLength: 6 }).map(arr => arr.join(' '))

// sessionTerms 業務 invariant：每個 identity 在 entries 內至多出現一次。
// uniqueArray with selector=tokenIdentity 確保 generator 產出符合 invariant 的
// 合法 sessionTerms，避免「用非法 input 測性質」的假陽性
export const termEntryArb: fc.Arbitrary<TermEntry> = fc.record({
  positive: tokenArb,
  active: fc.boolean(),
})

export const sessionTermsArb = fc.uniqueArray(termEntryArb, {
  selector: e => tokenIdentity(e.positive) ?? Symbol('null-id'),
  maxLength: 5,
})

// 一般 history：長度可以遠小於 HISTORY_CAP（50）。
export const historyArb = fc.array(tokenArb, { maxLength: 10 })

// 長 history：確保 trim 邏輯被觸發（length > HISTORY_CAP）。
// 給 trim-specific property test 用，覆蓋 protected/unprotected slot 切換邏輯
export const longHistoryArb = fc.array(tokenArb, { minLength: 51, maxLength: 80 })
