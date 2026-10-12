import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { cacheGet } from '@/services/gmStorage'
import { useMyTagsSource } from '@/composables/useMyTagsSource'
import { fetchGallery, type GalleryDetail } from '@/composables/useEhGalleryPreview'

vi.mock('@/services/gmStorage', () => ({
  cacheGet: vi.fn(), cacheSet: vi.fn(), cacheKeys: vi.fn(), cacheDelete: vi.fn(),
}))
vi.mock('@/composables/useEhGalleryPreview', () => ({ fetchGallery: vi.fn() }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function snapshot(terms: string[]): string {
  return JSON.stringify({ schema: 2, terms, savedAt: 1 })
}

function gallery(gid: number, fullTags: string[]): GalleryDetail {
  return {
    gid, token: '0123456789', title: 'sample', titleJp: '', category: '', uploader: '',
    coverStyle: '', rating: '', facts: [], thumbs: [],
    tags: fullTags.map(full => ({ full, tier: 'gt' })),
  }
}

const scopes: EffectScope[] = []
function source(initial = '#eqt_hash=first') {
  const scope = effectScope()
  scopes.push(scope)
  const hash = ref(initial)
  return { ...scope.run(() => useMyTagsSource(hash))!, hash, stop: () => scope.stop() }
}

async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.resetAllMocks()
})

describe('My Tags fragment 選取來源', () => {
  it('切換到新快照後，舊快照晚到不覆蓋目前選取', async () => {
    const old = deferred<string | null>()
    vi.mocked(cacheGet).mockReturnValueOnce(old.promise).mockResolvedValueOnce(snapshot(['~p:sample$']))
    const current = source()
    current.hash.value = '#eqt_hash=second'
    await settle()
    expect(current.tags.value).toEqual(['parody:sample'])
    old.resolve(snapshot(['-f:sample$']))
    await settle()
    expect(current.tags.value).toEqual(['parody:sample'])
    expect(current.message.value).toBe('')
  })

  it('移除 fragment 立即清空，已離開來源的失敗也不能顯示', async () => {
    const old = deferred<string | null>()
    vi.mocked(cacheGet).mockResolvedValueOnce(snapshot(['male:sample'])).mockReturnValueOnce(old.promise)
    const current = source()
    await settle()
    expect(current.tags.value).toEqual(['male:sample'])
    current.hash.value = '#eqt_hash=second'
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('gallery.loading')
    current.hash.value = ''
    old.reject(new Error('storage failed'))
    await settle()
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('')
  })

  it('快照不存在、來源衝突與儲存讀取失敗都清掉上一份選取', async () => {
    vi.mocked(cacheGet).mockResolvedValueOnce(snapshot(['other:sample'])).mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('storage failed'))
    const current = source()
    await settle()
    current.hash.value = '#eqt_hash=missing'
    await settle()
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('panel.pickMissing')
    current.hash.value = '#eqt_hash=first&eqt_gid=123&eqt_token=0123456789'
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('panel.pickConflict')
    current.hash.value = '#eqt_hash=broken'
    await settle()
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('panel.pickLoadFailed')
  })

  it('卸載後不接收仍在讀取的快照', async () => {
    const pending = deferred<string | null>()
    vi.mocked(cacheGet).mockReturnValue(pending.promise)
    const current = source()
    current.stop()
    pending.resolve(snapshot(['female:sample']))
    await settle()
    expect(current.tags.value).toEqual([])
  })
})

describe('My Tags 完整圖庫來源', () => {
  it('未帶快照也能載入整本，切回快照時只留下選取內容', async () => {
    vi.mocked(fetchGallery).mockResolvedValue(gallery(123, ['female:sample', 'other:sample', 'language:sample']))
    vi.mocked(cacheGet).mockResolvedValue(snapshot(['-female:sample$']))
    const current = source('#eqt_gid=123&eqt_token=0123456789')
    await settle()
    expect(current.tags.value).toEqual(['female:sample', 'other:sample', 'language:sample'])
    expect(fetchGallery).toHaveBeenCalledWith(123, '0123456789')
    current.hash.value = '#eqt_hash=selection'
    await settle()
    expect(current.tags.value).toEqual(['female:sample'])
  })

  it('快速切換圖庫時，只採用最新的來源結果', async () => {
    const old = deferred<GalleryDetail | null>()
    vi.mocked(fetchGallery).mockReturnValueOnce(old.promise).mockResolvedValueOnce(gallery(456, ['other:sample']))
    const current = source('#eqt_gid=123&eqt_token=0123456789')
    current.hash.value = '#eqt_gid=456&eqt_token=abcdef0123'
    await settle()
    expect(current.tags.value).toEqual(['other:sample'])
    old.resolve(gallery(123, ['female:sample']))
    await settle()
    expect(current.tags.value).toEqual(['other:sample'])
    expect(current.message.value).toBe('')
  })

  it('切到快照後不接受舊圖庫的失敗', async () => {
    const old = deferred<GalleryDetail | null>()
    vi.mocked(fetchGallery).mockReturnValueOnce(old.promise)
    vi.mocked(cacheGet).mockResolvedValue(snapshot(['~male:sample$']))
    const current = source('#eqt_gid=123&eqt_token=0123456789')
    current.hash.value = '#eqt_hash=selection'
    await settle()
    old.resolve(null)
    await settle()
    expect(current.tags.value).toEqual(['male:sample'])
    expect(current.message.value).toBe('')
  })

  it.each([
    '#eqt_gid=123',
    '#eqt_token=0123456789',
    '#eqt_gid=invalid&eqt_token=0123456789',
    '#eqt_gid=123&eqt_token=invalid',
  ])('圖庫參數缺失或無效時，清掉原內容並提示：%s', async (fragment) => {
    vi.mocked(cacheGet).mockResolvedValue(snapshot(['female:sample']))
    const current = source()
    await settle()
    current.hash.value = fragment
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('panel.gallerySourceInvalid')
    expect(fetchGallery).not.toHaveBeenCalled()
  })

  it('圖庫抓取失敗清掉原內容，後續有效來源仍能載入', async () => {
    vi.mocked(cacheGet).mockResolvedValue(snapshot(['female:sample']))
    vi.mocked(fetchGallery).mockResolvedValueOnce(null).mockResolvedValueOnce(gallery(456, ['other:sample']))
    const current = source()
    await settle()
    current.hash.value = '#eqt_gid=123&eqt_token=0123456789'
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('gallery.loading')
    await settle()
    expect(current.tags.value).toEqual([])
    expect(current.message.value).toBe('gallery.failed')
    current.hash.value = '#eqt_gid=456&eqt_token=abcdef0123'
    await settle()
    expect(current.tags.value).toEqual(['other:sample'])
    expect(current.message.value).toBe('')
  })
})
