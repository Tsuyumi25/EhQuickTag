import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import type { Prefix } from './searchSyntax'
import {
  parseRawText, serializeToken,
  cyclePrefix, cycleSuffix, nsToShort,
  applyPrefix, applyColonPrefix, applyTagValue,
  applyCycleSuffix, applyCycleNsFormat, applySuggestionPick,
  getColonPrefixValue,
  rowPrefersShort,
} from './searchTermState'
import { tokenArb } from './test-helpers'

const searchTermArb = tokenArb.map(parseRawText)

const prefixArb: fc.Arbitrary<Prefix> = fc.constantFrom(null, '-', '~')
// cycleSuffix 只在 null / $ / * 三者間 cycle，% 會被吸收到 null（單向）
const cycleableSuffixArb = fc.constantFrom(null, '$', '*')
const nsValueArb = fc.constantFrom('female', 'male', 'language', 'artist', 'group')
const colonValueArb = fc.oneof(
  fc.constant(''),
  fc.constantFrom('q:tag', 'q:weak', 'q:title', 'q:uploader'),
  nsValueArb.map(ns => `ns:${ns}`),
)

// ============================================================
// cyclePrefix / cycleSuffix
// ============================================================

describe('cyclePrefix / cycleSuffix', () => {
  test.prop([prefixArb])(
    'cyclePrefix 套 3 次回到原點',
    (p) => {
      expect(cyclePrefix(cyclePrefix(cyclePrefix(p)))).toBe(p)
    },
  )

  test.prop([cycleableSuffixArb])(
    'cycleSuffix 在 null/$/* 上套 3 次回到原點',
    (s) => {
      expect(cycleSuffix(cycleSuffix(cycleSuffix(s)))).toBe(s)
    },
  )

  test.prop([prefixArb])(
    'cyclePrefix 結果一定是合法 Prefix',
    (p) => {
      const next = cyclePrefix(p)
      expect([null, '-', '~']).toContain(next)
    },
  )
})

// ============================================================
// applyPrefix
// ============================================================

describe('applyPrefix', () => {
  test.prop([searchTermArb, prefixArb])(
    '結果的 prefix 等於傳入值',
    (token, p) => {
      expect(applyPrefix(token, p).prefix).toBe(p)
    },
  )

  test.prop([searchTermArb, prefixArb, prefixArb])(
    '兩次套用——last write wins',
    (token, p1, p2) => {
      expect(applyPrefix(applyPrefix(token, p1), p2).prefix).toBe(p2)
    },
  )

  test.prop([searchTermArb, prefixArb])(
    '只改 prefix，其他欄位（tag/namespace/suffix）不變',
    (token, p) => {
      const next = applyPrefix(token, p)
      expect(next.tag).toBe(token.tag)
      expect(next.namespace).toBe(token.namespace)
      expect(next.suffix).toBe(token.suffix)
      expect(next.qualifier).toBe(token.qualifier)
    },
  )
})

// ============================================================
// applyTagValue
// ============================================================

describe('applyTagValue', () => {
  test.prop([searchTermArb, fc.string({ maxLength: 20 })])(
    '結果的 tag 等於傳入值',
    (token, v) => {
      expect(applyTagValue(token, v).tag).toBe(v)
    },
  )

  test.prop([searchTermArb, fc.string({ maxLength: 20 })])(
    'quoted flag 跟「value 含空白」一致',
    (token, v) => {
      expect(applyTagValue(token, v).quoted).toBe(v.includes(' '))
    },
  )
})

// ============================================================
// applyCycleSuffix
// ============================================================

