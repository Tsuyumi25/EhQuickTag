import { describe, expect, it, vi } from 'vitest'
import type { Listing } from '@/composables/useEhSearchListing'
import { useMyTagsSampleFetcher } from '@/composables/useMyTagsSampleFetcher'
import type { SampleGallery } from '@/services/mytagsSamples'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function page(gid: number, next: string | null): Listing {
  return { galleries: [{ gid, token: 'aaaaaaaaaa', title: 'sample', category: 'Misc', thumb: '', tags: [] }], next }
}

describe('useMyTagsSampleFetcher', () => {
  it('兩個實例各自忙碌，停止其中一個不影響另一個', async () => {
    const firstPage = deferred<Listing>()
    const secondPage = deferred<Listing>()
    const firstAccepted: SampleGallery[] = []
    const secondAccepted: SampleGallery[] = []
    let firstSignal!: AbortSignal
    let secondSignal!: AbortSignal
    const first = useMyTagsSampleFetcher({
      fetchPage: (_tag, _cursor, signal) => { firstSignal = signal; return firstPage.promise },
      accept: (galleries) => firstAccepted.push(...galleries),
      maxPages: 1,
    })
    const second = useMyTagsSampleFetcher({
      fetchPage: (_tag, _cursor, signal) => { secondSignal = signal; return secondPage.promise },
      accept: (galleries) => secondAccepted.push(...galleries),
      maxPages: 1,
    })
    const firstRun = first.start('tag')
    expect(first.busy.value).toBe(true)
    expect(second.busy.value).toBe(false)
    const secondRun = second.start('tag')
    first.stop()
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(false)
    expect(first.busy.value).toBe(false)
    expect(second.busy.value).toBe(true)
    firstPage.resolve(page(1, null))
    secondPage.resolve(page(2, null))
    await Promise.all([firstRun, secondRun])
    expect(firstAccepted).toEqual([])
    expect(secondAccepted.map((gallery) => gallery.gid)).toEqual([2])
    expect(first.hasFetched('tag')).toBe(false)
    expect(second.hasFetched('tag')).toBe(true)
  })

  it('各自按標籤續抓，搜尋到底只停止自己的實例', async () => {
    const firstFetch = vi.fn().mockResolvedValueOnce(page(1, '100')).mockResolvedValueOnce(page(2, null))
    const secondFetch = vi.fn().mockResolvedValue(page(3, null))
    const first = useMyTagsSampleFetcher({ fetchPage: firstFetch, accept: () => {}, maxPages: 1 })
    const second = useMyTagsSampleFetcher({ fetchPage: secondFetch, accept: () => {}, maxPages: 1 })
    await first.start('tag')
    await second.start('tag')
    await first.start('tag')
    await second.start('tag')
    await second.start('another')
    expect(firstFetch.mock.calls.map(([tag, cursor]) => [tag, cursor])).toEqual([['tag', null], ['tag', '100']])
    expect(secondFetch.mock.calls.map(([tag, cursor]) => [tag, cursor])).toEqual([['tag', null], ['another', null]])
  })

  it('取消後立即重啟保留已完成頁面，舊回應不能提交或清除新 busy', async () => {
    const oldPage = deferred<Listing>()
    const newPage = deferred<Listing>()
    const oldPageStarted = deferred<void>()
    const accepted: SampleGallery[] = []
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(page(1, '100'))
      .mockImplementationOnce(() => { oldPageStarted.resolve(); return oldPage.promise })
      .mockReturnValueOnce(newPage.promise)
    const fetcher = useMyTagsSampleFetcher({ fetchPage, accept: (galleries) => accepted.push(...galleries), maxPages: 2 })
    const oldRun = fetcher.start('tag')
    await oldPageStarted.promise
    fetcher.stop()
    const newRun = fetcher.start('tag')
    oldPage.resolve(page(2, '50'))
    await oldRun
    expect(fetcher.busy.value).toBe(true)
    expect(accepted.map((gallery) => gallery.gid)).toEqual([1])
    newPage.resolve(page(3, null))
    await newRun
    expect(fetcher.busy.value).toBe(false)
    expect(accepted.map((gallery) => gallery.gid)).toEqual([1, 3])
    expect(fetchPage.mock.calls.map(([, cursor]) => cursor)).toEqual([null, '100', '100'])
  })

  it('失敗解除忙碌並保留重試機會，忙碌期間重複啟動不重複抓取', async () => {
    const failure = new Error('fetch failed')
    const fetchPage = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(page(1, null))
    const accepted: SampleGallery[] = []
    const fetcher = useMyTagsSampleFetcher({ fetchPage, accept: (galleries) => accepted.push(...galleries), maxPages: 1 })
    const first = fetcher.start('tag')
    await fetcher.start('tag')
    await expect(first).rejects.toBe(failure)
    expect(fetcher.busy.value).toBe(false)
    expect(fetcher.hasFetched('tag')).toBe(false)
    await fetcher.start('tag')
    expect(accepted.map((gallery) => gallery.gid)).toEqual([1])
    expect(fetchPage.mock.calls.map(([, cursor]) => cursor)).toEqual([null, null])
  })
})
