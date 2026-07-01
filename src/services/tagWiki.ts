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

const CACHE_KEY = 'eqt_tag_wiki_v3'
const CACHE_TS_KEY = 'eqt_tag_wiki_v3_ts'

// v3 schema (raw-HTML per variant, ul-anchored structure)：extractor 保留
// mw-parser-output HTML，split by <hr/> 分 variant、split by <ul> 分成
// prelude (警告/Reminder) + blocks (每個 ul 帶尾隨 dl/p 到下個 ul)。
// Client 用 v-html 渲染，prelude CSS 小字弱化，任何 ehwiki 未來新增的
// markup（dl/dd 條列、紅字警告、圖片等）都自動包含
export interface WikiVariant {
  prelude: string
  blocks: string[]
}
export type WikiEntry = WikiVariant[]

type WikiCategory = 'tag' | 'character' | 'creator' | 'language' | 'series'

// EH namespace → wiki category 對應
const NS_TO_CATEGORY: Record<string, WikiCategory> = {
  parody: 'series',
  character: 'character',
  artist: 'creator',
  group: 'creator',
  cosplayer: 'creator',
  language: 'language',
  // 其餘 namespace (female/male/mixed/other/reclass/rows/location) → tag
}

function nsToCategory(ns: string): WikiCategory {
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

// 目前支援的 payload schema 版本。extract-wiki-tags.py 產出的 v3 shape：
// entries[key] = list[{prelude, blocks[]}]
const SCHEMA_VERSION = 3

interface Payload {
  version?: number
  entries?: Record<string, WikiEntry>
}

// caller 用 instanceof 分辨這是 schema 錯 (可能是 CDN 遲滯，用戶切 mirror
// 就能繞) 還是純網路 / decode 錯 (通用 refresh failed 訊息即可)
export class WikiSchemaMismatchError extends Error {
  constructor(readonly gotVersion: number | undefined) {
    super(`Tag Wiki payload schema mismatch: expected v${SCHEMA_VERSION}, got v${gotVersion ?? '?'}`)
    this.name = 'WikiSchemaMismatchError'
  }
}

export async function loadTagWiki(opts: LoadTagWikiOptions = {}): Promise<void> {
  if (entries) return

  const ttl = (opts.ttlDays ?? 7) * 24 * 60 * 60 * 1000
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < ttl) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as Payload
      // cache 內含 payload.version——舊版本 fall through 到 refetch，避免 stale
      // schema 靜默 render 空白（v-for on 錯 shape 拿到 undefined block 都不炸也不渲染）
      if (parsed.version === SCHEMA_VERSION && parsed.entries) {
        entries = new Map(Object.entries(parsed.entries))
        tagWikiVersion.value++
        return
      }
    }
  }

  const url = TAG_WIKI_MIRRORS[opts.mirror ?? 'jsdelivr'].url
  const json = await fetchAndDecompress(url)
  const payload = JSON.parse(json) as Payload
  if (payload.version !== SCHEMA_VERSION || !payload.entries) {
    // CDN edge 快取還沒失效時會拿到舊 schema (譬如剛 release 完 12h 內 jsdelivr
    // POP 陸續 refetch)——loud throw 讓 caller 用 i18n toast 提示，比靜默空白清楚
    throw new WikiSchemaMismatchError(payload.version)
  }
  entries = new Map(Object.entries(payload.entries))
  await cacheSet(CACHE_KEY, JSON.stringify(payload))
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