describe('applyCycleSuffix', () => {
  test.prop([searchTermArb])(
    '只改 suffix，其他欄位不變',
    (token) => {
      const next = applyCycleSuffix(token)
      expect(next.tag).toBe(token.tag)
      expect(next.prefix).toBe(token.prefix)
      expect(next.namespace).toBe(token.namespace)
    },
  )

  test('cycleable suffix 套 3 次回到原點', () => {
    for (const start of [null, '$', '*'] as const) {
      const token = parseRawText(start === null ? 'foo' : `foo${start}`)
      // 確保 parse 出來的 suffix 跟我們設定的一致才有意義
      if (token.suffix !== start) continue
      let t = token
      for (let i = 0; i < 3; i++) t = applyCycleSuffix(t)
      expect(t.suffix).toBe(start)
    }
  })
})

// ============================================================
// applyColonPrefix
// ============================================================

describe('applyColonPrefix', () => {
  test.prop([searchTermArb])(
    '空 value 清掉 qualifier / namespace / namespaceRaw',
    (token) => {
      const next = applyColonPrefix(token, '')
      expect(next.qualifier).toBeNull()
      expect(next.namespace).toBeNull()
      expect(next.namespaceRaw).toBeNull()
    },
  )

  test.prop([searchTermArb, fc.constantFrom('tag', 'weak', 'title', 'uploader')])(
    'q:xxx 設 qualifier、清 namespace',
    (token, q) => {
      const next = applyColonPrefix(token, `q:${q}`)
      expect(next.qualifier).toBe(q)
      expect(next.namespace).toBeNull()
      expect(next.namespaceRaw).toBeNull()
    },
  )

  test.prop([searchTermArb, nsValueArb])(
    'ns:xxx 設 namespace、清 qualifier',
    (token, ns) => {
      const next = applyColonPrefix(token, `ns:${ns}`)
      expect(next.namespace).toBe(ns)
      expect(next.qualifier).toBeNull()
    },
  )

  test.prop([searchTermArb, colonValueArb])(
    '只動 qualifier/namespace/namespaceRaw，其他不變',
    (token, value) => {
      const next = applyColonPrefix(token, value)
      expect(next.tag).toBe(token.tag)
      expect(next.prefix).toBe(token.prefix)
      expect(next.suffix).toBe(token.suffix)
    },
  )
})

// ============================================================
// applyCycleNsFormat
// ============================================================

describe('applyCycleNsFormat', () => {
  test.prop([searchTermArb])(
    'namespace 為 null 時 no-op',
    (token) => {
      fc.pre(token.namespace === null)
      expect(applyCycleNsFormat(token)).toEqual(token)
    },
  )

  // long-form 起點：parseRawText 對「ns:xxx」會解出 namespaceRaw === ns
  test.prop([nsValueArb, fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
    minLength: 1,
    maxLength: 8,
  })])(
    'namespace 有 short form 時，long-form 起點套兩次回到原樣',
    (ns, raw) => {
      const short = nsToShort(ns)
      fc.pre(!!short)
      const base = parseRawText(`${ns}:${raw}`)
      fc.pre(base.namespace !== null)
      const once = applyCycleNsFormat(base)
      const twice = applyCycleNsFormat(once)
      expect(twice.namespaceRaw).toBe(base.namespaceRaw)
    },
  )

  // short-form 起點：parseRawText 對「l:xxx」（alias 短碼）會解出
  // namespaceRaw === short，namespace === long form
  test.prop([fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
    minLength: 1,
    maxLength: 8,
  })])(
    'short-form 起點套兩次回到原樣（l: 開頭）',
    (raw) => {
      const base = parseRawText(`l:${raw}`)
      fc.pre(base.namespace !== null && base.namespaceRaw !== null)
      fc.pre(base.namespaceRaw !== base.namespace)  // 確認是 short form
      const once = applyCycleNsFormat(base)
      const twice = applyCycleNsFormat(once)
      expect(twice.namespaceRaw).toBe(base.namespaceRaw)
    },
  )
})

// ============================================================
// applySuggestionPick
// ============================================================

