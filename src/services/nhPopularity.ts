import { GM_xmlhttpRequest } from '$'
import bundledData from '@/data/nh-popularity.json'
import { hasGMXHR, cacheGet, cacheSet } from '@/services/gmStorage'

const NH_API = 'https://nhentai.net/api/v2/tags/tag'
const CACHE_KEY = 'eqt_nh_pop'
const CACHE_TS_KEY = 'eqt_nh_pop_ts'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
const PAGES_TO_FETCH = 5
const PER_PAGE = 100

function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_ ]/g, '')
}

// --- fetch (optional refresh) ---

interface NhTagResult {
  result: { name: string; count: number }[]
}

async function fetchPage(page: number): Promise<{ name: string; count: number }[]> {
  const url = `${NH_API}?sort=popular&per_page=${PER_PAGE}&page=${page}`

  if (hasGMXHR) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { 'User-Agent': 'eh-quick-tag/0.1 (userscript)' },
        onload: (res) => {
          if (res.status === 200) {
            const data: NhTagResult = JSON.parse(res.responseText)
            resolve(data.result)
          } else {
            reject(new Error(`NH API HTTP ${res.status}`))
          }
        },
        onerror: () => reject(new Error('NH API network error')),
      })
    })
  }

  throw new Error('GM_xmlhttpRequest not available')
}

async function fetchFresh(): Promise<Map<string, number> | null> {
  if (!hasGMXHR) return null

  const map = new Map<string, number>()
  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    try {
      const tags = await fetchPage(page)
      for (const t of tags) {
        map.set(normalize(t.name), t.count)
      }
    } catch {
      break
    }
  }

  if (map.size > 0) {
    await cacheSet(CACHE_KEY, JSON.stringify([...map]))
    await cacheSet(CACHE_TS_KEY, String(Date.now()))
    return map
  }

  return null
}

// --- public API ---

let popularityMap: Map<string, number> | null = null

function loadBundled(): Map<string, number> {
  return new Map(Object.entries(bundledData as Record<string, number>))
}

export async function loadNhPopularity(): Promise<Map<string, number>> {
  if (popularityMap) return popularityMap

  // try GM cache first
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < CACHE_TTL) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      popularityMap = new Map(JSON.parse(cached))
      return popularityMap
    }
  }

  // try live fetch
  const fresh = await fetchFresh()
  if (fresh) {
    popularityMap = fresh
    return popularityMap
  }

  // fallback to bundled snapshot
  popularityMap = loadBundled()
  return popularityMap
}

export function getNhCount(tagRaw: string): number | undefined {
  return popularityMap?.get(normalize(tagRaw))
}
