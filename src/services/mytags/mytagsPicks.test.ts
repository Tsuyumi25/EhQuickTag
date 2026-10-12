import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { loadPick, parsePick, pickTags, pickUrl, savePick, stalePicks, PICKS_LIMIT } from '@/services/mytags/mytagsPicks'

beforeEach(() => {
  storage.clear()
  vi.useRealTimers()
})

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

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
    expect(parsePick(JSON.stringify({ schema: 1, tags: [], savedAt: 1 }))).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 2, terms: [3], savedAt: 1 }))).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 2, terms: [], savedAt: 'x' }))).toBeNull()
    expect(parsePick('{"schema":2,"terms":[],"savedAt":1e999}')).toBeNull()
    expect(parsePick(JSON.stringify({ schema: 2, terms: ['female:sample'], savedAt: 1 })))
      .toEqual({ terms: ['female:sample'], savedAt: 1 })
  })
})

describe('savePick / loadPick', () => {
  it('每次保存各自取得短 ID，還原搜尋詞的順序與狀態', async () => {
    const terms = ['-f:"some tag$"', '~p:sample$', 'male:sample']
    const first = await savePick(terms)
    const second = await savePick(['other:sample'])
    const repeated = await savePick(terms)
    expect(first).toMatch(/^[A-Za-z0-9_-]{12}$/)
    expect(new Set([first, second, repeated]).size).toBe(3)
    expect((await loadPick(first))?.terms).toEqual(terms)
    expect((await loadPick(second))?.terms).toEqual(['other:sample'])
    expect((await loadPick(repeated))?.terms).toEqual(terms)
    expect(await loadPick('missing')).toBeNull()
  })

  it('碰到已存在的 ID 時重取，不覆蓋原快照', async () => {
    const random = vi.spyOn(crypto, 'getRandomValues')
      .mockReturnValueOnce(new Uint8Array(12).fill(0))
      .mockReturnValueOnce(new Uint8Array(12).fill(0))
      .mockReturnValueOnce(new Uint8Array(12).fill(1))
    const first = await savePick(['female:sample'])
    const second = await savePick(['male:sample'])
    expect(first).not.toBe(second)
    expect((await loadPick(first))?.terms).toEqual(['female:sample'])
    expect((await loadPick(second))?.terms).toEqual(['male:sample'])
    random.mockRestore()
  })

  it('同時送出不同選取，各自仍能讀回', async () => {
    const [first, second] = await Promise.all([savePick(['female:sample']), savePick(['male:sample'])])
    expect((await loadPick(first))?.terms).toEqual(['female:sample'])
    expect((await loadPick(second))?.terms).toEqual(['male:sample'])
  })

  it.each([false, true])('有上限地清掉舊快照，剛送的一定留下（相同時間：%s）', async (sameTime) => {
    vi.useFakeTimers()
    const ids: string[] = []
    for (let i = 1; i <= PICKS_LIMIT + 1; i++) {
      vi.setSystemTime(sameTime ? 1000 : i * 1000)
      ids.push(await savePick([`other:sample${i}`]))
    }
    if (!sameTime) expect(await loadPick(ids[0])).toBeNull()
    expect((await loadPick(ids[PICKS_LIMIT]))?.terms).toEqual([`other:sample${PICKS_LIMIT + 1}`])
    expect((await cacheKeys('eqt_pick:')).length).toBe(PICKS_LIMIT)
  })
})

describe('快照的 My Tags 投影', () => {
  it('保留 tag 身份，移除修飾符、展開 namespace，合併重複身份並略過一般搜尋詞', () => {
    expect(pickTags([
      '-f:"some tag$"', '~p:sample$', 'female:"some tag*"',
      'title:sample', 'gid:123', 'free text', 'other:sample',
    ])).toEqual(['female:some tag', 'parody:sample', 'other:sample'])
  })

  it('快照留在同站 fragment，原生 query 不接收快照參數', () => {
    const url = new URL(pickUrl('https://exhentai.org', '7kQ2mN9xR4vB'))
    expect(url.origin).toBe('https://exhentai.org')
    expect(url.pathname).toBe('/mytags')
    expect(url.search).toBe('')
    expect(url.hash).toBe('#eqt_hash=7kQ2mN9xR4vB')
  })
})