describe('applySuggestionPick', () => {
  test.prop([searchTermArb, nsValueArb, fc.string({ minLength: 1, maxLength: 10 })])(
    'namespace / tag / qualifier 套到傳入 entry',
    (token, ns, raw) => {
      const next = applySuggestionPick(token, { ns, raw })
      expect(next.namespace).toBe(ns)
      expect(next.tag).toBe(raw)
      expect(next.qualifier).toBeNull()
    },
  )

  test.prop([searchTermArb, nsValueArb, fc.string({ minLength: 1, maxLength: 10 })])(
    'defaultExactMatch=true (default) 且原 suffix=null → 補 $',
    (token, ns, raw) => {
      fc.pre(token.suffix === null)
      const next = applySuggestionPick(token, { ns, raw })
      expect(next.suffix).toBe('$')
    },
  )

  test.prop([searchTermArb, nsValueArb, fc.string({ minLength: 1, maxLength: 10 })])(
    'defaultExactMatch=false → 不補 suffix',
    (token, ns, raw) => {
      const next = applySuggestionPick(token, { ns, raw }, { defaultExactMatch: false })
      expect(next.suffix).toBe(token.suffix)
    },
  )
})

// ============================================================
// getColonPrefixValue
// ============================================================

// 用 applyColonPrefix 主動構造 qualifier token，因為 tokenArb 不會自然產生
// qualifier 形式（namespaceOptions 都是 ns 不是 q）
const qualifierTokenArb = fc.constantFrom('tag', 'weak', 'title', 'uploader').map(q =>
  applyColonPrefix(parseRawText('foo'), `q:${q}`),
)

describe('getColonPrefixValue', () => {
  test.prop([qualifierTokenArb])(
    'qualifier 設過 → 回 q:xxx',
    (token) => {
      expect(getColonPrefixValue(token)).toBe(`q:${token.qualifier}`)
    },
  )

  test.prop([searchTermArb])(
    'namespace 設過、無 qualifier → 回 ns:xxx',
    (token) => {
      fc.pre(!token.qualifier && !!token.namespace)
      expect(getColonPrefixValue(token)).toBe(`ns:${token.namespace}`)
    },
  )

  test.prop([searchTermArb])(
    '無 qualifier、無 namespace → 回空字串',
    (token) => {
      fc.pre(!token.qualifier && !token.namespace)
      expect(getColonPrefixValue(token)).toBe('')
    },
  )
})

// ============================================================
// rowPrefersShort
// ============================================================

describe('rowPrefersShort', () => {
  test.prop([searchTermArb])(
    'namespace 為 null 時跟著 defaultNsFormat 走',
    (token) => {
      fc.pre(!token.namespace)
      expect(rowPrefersShort(token, 'long')).toBe(false)
      expect(rowPrefersShort(token, 'short')).toBe(true)
    },
  )

  test.prop([searchTermArb])(
    'namespace = namespaceRaw（同 form）→ 永遠 false（不論 defaultNsFormat）',
    (token) => {
      fc.pre(!!token.namespace && token.namespace === token.namespaceRaw)
      expect(rowPrefersShort(token, 'long')).toBe(false)
      expect(rowPrefersShort(token, 'short')).toBe(false)
    },
  )

  test.prop([searchTermArb])(
    'namespace ≠ namespaceRaw（用 short alias）→ 永遠 true',
    (token) => {
      fc.pre(!!token.namespace && !!token.namespaceRaw && token.namespace !== token.namespaceRaw)
      expect(rowPrefersShort(token, 'long')).toBe(true)
      expect(rowPrefersShort(token, 'short')).toBe(true)
    },
  )
})

// ============================================================
// parseRawText / serializeToken round trip
// ============================================================

describe('parseRawText / serializeToken', () => {
  test.prop([tokenArb])(
    'parse → serialize → parse → serialize 之後 idempotent',
    (text) => {
      const first = serializeToken(parseRawText(text))
      const second = serializeToken(parseRawText(first))
      expect(second).toBe(first)
    },
  )
})
