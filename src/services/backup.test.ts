import { beforeEach, describe, expect, it, vi } from 'vitest'
import { test, fc } from '@fast-check/vitest'

const { storage } = vi.hoisted(() => {
  // backup 透過 store 取得 key 常數；store 連帶載入的 tagDb 在模組頂層就 new DOMParser()
  globalThis.DOMParser ??= class {} as typeof DOMParser
  return { storage: new Map<string, string>() }
})

vi.mock('$', () => ({ GM: {}, GM_addValueChangeListener: () => 0, GM_removeValueChangeListener: () => {} }))
vi.mock('@/services/gmStorage', () => ({
  hasGM: false,
  hasGMXHR: false,
  cacheGet: async (key: string) => storage.get(key) ?? null,
  cacheSet: async (key: string, value: string) => { storage.set(key, value) },
  cacheKeys: async (prefix: string) => [...storage.keys()].filter((key) => key.startsWith(prefix)),
  cacheDelete: async (key: string) => { storage.delete(key) },
}))

import { BackupError, decodeBackup, exportBackup, restoreBackup } from '@/services/backup'

const USER_KEYS = [
  'eqt_profiles',
  'eqt_profiles_corrupted',
  'eqt_settings',
  'eqt_gallery_rules',
  'eqt-search-history',
  'eqt_mytags_edit:12',
  'eqt_mytags_edit_base:12',
  'eqt_mytags_verdict:345',
  'eqt_mytags_samples_generation',
  'eqt_mytags_gallery~k3x9:345',
  'eqt_mytags_gallery~0_base:678',
] as const

const DISPOSABLE = {
  eqt_tag_db_v3: '[]',
  eqt_tag_db_v3_ts: '1700000000000',
  eqt_mytags_palette: '{"schema":3,"tags":{}}',
  'eqt_pick:abc': '{"schema":2,"terms":[],"savedAt":1}',
}

beforeEach(() => storage.clear())

async function roundTrip(): Promise<void> {
  const text = await exportBackup(new Date('2026-01-02T03:04:05Z'))
  storage.clear()
  await restoreBackup(decodeBackup(text))
}

describe('backup', () => {
  test.prop([fc.dictionary(fc.constantFrom(...USER_KEYS), fc.oneof(fc.string(), fc.json(), fc.jsonValue().map(v => JSON.stringify(v))))])(
    '匯出再匯入，每個使用者資料 key 的原字串一字不差',
    async (values) => {
      storage.clear()
      for (const [key, value] of Object.entries(values)) storage.set(key, value)
      const before = new Map(storage)
      await roundTrip()
      expect(storage).toEqual(before)
    },
  )

  it('看起來像數字的樣本世代代號不被正規化，以它為前綴的樣本還找得到', async () => {
    storage.set('eqt_mytags_samples_generation', '1e5')
    storage.set('eqt_mytags_gallery~1e5:9', '{"schema":2,"value":{}}')
    await roundTrip()
    expect(storage.get('eqt_mytags_samples_generation')).toBe('1e5')
    expect(storage.has('eqt_mytags_gallery~1e5:9')).toBe(true)
  })

  it('下載的快取與暫存選取不進備份，匯入時也不動它們', async () => {
    storage.set('eqt_profiles', '{"active":0,"profiles":[]}')
    for (const [key, value] of Object.entries(DISPOSABLE)) storage.set(key, value)
    const text = await exportBackup()
    expect(Object.keys(JSON.parse(text).data)).toEqual(['eqt_profiles'])

    storage.set('eqt_tag_db_v3', '["newer download"]')
    await restoreBackup(decodeBackup(text))
    expect(storage.get('eqt_tag_db_v3')).toBe('["newer download"]')
    expect(storage.get('eqt_pick:abc')).toBe(DISPOSABLE['eqt_pick:abc'])
  })

  it('匯入是取代：備份裡沒有的使用者資料會被清掉', async () => {
    storage.set('eqt_settings', '{"fontFamily":"a"}')
    const text = await exportBackup()
    storage.set('eqt_gallery_rules', '{"schema":1,"rules":[]}')
    storage.set('eqt_mytags_edit:7', '{"schema":2,"value":{"weight":5}}')
    storage.set('eqt_settings', '{"fontFamily":"b"}')

    await restoreBackup(decodeBackup(text))
    expect(Object.fromEntries(storage)).toEqual({ eqt_settings: '{"fontFamily":"a"}' })
  })

  it.each([
    ['不是 JSON', '{', 'invalid'],
    ['其他程式的 JSON', '{"profiles":[]}', 'invalid'],
    ['新版插件的備份', '{"format":"eh-quick-tag-backup","version":2,"exportedAt":"","data":{}}', 'newer'],
    ['沒有 data', '{"format":"eh-quick-tag-backup","version":1,"exportedAt":""}', 'invalid'],
    ['夾帶不認得的 key', '{"format":"eh-quick-tag-backup","version":1,"exportedAt":"","data":{"eqt_tag_db_v3":[]}}', 'invalid'],
  ])('拒絕%s', (_name, text, reason) => {
    expect(() => decodeBackup(text)).toThrow(BackupError)
    try { decodeBackup(text) } catch (e) { expect((e as BackupError).reason).toBe(reason) }
  })
})
