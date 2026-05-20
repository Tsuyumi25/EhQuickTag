import { GM_xmlhttpRequest } from '$'
import { isASCII, toCN, toJP } from '@/services/cjkDict'
import { getNhCount } from '@/services/nhPopularity'
import { hasGMXHR, cacheGet, cacheSet } from '@/services/gmStorage'

export type TagDbMirror = 'jsdelivr' | 'fastly' | 'gcore' | 'github'

export const TAG_DB_MIRRORS: Record<TagDbMirror, { label: string; url: string }> = {
  jsdelivr: { label: 'jsDelivr', url: 'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.html.json' },
  fastly: { label: 'jsDelivr (Fastly)', url: 'https://fastly.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.html.json' },
  gcore: { label: 'jsDelivr (Gcore)', url: 'https://gcore.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.html.json' },
  github: { label: 'GitHub Raw', url: 'https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.html.json' },
}

const CACHE_KEY = 'eqt_tag_db'
const CACHE_TS_KEY = 'eqt_tag_db_ts'

/** Fields persisted to cache. */
interface StoredEntry {
  fullTag: string
  ns: string
  raw: string
  name: string
}

/** StoredEntry + pre-computed search fields (never serialized to cache). */
export interface TagEntry extends StoredEntry {
  /** raw.toLowerCase() — pre-computed to avoid per-keystroke allocation */
  rawLow: string
  /** name.toLowerCase() — pre-computed to avoid per-keystroke allocation */
  nameLow: string
  /** words in rawLow after index 0 (index 0 covered by prefix check); null for single-word tags */
  rawWords: string[] | null
}

let entries: TagEntry[] | null = null

// --- HTML / text processing ---

const _domParser = new DOMParser()
function stripHtml(html: string): string {
  return _domParser.parseFromString(html, 'text/html').body.textContent ?? ''
}

function removeEmojiAndImages(html: string): string {
  // strip <img> tags first, then strip HTML, then remove emoji
  const noImg = html.replace(/<img[^>]*>/gi, '')
  const text = stripHtml(noImg)
  // remove emoji (unicode ranges for common emoji blocks)
  return text.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu, '').trim()
}

// --- index building ---

interface DbJson {
  data: {
    namespace: string
    data: Record<string, { name: string; intro: string; links: string }>
  }[]
}

function addSearchFields(stored: StoredEntry): TagEntry {
  const rawLow = stored.raw.toLowerCase()
  const words = rawLow.split(' ')
  return {
    ...stored,
    rawLow,
    nameLow: stored.name.toLowerCase(),
    rawWords: words.length > 1 ? words.slice(1) : null,
  }
}

function buildIndex(db: DbJson): TagEntry[] {
  const result: TagEntry[] = []

  for (const section of db.data) {
    const ns = section.namespace
    if (ns === 'rows') continue

    for (const [raw, info] of Object.entries(section.data)) {
      const name = removeEmojiAndImages(info.name)
      result.push(addSearchFields({ fullTag: `${ns}:${raw}`, ns, raw, name }))
    }
  }

  return result
}

// --- fetch ---

async function fetchDb(mirror: TagDbMirror = 'jsdelivr'): Promise<string> {
  const url = TAG_DB_MIRRORS[mirror]?.url ?? TAG_DB_MIRRORS.jsdelivr.url

  if (hasGMXHR) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          if (res.status === 200) resolve(res.responseText)
          else reject(new Error(`HTTP ${res.status}`))
        },
        onerror: () => reject(new Error('Network error')),
      })
    })
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export interface LoadTagDbOptions {
  mirror?: TagDbMirror
  ttlDays?: number
}

export async function loadTagDb(opts: LoadTagDbOptions = {}): Promise<TagEntry[]> {
  if (entries) return entries

  const ttl = (opts.ttlDays ?? 7) * 24 * 60 * 60 * 1000
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < ttl) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      entries = (JSON.parse(cached) as StoredEntry[]).map(addSearchFields)
      return entries
    }
  }

  const raw = await fetchDb(opts.mirror)
  const db: DbJson = JSON.parse(raw)
  entries = buildIndex(db)

  const stored: StoredEntry[] = entries.map(({ fullTag, ns, raw: r, name }) =>
    ({ fullTag, ns, raw: r, name }),
  )
  await cacheSet(CACHE_KEY, JSON.stringify(stored))
  await cacheSet(CACHE_TS_KEY, String(Date.now()))

  return entries
}

