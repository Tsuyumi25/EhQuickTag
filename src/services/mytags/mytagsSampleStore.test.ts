import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SampleGallery } from '@/services/mytags/mytagsSamples'

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

import { createSampleStore, clearSamples } from '@/services/mytags/mytagsSampleStore'

const gallery: SampleGallery = {
  gid: 1,
  token: 'token',
  title: 'sample',
  category: 'Misc',
  thumb: 'https://example.invalid/thumb',
  tags: [],
}
const other: SampleGallery = { ...gallery, gid: 2, title: 'other' }

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
})

describe('mytags sample persistence', () => {
  it('清除一般與已刪除樣本，保留人工判斷及其他儲存資料', async () => {
    const store = createSampleStore()
    await store.load()
    await store.saveGalleries({ 1: gallery, 2: { ...other, expunged: true } })
    await store.saveVerdicts({ 1: 'keep', 2: 'block' })
    storage.set('eqt_mytags_edit:7', 'pending edits')

    await clearSamples()

    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: {},
      verdicts: { 1: 'keep', 2: 'block' },
    })
    expect(storage.get('eqt_mytags_edit:7')).toBe('pending edits')
    expect([...storage.keys()].filter((key) => key.startsWith('eqt_mytags_gallery~'))).toEqual([])
  })

  it('清除時還沒寫完的樣本落在作廢的世代，不會事後補回來', async () => {
    const store = createSampleStore()
    await store.load()
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    cacheSet.mockImplementationOnce(async (key, value) => {
      started.resolve()
      await release.promise
      storage.set(key, value)
    })

    const saving = store.saveGalleries({ 1: gallery })
    await started.promise
    await clearSamples()
    release.resolve()
    await saving

    expect((await createSampleStore().load()).galleries).toEqual({})
  })

  it('清除前排隊尚未開始的樣本也留在作廢世代', async () => {
    const store = createSampleStore()
    await store.load()
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    cacheSet.mockImplementationOnce(async (key, value) => {
      started.resolve()
      await release.promise
      storage.set(key, value)
    })
    const first = store.saveGalleries({ 1: gallery })
    await started.promise
    const queued = store.saveGalleries({ 1: gallery, 2: other })
    await clearSamples()
    release.resolve()
    await Promise.all([first, queued])
    expect((await createSampleStore().load()).galleries).toEqual({})
  })

  it('重疊清除不會刪掉後一次清除完成後新抓的樣本', async () => {
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    cacheDelete.mockImplementationOnce(async (key) => {
      started.resolve()
      await release.promise
      storage.delete(key)
    })
    const firstClear = clearSamples()
    await started.promise
    await clearSamples()
    const fresh = createSampleStore()
    await fresh.load()
    await fresh.saveGalleries({ 2: other })
    release.resolve()
    await firstClear
    expect((await createSampleStore().load()).galleries).toEqual({ 2: other })
  })

  it('清除已換代但舊表尚未刪完時，載入不能把舊樣本搬進新世代', async () => {
    storage.set('eqt_mytags_galleries', JSON.stringify({ schema: 1, galleries: { 1: gallery } }))
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    cacheDelete.mockImplementationOnce(async (key) => {
      started.resolve()
      await release.promise
      storage.delete(key)
    })
    const clearing = clearSamples()
    await started.promise
    const loaded = await createSampleStore().load()
    release.resolve()
    await clearing
    expect(loaded.galleries).toEqual({})
    expect((await createSampleStore().load()).galleries).toEqual({})
  })

  it('兩個面板依序標記不同畫廊，人工判斷都能重新載入', async () => {
    const first = createSampleStore()
    const second = createSampleStore()
    await Promise.all([first.load(), second.load()])
    await first.saveVerdicts({ 1: 'keep' })
    await second.saveVerdicts({ 2: 'block' })
    expect((await createSampleStore().load()).verdicts).toEqual({ 1: 'keep', 2: 'block' })
  })

  it('清除之後，舊樣本不會被面板的下一次存檔重貼，新抓的照常存', async () => {
    const store = createSampleStore()
    await store.load()
    await store.saveGalleries({ 1: gallery })

    await clearSamples()
    await store.saveGalleries({ 1: gallery, 2: other })

    expect((await createSampleStore().load()).galleries).toEqual({ 2: other })
  })

  it('兩個面板各存各的樣本，後存的不會蓋掉先存的', async () => {
    const first = createSampleStore()
    const second = createSampleStore()
    await Promise.all([first.load(), second.load()])

    await first.saveGalleries({ 1: gallery })
    await second.saveGalleries({ 2: other })

    expect((await createSampleStore().load()).galleries).toEqual({ 1: gallery, 2: other })
  })

  it('一邊標判斷、一邊抓樣本，兩邊都留著', async () => {
    const judging = createSampleStore()
    const fetching = createSampleStore()
    await Promise.all([judging.load(), fetching.load()])

    await judging.saveVerdicts({ 1: 'block' })
    await fetching.saveGalleries({ 1: gallery })

    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: { 1: gallery },
      verdicts: { 1: 'block' },
    })
  })

  it('移掉一本不會動到另一個面板存的樣本', async () => {
    const first = createSampleStore()
    await first.load()
    await first.saveGalleries({ 1: gallery, 2: other })

    const second = createSampleStore()
    await second.load()
    await second.saveGalleries({ 1: gallery })

    expect((await createSampleStore().load()).galleries).toEqual({ 1: gallery })
  })

  it('搬遷舊版整份表，搬完才刪掉舊 key', async () => {
    storage.set('eqt_mytags_galleries', JSON.stringify({ schema: 1, galleries: { 1: gallery } }))
    storage.set('eqt_mytags_verdicts', JSON.stringify({ schema: 1, verdicts: { 1: 'keep' } }))

    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: { 1: gallery },
      verdicts: { 1: 'keep' },
    })
    expect(storage.has('eqt_mytags_galleries')).toBe(false)
    expect(storage.has('eqt_mytags_verdicts')).toBe(false)
    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: { 1: gallery },
      verdicts: { 1: 'keep' },
    })
  })

  it('清除會連舊版整份表一起丟掉，樣本不會在下次載入時復活', async () => {
    storage.set('eqt_mytags_galleries', JSON.stringify({ schema: 1, galleries: { 1: gallery } }))
    storage.set('eqt_mytags_verdicts', JSON.stringify({ schema: 1, verdicts: { 1: 'keep' } }))

    await clearSamples()

    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: {},
      verdicts: { 1: 'keep' },
    })
  })

  it('壞掉的單筆只影響自己', async () => {
    const store = createSampleStore()
    await store.load()
    await store.saveGalleries({ 1: gallery, 2: other })
    const broken = [...storage.keys()].find((key) => key.endsWith(':2'))
    storage.set(broken!, '{broken')

    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: { 1: gallery },
      verdicts: {},
    })
  })

  it('已刪除樣本與沒有狀態的舊樣本能共同保存，人工判斷不變', async () => {
    const store = createSampleStore()
    await store.load()
    await store.saveGalleries({
      1: gallery,
      2: { ...other, expunged: true },
      3: { ...gallery, gid: 3, expunged: false },
    })
    await store.saveVerdicts({ 1: 'keep', 2: 'block' })

    const loaded = await createSampleStore().load()
    expect(Object.keys(loaded.galleries).sort()).toEqual(['1', '2', '3'])
    expect(Object.values(loaded.galleries).filter((item) => item.expunged === true).map((item) => item.gid))
      .toEqual([2])
    expect(loaded.verdicts).toEqual({ 1: 'keep', 2: 'block' })
  })

  it('讀不懂的舊表原地保留，不當成空資料刪掉', async () => {
    storage.set('eqt_mytags_galleries', JSON.stringify({ schema: 99, galleries: { 1: gallery } }))
    storage.set('eqt_mytags_verdicts', '{broken')

    await expect(createSampleStore().load()).resolves.toEqual({ galleries: {}, verdicts: {} })
    expect(storage.has('eqt_mytags_galleries')).toBe(true)
    expect(storage.has('eqt_mytags_verdicts')).toBe(true)
  })

  it('搬遷寫不進去就不刪舊表，資料不會兩頭落空', async () => {
    storage.set('eqt_mytags_galleries', JSON.stringify({ schema: 1, galleries: { 1: gallery } }))
    cacheSet.mockRejectedValueOnce(new Error('quota exceeded'))

    await expect(createSampleStore().load()).rejects.toThrow('quota exceeded')
    expect(storage.has('eqt_mytags_galleries')).toBe(true)

    await expect(createSampleStore().load()).resolves.toEqual({
      galleries: { 1: gallery },
      verdicts: {},
    })
  })
})
