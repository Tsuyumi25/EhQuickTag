import { ref } from 'vue'
import { GM } from '$'
import { hasGMXHR, cacheGet, cacheSet } from '@/services/gmStorage'

// EH wiki tag definition pages（5 個 category：tag/character/creator/language/series）
// scrape 出來的 JSON。trans db 沒 intro 時 fallback，EN locale 強制走這個
//
// Pipeline: 本 repo GHA scripts/fetch-wiki-tags.py + extract-wiki-tags.py 增量更新

export type TagWikiMirror = 'jsdelivr' | 'fastly' | 'gcore' | 'github'

const ASSET_PATH = 'Tsuyumi25/EhQuickTag@data/tag-wiki/wiki.json.gz'

export const TAG_WIKI_MIRRORS: Record<TagWikiMirror, { label: string; url: string }> = {
  jsdelivr: { label: 'jsDelivr', url: `https://cdn.jsdelivr.net/gh/${ASSET_PATH}` },
  fastly:   { label: 'jsDelivr (Fastly)', url: `https://fastly.jsdelivr.net/gh/${ASSET_PATH}` },
  gcore:    { label: 'jsDelivr (Gcore)', url: `https://gcore.jsdelivr.net/gh/${ASSET_PATH}` },
  github:   { label: 'GitHub Raw', url: 'https://raw.githubusercontent.com/Tsuyumi25/EhQuickTag/data/tag-wiki/wiki.json.gz' },
}

const CACHE_KEY = 'eqt_tag_wiki_v1'
const CACHE_TS_KEY = 'eqt_tag_wiki_v1_ts'

export interface WikiVariant {
  [key: string]: string
}

export interface WikiEntry {
  category: 'tag' | 'character' | 'creator' | 'language' | 'series'
  variants: WikiVariant[]
  shared: WikiVariant
}

// EH namespace → wiki category 對應
const NS_TO_CATEGORY: Record<string, WikiEntry['category']> = {
  parody: 'series',
  character: 'character',
  artist: 'creator',
  group: 'creator',
  cosplayer: 'creator',
  language: 'language',
  // 其餘 namespace (female/male/mixed/other/reclass/rows/location) → tag
}

function nsToCategory(ns: string): WikiEntry['category'] {
  return NS_TO_CATEGORY[ns] ?? 'tag'
}

export function rawToSlug(raw: string): string {
  return raw.replace(/ /g, '_').toLowerCase()
}

let entries: Map<string, WikiEntry> | null = null

export const tagWikiVersion = ref(0)

export function getTagWiki(ns: string, raw: string): WikiEntry | undefined {
  if (!entries) return undefined
  const cat = nsToCategory(ns)
  const slug = rawToSlug(raw)
  return entries.get(`${cat}/${slug}`)
}

export interface LoadTagWikiOptions {
  mirror?: TagWikiMirror
  ttlDays?: number
}

export async function loadTagWiki(opts: LoadTagWikiOptions = {}): Promise<void> {
  if (entries) return

  const ttl = (opts.ttlDays ?? 7) * 24 * 60 * 60 * 1000
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < ttl) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      const obj = JSON.parse(cached) as Record<string, WikiEntry>
      entries = new Map(Object.entries(obj))
      tagWikiVersion.value++
      return
    }
  }

  const url = TAG_WIKI_MIRRORS[opts.mirror ?? 'jsdelivr'].url
  const json = await fetchAndDecompress(url)
  const payload = JSON.parse(json) as { entries: Record<string, WikiEntry> }
  entries = new Map(Object.entries(payload.entries))
  await cacheSet(CACHE_KEY, JSON.stringify(payload.entries))
  await cacheSet(CACHE_TS_KEY, String(Date.now()))
  tagWikiVersion.value++
}

export async function refreshTagWiki(opts: LoadTagWikiOptions = {}): Promise<void> {
  entries = null
  await cacheSet(CACHE_TS_KEY, '0')
  await loadTagWiki(opts)
}

async function fetchAndDecompress(url: string): Promise<string> {
  const gz = await fetchGz(url)
  const stream = new Response(gz).body!.pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

async function fetchGz(url: string): Promise<ArrayBuffer> {
  if (hasGMXHR) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        onload: (res) => {
          if (res.status === 200) resolve(res.response as ArrayBuffer)
          else reject(new Error(`HTTP ${res.status}`))
        },
        onerror: (err) => reject(new Error(`Network error: ${JSON.stringify(err)}`)),
      })
    })
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.arrayBuffer()
}
