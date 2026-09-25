import { readonly, ref } from 'vue'
import type { Listing } from '@/composables/useEhSearchListing'
import type { SampleGallery } from '@/services/mytagsSamples'

interface SampleFetcherOptions {
  fetchPage: (tag: string, cursor: string | null, signal: AbortSignal) => Promise<Listing>
  accept: (galleries: SampleGallery[]) => void
  maxPages: number
}

export function useMyTagsSampleFetcher(options: SampleFetcherOptions) {
  const busy = ref(false)
  const cursors = new Map<string, string | null>()
  let active: AbortController | null = null

  function stop(): void {
    active?.abort()
    active = null
    busy.value = false
  }

  async function start(tag: string): Promise<void> {
    if (active || cursors.get(tag) === null) return
    const controller = new AbortController()
    active = controller
    busy.value = true
    let cursor = cursors.get(tag) ?? null
    try {
      for (let page = 0; page < options.maxPages; page += 1) {
        const result = await options.fetchPage(tag, cursor, controller.signal)
        controller.signal.throwIfAborted()
        if (result.galleries.length) options.accept(result.galleries)
        cursor = result.next
        cursors.set(tag, cursor)
        if (cursor === null) break
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error
    } finally {
      if (active === controller) {
        active = null
        busy.value = false
      }
    }
  }

  return { busy: readonly(busy), start, stop, hasFetched: (tag: string) => cursors.has(tag) }
}
