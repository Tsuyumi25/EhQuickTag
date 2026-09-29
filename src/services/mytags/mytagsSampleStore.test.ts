import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SampleGallery } from '@/services/mytags/mytagsSamples'

const { storage, cacheGet, cacheSet } = vi.hoisted(() => {
  const values = new Map<string, string>()
  return {
    storage: values,
    cacheGet: vi.fn(async (key: string) => values.get(key) ?? null),
    cacheSet: vi.fn(async (key: string, value: string) => { values.set(key, value) }),
  }
})

vi.mock('@/services/gmStorage', () => ({ cacheGet, cacheSet }))

import {
  loadSamples,
  saveGalleries,
  saveVerdicts,
  clearSamples,
} from '@/services/mytags/mytagsSampleStore'

const gallery: SampleGallery = {
  gid: 1,
  token: 'token',
  title: 'sample',
  category: 'Misc',
  thumb: 'https://example.invalid/thumb',
  tags: [],
}

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
})

describe('mytags sample persistence', () => {
  it('清除一般與已刪除樣本，保留人工判斷及其他儲存資料', async () => {
    await saveGalleries({ 1: gallery, 2: { ...gallery, gid: 2, expunged: true } })
    await saveVerdicts({ 1: 'keep', 2: 'block' })
    storage.set('eqt_mytags_edits', 'pending edits')
    await clearSamples()
    await expect(loadSamples()).resolves.toEqual({
      galleries: {},
      verdicts: { 1: 'keep', 2: 'block' },
    })
    expect(storage.get('eqt_mytags_edits')).toBe('pending edits')
  })

  it('清除會等先前的樣本寫入完成，舊快照不能在清除後回填', async () => {
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    cacheSet.mockImplementationOnce(async (key, value) => {
      started.resolve()
      await release.promise
      storage.set(key, value)
    })
    const saving = saveGalleries({ 1: gallery })
    await started.promise
    const clearing = clearSamples()
    release.resolve()
    await Promise.all([saving, clearing])
    expect((await loadSamples()).galleries).toEqual({})
  })

  it('galleries 與 verdicts 各自寫入自己的 key', async () => {
    await saveGalleries({ 1: gallery })
    expect([...storage.keys()]).toEqual(['eqt_mytags_galleries'])

    await saveVerdicts({ 1: 'keep' })
    expect([...storage.keys()]).toEqual([
      'eqt_mytags_galleries',
      'eqt_mytags_verdicts',
    ])
  })

  it('從兩個 key 合成 SampleStore', async () => {
    storage.set('eqt_mytags_galleries', JSON.stringify({
      schema: 1,
      galleries: { 1: gallery },
    }))
    storage.set('eqt_mytags_verdicts', JSON.stringify({
      schema: 1,
      verdicts: { 1: 'keep' },
    }))

    await expect(loadSamples()).resolves.toEqual({
      galleries: { 1: gallery },
      verdicts: { 1: 'keep' },
    })
  })

  it('已刪除樣本與沒有狀態的舊樣本能共同保存，人工判斷不變', async () => {
    await saveGalleries({
      1: gallery,
      2: { ...gallery, gid: 2, expunged: true },
      3: { ...gallery, gid: 3, expunged: false },
    })
    await saveVerdicts({ 1: 'keep', 2: 'block' })
    const loaded = await loadSamples()
    expect(Object.keys(loaded.galleries)).toEqual(['1', '2', '3'])
    expect(Object.values(loaded.galleries).filter((item) => item.expunged === true).map((item) => item.gid))
      .toEqual([2])
    expect(loaded.verdicts).toEqual({ 1: 'keep', 2: 'block' })
  })

  it('其中一個 key 損壞時仍載入另一個', async () => {
    storage.set('eqt_mytags_galleries', '{broken')
    storage.set('eqt_mytags_verdicts', JSON.stringify({
      schema: 1,
      verdicts: { 1: 'block' },
    }))

    await expect(loadSamples()).resolves.toEqual({
      galleries: {},
      verdicts: { 1: 'block' },
    })
  })
})
