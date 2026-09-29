import { beforeEach, describe, expect, it, vi } from 'vitest'

const { storage, cacheGet, cacheSet, cacheKeys, cacheDelete } = vi.hoisted(() => {
  const values = new Map<string, string>()
  return {
    storage: values,
    cacheGet: vi.fn(async (key: string) => values.get(key) ?? null),
    cacheSet: vi.fn(async (key: string, value: string) => { values.set(key, value) }),
    cacheKeys: vi.fn(async (prefix: string) => [...values.keys()].filter((key) => key.startsWith(prefix))),
    cacheDelete: vi.fn(async (key: string) => { values.delete(key) }),
  }
})

vi.mock('@/services/gmStorage', () => ({ cacheGet, cacheSet, cacheKeys, cacheDelete }))

import { createEditStore } from '@/services/mytags/mytagsEditStore'

const LEGACY_KEY = 'eqt_mytags_edits'

function legacy(edits: Record<string, unknown>): string {
  return JSON.stringify({ schema: 1, edits })
}

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
})

describe('mytags edit persistence', () => {
  it('兩個面板各改各的標籤，後存的不會蓋掉先存的', async () => {
    const first = createEditStore()
    const second = createEditStore()
    await Promise.all([first.load(), second.load()])

    await first.save({ 1: { weight: 5 } })
    await second.save({ 2: { hidden: true } })

    await expect(createEditStore().load()).resolves.toEqual({
      1: { weight: 5 },
      2: { hidden: true },
    })
  })

  it('一邊丟掉自己的草稿，不會連另一邊的一起丟', async () => {
    const first = createEditStore()
    await first.load()
    await first.save({ 1: { weight: 5 } })

    const second = createEditStore()
    await second.load()
    await second.save({ 1: { weight: 5 }, 2: { watch: true } })
    await second.save({ 2: { watch: true } })

    await expect(createEditStore().load()).resolves.toEqual({ 2: { watch: true } })
  })

  it('搬遷舊版整份表，搬完才刪掉舊 key，重新載入還在', async () => {
    storage.set(LEGACY_KEY, legacy({
      1: { weight: -30, color: '#abcdef' },
      2: { destination: { full: 'female:example', tagSet: '2' } },
    }))

    await expect(createEditStore().load()).resolves.toEqual({
      1: { weight: -30, color: '#abcdef' },
      2: { destination: { full: 'female:example', tagSet: '2' } },
    })
    expect(storage.has(LEGACY_KEY)).toBe(false)

    await expect(createEditStore().load()).resolves.toEqual({
      1: { weight: -30, color: '#abcdef' },
      2: { destination: { full: 'female:example', tagSet: '2' } },
    })
  })

  it('搬遷寫不進去就不刪舊表，下次載入重來一次', async () => {
    storage.set(LEGACY_KEY, legacy({ 1: { weight: 5 } }))
    cacheSet.mockRejectedValueOnce(new Error('quota exceeded'))

    await expect(createEditStore().load()).rejects.toThrow('quota exceeded')
    expect(storage.has(LEGACY_KEY)).toBe(true)

    await expect(createEditStore().load()).resolves.toEqual({ 1: { weight: 5 } })
  })

  it('慢半拍的搬遷不能復活已經刪掉的草稿，也不能蓋回改過的值', async () => {
    const table = legacy({ 1: { weight: 5 }, 2: { hidden: true } })
    storage.set(LEGACY_KEY, table)
    const store = createEditStore()
    await store.load()

    await store.save({ 1: { weight: 9 } })
    // 另一個分頁在舊表被刪掉之前就讀走了，晚一步才把它搬進來
    storage.set(LEGACY_KEY, table)

    await expect(createEditStore().load()).resolves.toEqual({ 1: { weight: 9 } })
  })

  it('存檔失敗要往外丟，失敗的那筆下次存檔會重送', async () => {
    const store = createEditStore()
    await store.load()
    cacheSet.mockRejectedValueOnce(new Error('quota exceeded'))

    await expect(store.save({ 1: { weight: 5 }, 2: { watch: true } })).rejects.toThrow(AggregateError)
    await expect(createEditStore().load()).resolves.toEqual({ 2: { watch: true } })

    await store.save({ 1: { weight: 5 }, 2: { watch: true } })
    await expect(createEditStore().load()).resolves.toEqual({
      1: { weight: 5 },
      2: { watch: true },
    })
  })

  it('壞掉的單筆只影響自己', async () => {
    const store = createEditStore()
    await store.load()
    await store.save({ 1: { weight: 5 }, 2: { watch: true } })
    storage.set('eqt_mytags_edit:2', '{broken')

    await expect(createEditStore().load()).resolves.toEqual({ 1: { weight: 5 } })
  })

  it('搬遷時丟掉格式不對的項目', async () => {
    storage.set(LEGACY_KEY, legacy({
      1: { weight: 5 },
      2: {},
      3: { weight: 'heavy' },
      4: { weight: 5, unknown: true },
      5: { destination: { full: '', tagSet: '2' } },
      6: { destination: { full: 'female:example', tagSet: '2' } },
      abc: { weight: 5 },
    }))

    await expect(createEditStore().load()).resolves.toEqual({
      1: { weight: 5 },
      6: { destination: { full: 'female:example', tagSet: '2' } },
    })
  })

  it('讀不懂的舊表原地保留，不當成空資料刪掉', async () => {
    storage.set(LEGACY_KEY, JSON.stringify({ schema: 99, edits: { 1: { weight: 5 } } }))

    await expect(createEditStore().load()).resolves.toEqual({})
    expect(storage.has(LEGACY_KEY)).toBe(true)
  })
})
