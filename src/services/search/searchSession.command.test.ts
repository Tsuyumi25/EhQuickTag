import { describe, expect, beforeEach, vi } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { effectScope, ref, nextTick } from 'vue'
import { tokenIdentity } from '@/services/tagState'
import { tokenArb } from '@/services/test-helpers'

// === Mocks ===
// searchSession 依賴 gmStorage（persist） + store（enableHistory）。
// 測試環境用 in-memory mock，避免 GM/localStorage 副作用。

vi.mock('@/services/gmStorage', () => ({
  hasGM: false,
  hasGMXHR: false,
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
}))

vi.mock('@/services/store', async () => {
  const { ref } = await import('vue')
  return { enableHistory: ref(true) }
})

import {
  sessionTerms,
  history,
  bindSearchBar,
  dismissTerms,
  clearSearch,
  clearHistory,
  recordSubmitAndFlush,
  onRestoreHistory,
} from './searchSession'

// === Session test 環境 ===
//
// searchSession 是 module-level singleton；每個 test 前重置 ref + 在
// effectScope 內呼 bindSearchBar，讓 watch / onScopeDispose 有 scope 可掛。
// scope.stop() 在 test 結束時收尾。

let scope: ReturnType<typeof effectScope> | null = null
// searchText 用 ref 而非 let—— bindSearchBar 內 watch(opts.modelValue) 需要
// reactive deps 才會 fire。modelValue: () => searchText.value 讓 watch 追到。
const searchText = ref('')

function setupSession(initial = ''): void {
  searchText.value = initial
  scope = effectScope()
  scope.run(() => {
    bindSearchBar({
      modelValue: () => searchText.value,
      emitUpdate: (v) => { searchText.value = v },
    })
  })
}

function teardownSession(): void {
  scope?.stop()
  scope = null
  sessionTerms.value = []
  history.value = []
  searchText.value = ''
}

beforeEach(() => {
  // 每個 test 清乾淨，避免 module-level singleton 殘留
  sessionTerms.value = []
  history.value = []
  searchText.value = ''
})

// === I1 / I3 / I4 驗算 helper ===

function activeIds(): Set<string> {
  return new Set(
    sessionTerms.value.filter(c => c.active)
      .map(c => tokenIdentity(c.positive))
      .filter((x): x is string => !!x),
  )
}

function offIds(): Set<string> {
  return new Set(
    sessionTerms.value.filter(c => !c.active)
      .map(c => tokenIdentity(c.positive))
      .filter((x): x is string => !!x),
  )
}

function historyIds(): Set<string> {
  return new Set(
    history.value.map(p => tokenIdentity(p)).filter((x): x is string => !!x),
  )
}

function textIds(): Set<string> {
  return new Set(
    searchText.value.split(/\s+/).filter(Boolean)
      .map(p => tokenIdentity(p))
      .filter((x): x is string => !!x),
  )
}

function verifyInvariants(): void {
  const A = activeIds()
  const O = offIds()
  const H = historyIds()
  const T = textIds()

  // I1: A === T
  expect(A).toEqual(T)

  // I3: O ⊆ H（enableHistory=true 在 mock 內）
  for (const id of O) expect(H.has(id)).toBe(true)

  // I4: A ∩ O === ∅（by construction，entry.active 互斥）
  for (const id of A) expect(O.has(id)).toBe(false)
}

// ============================================================
// bindSearchBar 契約
// ============================================================

describe('bindSearchBar 契約', () => {
  test('在 effectScope 外呼叫 → throw', () => {
    expect(() => bindSearchBar({
      modelValue: () => '',
      emitUpdate: () => {},
    })).toThrow(/effect scope/)
  })

  test('在 effectScope 內呼叫 → OK', () => {
    const s = effectScope()
    expect(() => s.run(() => bindSearchBar({
      modelValue: () => '',
      emitUpdate: () => {},
    }))).not.toThrow()
    s.stop()
  })
})

// ============================================================
// 單一 command 後 invariant 成立
// ============================================================

describe('單一 command 後 invariant 成立', () => {
  test('dismissTerms 後 I1/I3/I4 成立', async () => {
    setupSession('foo$ bar$')
    dismissTerms(['foo$'])
    await nextTick()
    verifyInvariants()
    teardownSession()
  })

  test('clearSearch 後 I1/I3/I4 成立', async () => {
    setupSession('foo$ bar$')
    clearSearch()
    await nextTick()
    verifyInvariants()
    teardownSession()
  })

  test('clearHistory 後 I1/I3/I4 成立', async () => {
    setupSession('foo$ bar$')
    clearSearch()         // 把它們踢進 history（O ⊆ H）
    await nextTick()
    clearHistory()        // 清掉 H \ O → O 部分被保留
    await nextTick()
    verifyInvariants()
    teardownSession()
  })

  test('recordSubmitAndFlush 後 I1/I3/I4 成立', async () => {
    setupSession('foo$ bar$')
    await recordSubmitAndFlush()
    await nextTick()
    verifyInvariants()
    teardownSession()
  })

  test('onRestoreHistory 後 I1/I3/I4 成立', async () => {
    setupSession('foo$')
    clearSearch()         // foo$ 變 off entry + 進 H
    await nextTick()
    onRestoreHistory('bar$')
    await nextTick()
    verifyInvariants()
    teardownSession()
  })
})

// ============================================================
// 隨機 command 序列下 invariant 永遠成立（fc.commands-like）
// ============================================================

describe('隨機 command 序列', () => {
  type Command =
    | { kind: 'dismiss'; positives: string[] }
    | { kind: 'clearSearch' }
    | { kind: 'clearHistory' }
    | { kind: 'recordSubmit' }
    | { kind: 'setText'; text: string }

  const commandArb: fc.Arbitrary<Command> = fc.oneof(
    fc.array(tokenArb, { minLength: 1, maxLength: 2 }).map(positives => ({ kind: 'dismiss' as const, positives })),
    fc.constant({ kind: 'clearSearch' as const }),
    fc.constant({ kind: 'clearHistory' as const }),
    fc.constant({ kind: 'recordSubmit' as const }),
    fc.array(tokenArb, { maxLength: 4 }).map(arr => ({ kind: 'setText' as const, text: arr.join(' ') })),
  )

  test.prop([
    fc.array(tokenArb, { maxLength: 4 }).map(arr => arr.join(' ')),
    fc.array(commandArb, { maxLength: 8 }),
  ])(
    '任意 command 序列後 I1/I3/I4 都成立',
    async (initialText, commands) => {
      setupSession(initialText)
      try {
        for (const cmd of commands) {
          switch (cmd.kind) {
            case 'dismiss':
              dismissTerms(cmd.positives)
              break
            case 'clearSearch':
              clearSearch()
              break
            case 'clearHistory':
              clearHistory()
              break
            case 'recordSubmit':
              await recordSubmitAndFlush()
              break
            case 'setText':
              searchText.value = cmd.text
              break
          }
          // 每個 command 後 await nextTick 讓 watch 觸發 syncFromSearch，
          // 再驗 I1/I3/I4
          await nextTick()
          verifyInvariants()
        }
      } finally {
        teardownSession()
      }
    },
  )
})
