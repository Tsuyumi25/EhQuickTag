import { beforeEach, describe, expect, it, vi } from 'vitest'

const { storage, cacheGet, cacheSet, cacheKeys, cacheDelete } = vi.hoisted(() => {
  const values = new Map<string, string>()
  return {
    storage: values,
    cacheGet: vi.fn(async (key: string) => values.get(key) ?? null),
    cacheSet: vi.fn(async (key: string, value: string) => { values.set(key, value) }),
    cacheKeys: vi.fn(async (prefix: string) => [...values.keys()].filter((k) => k.startsWith(prefix))),
    cacheDelete: vi.fn(async (key: string) => { values.delete(key) }),
  }
})

vi.mock('@/services/gmStorage', () => ({ cacheGet, cacheSet, cacheKeys, cacheDelete }))

import { loadPick, parsePick, savePick, stalePicks, PICKS_LIMIT } from '@/services/mytags/mytagsPicks'

beforeEach(() => {
  storage.clear()
  vi.useRealTimers()
})

describe('stalePicks', () => {
  it('只留最近更新的幾筆，讀不出時間的最先清', () => {
    const entries = [
      { key: 'a', savedAt: 30 },
      { key: 'b', savedAt: 10 },
      { key: 'c', savedAt: null },
      { key: 'd', savedAt: 20 },
    ]
    expect(stalePicks(entries, 2).sort()).toEqual(['b', 'c'])
    expect(stalePicks(entries, 4)).toEqual([])
  })
})

describe('parsePick', () => {
  it('schema 不符、JSON 壞掉、欄位型別不對的都不收', () => {
    expect(parsePick('{')).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 0, tags: [], savedAt: 1 }))).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 1, tags: [3], savedAt: 1 }))).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 1, tags: [], savedAt: 'x' }))).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 1, tags: ['female:a'], savedAt: 1 })))
      .toEqual({ tags: ['female:a'], savedAt: 1 })
  })
})

describe('savePick / loadPick', () => {
  it('每本各自讀回自己的標籤，同一本再送一次就覆蓋，查不到的 gid 回空清單', async () => {
    await savePick(1, ['female:a'])
    await savePick(2, ['male:b', 'parody:c'])
    await savePick(1, ['other:d'])
    expect(await loadPick('1')).toEqual(['other:d'])
    expect(await loadPick('2')).toEqual(['male:b', 'parody:c'])
    expect(await loadPick('3')).toEqual([])
  })

  it('兩本同時送出不會互相蓋掉', async () => {
    await Promise.all([savePick(1, ['female:a']), savePick(2, ['male:b'])])
    expect(await loadPick('1')).toEqual(['female:a'])
    expect(await loadPick('2')).toEqual(['male:b'])
  })

  it('超過上限時清掉最舊的，剛送的一定留下', async () => {
    vi.useFakeTimers()
    for (let gid = 1; gid <= PICKS_LIMIT + 1; gid++) {
      vi.setSystemTime(gid * 1000)
      await savePick(gid, [`x:${gid}`])
    }
    expect(await loadPick('1')).toEqual([])
    expect(await loadPick(String(PICKS_LIMIT + 1))).toEqual([`x:${PICKS_LIMIT + 1}`])
    expect((await cacheKeys('eqt_mytags_pick:')).length).toBe(PICKS_LIMIT)
  })
})
