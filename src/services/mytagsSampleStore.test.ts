import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SampleGallery } from '@/services/mytagsSamples'

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
} from '@/services/mytagsSampleStore'

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
