import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { cacheGet } from '@/services/gmStorage'
import { useMyTagsSource } from '@/composables/useMyTagsSource'

vi.mock('@/services/gmStorage', () => ({
  cacheGet: vi.fn(), cacheSet: vi.fn(), cacheKeys: vi.fn(), cacheDelete: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function snapshot(terms: string[]): string {
  return JSON.stringify({ schema: 2, terms, savedAt: 1 })
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
