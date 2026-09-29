import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchListing, type Listing } from '@/composables/useEhSearchListing'
import { useMyTagsSampleFetcher } from '@/composables/useMyTagsSampleFetcher'
import type { SampleGallery } from '@/services/mytags/mytagsSamples'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function page(gid: number, next: string | null): Listing {
  return { galleries: [{ gid, token: 'aaaaaaaaaa', title: 'sample', category: 'Misc', thumb: '', tags: [] }], next }
}

describe('useMyTagsSampleFetcher', () => {
  it('重設後清除到底的游標，下一次可從第一頁重新抓取', async () => {
    const accepted: number[] = []
    const fetchPage = vi.fn().mockResolvedValueOnce(page(1, null)).mockResolvedValueOnce(page(2, null))
    const fetcher = useMyTagsSampleFetcher({
      fetchPage, accept: galleries => accepted.push(...galleries.map(gallery => gallery.gid)), maxPages: 1,
    })
    await fetcher.start('tag')
    fetcher.reset()
    expect(fetcher.hasFetched('tag')).toBe(false)
    await fetcher.start('tag')
    expect(accepted).toEqual([1, 2])
    expect(fetchPage.mock.calls.map(([, cursor]) => cursor)).toEqual([null, null])
  })

  it('清除時停止抓取，晚到的回應不能重新加入樣本', async () => {
    const pending = deferred<Listing>()
    const accepted: SampleGallery[] = []
    const fetcher = useMyTagsSampleFetcher({
      fetchPage: () => pending.promise, accept: galleries => accepted.push(...galleries), maxPages: 1,
    })
    const running = fetcher.start('tag')
    fetcher.reset()
    pending.resolve(page(1, '100'))
    await running
    expect(accepted).toEqual([])
    expect(fetcher.hasFetched('tag')).toBe(false)
    expect(fetcher.busy.value).toBe(false)
  })

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

describe('sample fetching through the listing transport', () => {
  afterEach(() => vi.unstubAllGlobals())

  const listing = '<a href="/g/1/aaaaaaaaaa/">sample</a>'
  const metadata = { gmetadata: [{ gid: 1, token: 'aaaaaaaaaa', title: 'sample', tags: [] }] }

  it.each(['HTTP', 'network', 'metadata'] as const)('%s 失敗後可重抓第一頁並取得樣本', async (failure) => {
    const request = vi.fn()
    if (failure === 'metadata') request.mockResolvedValueOnce(new Response(listing))
    if (failure === 'network') request.mockRejectedValueOnce(new TypeError('network unavailable'))
    else request.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    request.mockResolvedValueOnce(new Response(listing))
      .mockResolvedValueOnce(Response.json(metadata))
    vi.stubGlobal('fetch', request)
    const accepted: SampleGallery[] = []
    const fetcher = useMyTagsSampleFetcher({
      fetchPage: (_, __, signal) => fetchListing('https://example.invalid/', signal),
      accept: galleries => accepted.push(...galleries),
      maxPages: 2,
    })

    await expect(fetcher.start('tag')).rejects.toThrow()
    expect(fetcher.hasFetched('tag')).toBe(false)
    expect(fetcher.busy.value).toBe(false)
    expect(accepted).toEqual([])
    await fetcher.start('tag')
    expect(accepted.map(gallery => gallery.gid)).toEqual([1])
  })

  it('後續頁失敗後保留樣本與游標，重試完成後才停止抓取', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(`${listing}<a id="unext" href="/?next=100">next</a>`))
      .mockResolvedValueOnce(Response.json(metadata))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('<a href="/g/2/bbbbbbbbbb/">sample</a>'))
      .mockResolvedValueOnce(Response.json({ gmetadata: [{ gid: 2, token: 'bbbbbbbbbb', tags: [] }] }))
    vi.stubGlobal('fetch', request)
    const accepted: SampleGallery[] = []
    const fetcher = useMyTagsSampleFetcher({
      fetchPage: (_, cursor, signal) => {
        const url = new URL('https://example.invalid/')
        if (cursor) url.searchParams.set('next', cursor)
        return fetchListing(url.toString(), signal)
      },
      accept: galleries => accepted.push(...galleries),
      maxPages: 2,
    })

    await expect(fetcher.start('tag')).rejects.toThrow()
    expect(accepted.map(gallery => gallery.gid)).toEqual([1])
    expect(fetcher.busy.value).toBe(false)
    await fetcher.start('tag')
    await fetcher.start('tag')
    expect(accepted.map(gallery => gallery.gid)).toEqual([1, 2])
    expect(request.mock.calls.filter(([, init]) => init?.method !== 'POST')
      .map(([url]) => new URL(url).searchParams.get('next'))).toEqual([null, '100', '100'])
  })
})
