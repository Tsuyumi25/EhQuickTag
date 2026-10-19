import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'
import { createRule } from '@/services/listing/galleryRules'
import { RULE_SCHEMA } from '@/services/listing/ruleStorage'
import { useGalleryRuleStore } from '@/composables/useGalleryRuleStore'

const storage = vi.hoisted(() => ({
  raw: null as string | null,
  failWrites: false,
  listener: null as ((key: string, old: unknown, value: string | null, remote: boolean) => void) | null,
  mounted: [] as (() => unknown)[],
}))

vi.mock('vue', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue')>(),
  onMounted: (hook: () => unknown) => { storage.mounted.push(hook) },
  onBeforeUnmount: () => {},
}))
vi.mock('$', () => ({
  GM_addValueChangeListener: (_key: string, listener: NonNullable<typeof storage.listener>) => {
    storage.listener = listener
    return 1
  },
  GM_removeValueChangeListener: () => {},
}))
vi.mock('@/services/gmStorage', () => ({
  hasGM: true,
  cacheGet: async () => storage.raw,
  cacheSet: async (_key: string, raw: string) => {
    if (storage.failWrites) throw new Error('quota')
    storage.raw = raw
  },
}))

let scope: EffectScope

async function settle() {
  for (let i = 0; i < 6; i++) await nextTick()
}

async function openStore() {
  const store = scope.run(useGalleryRuleStore)!
  await Promise.all(storage.mounted.map(hook => hook()))
  await settle()
  return store
}

function remote(raw: string) {
  storage.raw = raw
  storage.listener!('eqt_gallery_rules', null, raw, true)
}

const stored = (name: string) => JSON.stringify({ schema: RULE_SCHEMA, rules: [{ ...createRule(1), name }] })

beforeEach(() => {
  scope = effectScope()
  storage.raw = stored('saved')
  storage.failWrites = false
  storage.listener = null
  storage.mounted = []
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})

describe('useGalleryRuleStore', () => {
  it('別的分頁存進讀不懂的格式後，這一頁的編輯不會把它蓋掉', async () => {
    const store = await openStore()
    const newer = JSON.stringify({ schema: RULE_SCHEMA + 1, rules: [{ future: true }] })
    remote(newer)
    store.rules.value[0].name = 'edited in old tab'
    await settle()
    expect(storage.raw).toBe(newer)
    expect(store.error.value).toBe('rulePage.loadFailed')
  })

  it('沒存成的編輯不會被別的分頁的版本蓋掉，下一次存成時寫出去', async () => {
    const store = await openStore()
    storage.failWrites = true
    store.rules.value[0].name = 'unsaved'
    await settle()
    remote(stored('other tab'))
    await settle()
    expect(store.rules.value[0].name).toBe('unsaved')
    expect(store.error.value).toBe('rulePage.saveFailed')

    storage.failWrites = false
    store.rules.value[0].name = 'retried'
    await settle()
    expect(JSON.parse(storage.raw!).rules[0].name).toBe('retried')
    expect(store.error.value).toBeNull()
  })

  it('讀不回來的規則不寫出去，存著的那份下次照樣載得進來', async () => {
    const saved = storage.raw
    const store = await openStore()
    store.rules.value[0].root.conditions.push({ id: 99, kind: 'rating', op: 'gte', value: 99 })
    await settle()
    expect(storage.raw).toBe(saved)
    expect(store.error.value).toBe('rulePage.saveFailed')
  })
})