/** Force re-fetch tag DB from mirror, ignoring cache. */
export async function refreshTagDb(opts: LoadTagDbOptions = {}): Promise<void> {
  entries = null
  await cacheSet(CACHE_TS_KEY, '0')
  await loadTagDb(opts)
}

// --- multi-key ranking ---

// Match tier: how well does the search term match the tag?
const enum MatchTier {
  Prefix = 0,    // tag starts with search term
  WordStart = 1, // a word in the tag starts with search term
  Substring = 2, // search term found anywhere
}

// nh "tag" type only covers these EH namespaces
const NH_NAMESPACES = new Set(['female', 'male', 'mixed', 'other'])

/** Default namespace order (index = tier). */
export const DEFAULT_NS_ORDER = [
  'female', 'male', 'other', 'mixed', 'location',
  'parody', 'character',
  'artist', 'cosplayer', 'group', 'language',
  'reclass', 'temp',
]

export const ALL_NAMESPACES = DEFAULT_NS_ORDER

const NS_ALIASES: Record<string, string> = {
  r: 'reclass', g: 'group', a: 'artist', cos: 'cosplayer',
  p: 'parody', c: 'character', f: 'female', m: 'male',
  x: 'mixed', l: 'language', o: 'other', loc: 'location',
}

function getMatchTier(entry: TagEntry, search: string): MatchTier | null {
  // prefix: entire field starts with search
  if (entry.rawLow.startsWith(search) || entry.nameLow.startsWith(search)) {
    return MatchTier.Prefix
  }

  // word-start: any subsequent word in raw starts with search, or name contains it
  if (entry.rawWords !== null) {
    for (const word of entry.rawWords) {
      if (word.startsWith(search)) return MatchTier.WordStart
    }
  }
  if (entry.nameLow.includes(search)) return MatchTier.WordStart

  // substring: anywhere in raw
  if (entry.rawLow.includes(search)) return MatchTier.Substring

  return null
}

interface RankedEntry {
  entry: TagEntry
  matchTier: MatchTier
  nhCount: number // 0 if no nh data
  nsTier: number
}

export interface SearchOptions {
  useNhWeight?: boolean
  nsOrder?: string[]
}

export function searchTags(query: string, opts: SearchOptions = {}): TagEntry[] {
  if (!entries || !query.trim()) return []

  const { useNhWeight = false, nsOrder = DEFAULT_NS_ORDER } = opts

  // build ns → tier lookup; namespaces not in nsOrder are hidden
  const nsTierMap = new Map<string, number>()
  for (let i = 0; i < nsOrder.length; i++) {
    nsTierMap.set(nsOrder[i], i)
  }

  let q = query.toLowerCase().normalize().trim()
  let pool = entries

  // namespace filter: "f:stock" → filter to female, search "stock"
  const colIdx = q.indexOf(':')
  if (colIdx >= 1) {
    const prefix = q.slice(0, colIdx)
    const resolvedNs = NS_ALIASES[prefix] ?? prefix
    if (nsTierMap.has(resolvedNs)) {
      pool = pool.filter(e => e.ns === resolvedNs)
      q = q.slice(colIdx + 1)
    }
  }

  // strip leading quote (EH exact-match syntax)
  if (q.startsWith('"')) q = q.slice(1)

  if (!q) return pool

  // build search terms: original + CJK variants
  let terms = [q]
  if (!isASCII(q)) {
    terms.push(toCN(q), ...toJP(q))
    terms = [...new Set(terms)]
  }

  const ranked: RankedEntry[] = []

  for (const entry of pool) {
    // skip namespaces not in nsOrder (disabled by user)
    const nsTier = nsTierMap.get(entry.ns)
    if (nsTier === undefined) continue

    let matchTier: MatchTier | null = null
    for (const term of terms) {
      matchTier = getMatchTier(entry, term)
      if (matchTier !== null) break
    }

    if (matchTier === null) continue

    ranked.push({
      entry,
      matchTier,
      nhCount: useNhWeight && NH_NAMESPACES.has(entry.ns) ? (getNhCount(entry.raw) ?? 0) : 0,
      nsTier,
    })
  }

  ranked.sort((a, b) =>
    (a.matchTier - b.matchTier)
    || (b.nhCount - a.nhCount)
    || (a.nsTier - b.nsTier)
    || (a.entry.raw.length - b.entry.raw.length),
  )

  return ranked.map(r => r.entry)
}
