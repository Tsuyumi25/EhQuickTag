import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MyTagRow, TagSetSnapshot } from '@/composables/useEhMyTagsHost'

const { storage, cacheGet, cacheSet } = vi.hoisted(() => {
  const values = new Map<string, string>()
  return {
    storage: values,
    cacheGet: vi.fn(async (key: string) => values.get(key) ?? null),
    cacheSet: vi.fn(async (key: string, value: string) => { values.set(key, value) }),
  }
})

const { fetchTagSet, fetchTagSetIndex } = vi.hoisted(() => ({
  fetchTagSet: vi.fn(),
  fetchTagSetIndex: vi.fn(),
}))

vi.mock('@/services/gmStorage', () => ({ cacheGet, cacheSet }))
vi.mock('@/composables/useEhMyTagsHost', () => ({ fetchTagSet, fetchTagSetIndex }))

import {
  buildMyTagsPalette,
  loadMyTagsPalette,
  refreshMyTagsPalette,
  saveMyTagsPalette,
} from '@/services/mytags/mytagsPalette'

function row(full: string, color = ''): MyTagRow {
  return { id: full.length, full, weight: 10, hidden: false, watch: false, color, tagSet: '1' }
}

function set(value: string, rows: MyTagRow[], extra: Partial<TagSetSnapshot> = {}): TagSetSnapshot {
  return { value, name: value, enabled: true, defaultColor: '', rows, ...extra }
}

beforeEach(() => {
  storage.clear()
  vi.clearAllMocks()
})

describe('buildMyTagsPalette', () => {
  it('沒啟用的標籤集不上色，也不會擋住後面那組', () => {
    const palette = buildMyTagsPalette([
      set('1', [row('female:a', '#FF0000'), row('female:only', '#FF0000')], { enabled: false }),
      set('2', [row('female:a', '#00FF00')]),
    ])

    expect(Object.keys(palette)).toEqual(['female:a'])
    expect(palette['female:a']!.edge).toBe('00FF00')
  })

  it('重複的標籤由選單順序在前的那一組決定', () => {
    const first = set('1', [row('female:a', '#FF0000')])
    const second = set('2', [row('female:a', '#00FF00')])

    expect(buildMyTagsPalette([first, second])['female:a']!.edge).toBe('FF0000')
  })

  it('標籤沒設色時吃所屬標籤集的預設色', () => {
    const palette = buildMyTagsPalette([set('1', [row('female:a')], { defaultColor: '#FF0000' })])

    expect(palette['female:a']!.edge).toBe('FF0000')
  })
})

describe('loadMyTagsPalette', () => {
  it('快取命中就不碰網路，一個標籤都沒有的快取也算命中', async () => {
    await saveMyTagsPalette({})

    await expect(loadMyTagsPalette()).resolves.toEqual({})
    expect(fetchTagSetIndex).not.toHaveBeenCalled()
    expect(fetchTagSet).not.toHaveBeenCalled()
  })

  it('沒有快取時抓完所有標籤集並寫回，之後就直接讀快取', async () => {
    fetchTagSetIndex.mockResolvedValue({
      order: ['1', '2'],
      current: set('2', [row('female:a', '#0000FF'), row('female:b', '#00FF00')]),
    })
    fetchTagSet.mockResolvedValue(set('1', [row('female:a', '#FF0000')]))

    const palette = await loadMyTagsPalette()
    expect(fetchTagSet).toHaveBeenCalledWith('1')
    expect(palette['female:a']!.edge).toBe('FF0000')
    expect(palette['female:b']!.edge).toBe('00FF00')

    vi.clearAllMocks()
    await expect(loadMyTagsPalette()).resolves.toEqual(palette)
    expect(fetchTagSetIndex).not.toHaveBeenCalled()
  })

  it('壞掉的快取當成沒有快取', async () => {
    storage.set('eqt_mytags_palette', '{broken')
    fetchTagSetIndex.mockResolvedValue({ order: ['1'], current: set('1', [row('female:a', '#FF0000')]) })

    await expect(loadMyTagsPalette()).resolves.toEqual({
      'female:a': { text: 'f1f1f1', face: 'df0000', edge: 'FF0000' },
    })
  })

  it('不完整的快取要重抓，不能當成沒有個人配色', async () => {
    storage.set('eqt_mytags_palette', JSON.stringify({
      schema: 1,
      tags: { 'female:a': { face: 'FF0000' } },
    }))
    fetchTagSetIndex.mockResolvedValue({ order: ['1'], current: set('1', [row('female:a', '#00FF00')]) })

    expect((await loadMyTagsPalette())['female:a']!.edge).toBe('00FF00')
  })

  it('抓不到 /mytags 就 reject，不寫入任何快取', async () => {
    fetchTagSetIndex.mockResolvedValue(null)

    await expect(loadMyTagsPalette()).rejects.toThrow()
    expect(cacheSet).not.toHaveBeenCalled()
  })

  it('少抓到一組就整趟 reject，不留下缺一組的快取', async () => {
    fetchTagSetIndex.mockResolvedValue({
      order: ['1', '2', '3'],
      current: set('1', [row('female:a', '#FF0000')]),
    })
    fetchTagSet.mockImplementation(async (value: string) => (
      value === '2' ? set('2', [row('female:b', '#00FF00')]) : null
    ))

    await expect(loadMyTagsPalette()).rejects.toThrow()
    expect(cacheSet).not.toHaveBeenCalled()
  })

  it('重抓失敗時原本的完整快取留著', async () => {
    await saveMyTagsPalette({ 'female:a': { text: 'f1f1f1', face: 'df0000', edge: 'FF0000' } })
    fetchTagSetIndex.mockResolvedValue(null)

    await expect(refreshMyTagsPalette()).rejects.toThrow()
    await expect(loadMyTagsPalette()).resolves.toEqual({
      'female:a': { text: 'f1f1f1', face: 'df0000', edge: 'FF0000' },
    })
  })
})
