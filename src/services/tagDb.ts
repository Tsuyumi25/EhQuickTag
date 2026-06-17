import { ref } from 'vue'
import { GM_xmlhttpRequest } from '$'
import { isASCII, toCN, toJP } from '@/services/cjkDict'
import { getNhWeight } from '@/services/nhPopularity'
import { hasGMXHR, cacheGet, cacheSet } from '@/services/gmStorage'

export type TagDbMirror = 'jsdelivr' | 'fastly' | 'gcore' | 'github'

export const TAG_DB_MIRRORS: Record<TagDbMirror, { label: string; url: string }> = {
  jsdelivr: { label: 'jsDelivr', url: 'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.text.json' },
  fastly: { label: 'jsDelivr (Fastly)', url: 'https://fastly.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.text.json' },
  gcore: { label: 'jsDelivr (Gcore)', url: 'https://gcore.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.text.json' },
  github: { label: 'GitHub Raw', url: 'https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json' },
}

// v2: 改抓 db.text.json 並加入 introSearch 欄位（commit b/c html 版把 cross-reference 詞
// 藏在 <abbr title="..."> 屬性裡，textContent 拿不到，導致 introSearch 永遠沒命中）
const CACHE_KEY = 'eqt_tag_db_v2'
const CACHE_TS_KEY = 'eqt_tag_db_v2_ts'

/** Fields persisted to cache. */
interface StoredEntry {
  fullTag: string
  ns: string
  raw: string
  name: string
  /**
   * EhTagTranslation 的 intro + links 欄位 stripped + lowercased，用 \0 串接。
   *
   * 為什麼搜這欄：intro 通常寫 cross-reference，例如 `thigh high boots` 的 intro
   * 提到 stockings，使得 query `stock` 能命中相關 tag（跟 EhSyringe 一致）。
   *
   * 舊版（commit 458d707 之前）有，後來砍掉是基於「搜尋只需 raw+name」假設，
   * 現在反例出現，加回。
   */
  introSearch: string
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

/**
 * Reactive version counter——loadTagDb / refreshTagDb 完成時 bump。
 *
 * 用途：findEntryByNsTag 純函數沒 reactive signal，當 tagDb async 載入完，
 * 依賴它輸出的 computed 不會自動 invalidate（典型症狀：URL 帶 ?f_search 進
 * 頁面時 chip 顯示英文 raw，等了一秒 DB 載完 chip 還是英文，要 user 動別的
 * 東西才會翻成 CJK）。caller 在 computed 內 `void tagDbVersion.value`
 * 建立依賴，DB ready 時自然重算
 */
export const tagDbVersion = ref(0)

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
      // \0 串接避免 intro 結尾跟 links 開頭黏在一起產生 false hit
      let introSearch = ''
      if (info.intro) introSearch += '\0' + stripHtml(info.intro).toLowerCase()
      if (info.links) introSearch += '\0' + stripHtml(info.links).toLowerCase()
      result.push(addSearchFields({ fullTag: `${ns}:${raw}`, ns, raw, name, introSearch }))
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
        // 保留原 error：GM_xmlhttpRequest 的 onerror 回傳 GMXHR error response
        // （含 status / statusText / details）。包成籠統 'Network error' 會吃掉
        // CI debug 線索（CDN 5xx vs CORS vs timeout 全變一句話）
        onerror: (err) => reject(new Error(`Network error: ${JSON.stringify(err)}`)),
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
      // 舊版 cache 沒 introSearch 欄位（commit 458d707 之前後又移除過）；缺值補空字串，
      // 搜尋會自然退化為「沒 intro 命中」直到下次 refreshTagDb 把新欄位填上。
      const raw = JSON.parse(cached) as Array<Partial<StoredEntry> & Pick<StoredEntry, 'fullTag' | 'ns' | 'raw' | 'name'>>
      entries = raw.map(s => addSearchFields({ ...s, introSearch: s.introSearch ?? '' }))
      tagDbVersion.value++
      return entries
    }
  }

  const raw = await fetchDb(opts.mirror)
  const db: DbJson = JSON.parse(raw)
  entries = buildIndex(db)

  const stored: StoredEntry[] = entries.map(({ fullTag, ns, raw: r, name, introSearch }) =>
    ({ fullTag, ns, raw: r, name, introSearch }),
  )
  await cacheSet(CACHE_KEY, JSON.stringify(stored))
  await cacheSet(CACHE_TS_KEY, String(Date.now()))
  tagDbVersion.value++

  return entries
}

/** Force re-fetch tag DB from mirror, ignoring cache. */
export async function refreshTagDb(opts: LoadTagDbOptions = {}): Promise<void> {
  entries = null
  _fallbackCache.clear()
  _entryIndex = null
  await cacheSet(CACHE_TS_KEY, '0')
  await loadTagDb(opts)
}

/**
 * 用 (namespace, tag raw) 查回 TagEntry。給 SearchPanel 在 CJK locale 下把
 * button 文字從英文 raw 換成 entry.name（本地化翻譯）。
 *
 * Index lazy build：首次呼叫時掃 entries 建 Map<ns:rawLow, entry>，後續 O(1)。
 * refreshTagDb 跟 entries 一起清。
 */
let _entryIndex: Map<string, TagEntry> | null = null
export function findEntryByNsTag(ns: string, tag: string): TagEntry | undefined {
  if (!entries) return undefined
  if (!_entryIndex) {
    _entryIndex = new Map()
    for (const e of entries) _entryIndex.set(`${e.ns}:${e.rawLow}`, e)
  }
  return _entryIndex.get(`${ns}:${tag.toLowerCase()}`)
}

// --- multi-key ranking ---

// Match tier: how well does the search term match the tag?
const enum MatchTier {
  Prefix = 0,         // tag starts with search term
  WordStart = 1,      // a word in the tag starts with search term
  IntroSubstring = 2, // search term found in intro/links cross-reference
}

/** Default namespace order (index = tier). */
export const DEFAULT_NS_ORDER = [
  'female', 'male', 'other', 'mixed', 'location',
  'parody', 'character',
  'artist', 'cosplayer', 'group', 'language',
  'reclass', 'temp',
]

export const ALL_NAMESPACES = DEFAULT_NS_ORDER

const NS_TIER_MAP: ReadonlyMap<string, number> = new Map(
  DEFAULT_NS_ORDER.map((ns, i) => [ns, i]),
)

const NS_ALIASES: Record<string, string> = {
  r: 'reclass', g: 'group', a: 'artist', cos: 'cosplayer',
  p: 'parody', c: 'character', f: 'female', m: 'male',
  x: 'mixed', l: 'language', o: 'other', loc: 'location',
}

function getMatchTier(entry: TagEntry, search: string, searchIsAscii: boolean): MatchTier | null {
  // prefix: entire field starts with search
  if (entry.rawLow.startsWith(search) || entry.nameLow.startsWith(search)) {
    return MatchTier.Prefix
  }

  // word-start: any subsequent word in raw starts with search
  if (entry.rawWords !== null) {
    for (const word of entry.rawWords) {
      if (word.startsWith(search)) return MatchTier.WordStart
    }
  }
  // CJK name substring: CJK has no word boundaries, so includes is needed
  if (!searchIsAscii && entry.nameLow.includes(search)) return MatchTier.WordStart

  // intro substring：EhTagTranslation intro 通常含 cross-reference（例如 thigh high
  // boots 的 intro 提到 stockings），讓 query `stock` 命中相關 tag。tier 排在 WordStart
  // 後，避免 intro 噪音蓋過真實命中
  if (entry.introSearch && entry.introSearch.includes(search)) return MatchTier.IntroSubstring
  return null
}

interface RankedEntry {
  entry: TagEntry
  matchTier: MatchTier
  nhCount: number // 0 if no nh data
  nsTier: number
}

/**
 * 共用 tie-breaker：searchTags（matchTier 等同後）跟 fallback 清單（沒 query）
 * 都用同一條 nh-first → ns tier → length 的鏈，避免兩處 sort 邏輯 drift。
 * 任一支改了 nh 權重的相對重要性，另一支自動同步。
 */
type NhRankable = { entry: TagEntry; nhCount: number; nsTier: number }
function compareNhFallback(a: NhRankable, b: NhRankable): number {
  return (b.nhCount - a.nhCount)
    || (a.nsTier - b.nsTier)
    || (a.entry.raw.length - b.entry.raw.length)
}

export interface SearchOptions {
  /**
   * 限定回傳的 namespace 集合（popup-local 篩選器用）。query 的 namespace prefix
   * （`f:stock`）一旦命中會完全覆蓋此參數——prefix 是更明確的單次指令，不該被
   * popup 持續狀態干擾。
   */
  namespaces?: readonly string[]
}

export function searchTags(query: string, opts: SearchOptions = {}): TagEntry[] {
  if (!entries || !query.trim()) return []

  const { namespaces } = opts

  let q = query.toLowerCase().normalize().trim()
  let pool = entries

  // namespace filter: "f:stock" → filter to female, search "stock"
  let prefixNs: string | null = null
  const colIdx = q.indexOf(':')
  if (colIdx >= 1) {
    const prefix = q.slice(0, colIdx)
    const resolvedNs = NS_ALIASES[prefix] ?? prefix
    if (NS_TIER_MAP.has(resolvedNs)) {
      pool = pool.filter(e => e.ns === resolvedNs)
      q = q.slice(colIdx + 1)
      prefixNs = resolvedNs
    }
  }

  // popup-local 篩選器；prefix 命中時跳過（prefix 是「單次明確指令」優先於持續狀態）
  if (!prefixNs && namespaces && namespaces.length) {
    const nsSet = new Set(namespaces)
    pool = pool.filter(e => nsSet.has(e.ns))
  }

  // strip leading quote (EH exact-match syntax)
  if (q.startsWith('"')) q = q.slice(1)

  // prefix 命中但沒留字（user 打 `f:`）或 query 化簡後變空——委派給 getFallbackEntries
  // 走完整 nh+nsTier+length 排序鏈，不要回 raw pool 失去排序
  if (!q) {
    return getFallbackEntries({
      namespaces: prefixNs ? [prefixNs] : namespaces,
    })
  }

  // build search terms: original + CJK variants
  const qIsAscii = isASCII(q)
  let terms = [q]
  if (!qIsAscii) {
    terms.push(toCN(q), ...toJP(q))
    terms = [...new Set(terms)]
  }

  const ranked: RankedEntry[] = []

  for (const entry of pool) {
    // 不在 DEFAULT_NS_ORDER 的 ns 被排除（理論上不會發生，DB 解析時 ns 都有覆蓋）
    const nsTier = NS_TIER_MAP.get(entry.ns)
    if (nsTier === undefined) continue

    let matchTier: MatchTier | null = null
    for (const term of terms) {
      matchTier = getMatchTier(entry, term, qIsAscii)
      if (matchTier !== null) break
    }

    if (matchTier === null) continue

    ranked.push({
      entry,
      matchTier,
      nhCount: getNhWeight(entry.ns, entry.raw) ?? 0,
      nsTier,
    })
  }

  ranked.sort((a, b) =>
    (a.matchTier - b.matchTier) || compareNhFallback(a, b),
  )

  return ranked.map(r => r.entry)
}

/**
 * 給 SearchPopup 當「空查詢預設清單」的 ranked entries。
 *
 * 不像舊版只撈有 nh 對應的 entry——本函式回傳**所有** entries（受 namespaces filter），
 * 用 nh 上傳量當 tie-breaker 把熱門的拉到前面、其他附在後。這樣 popup 點 namespace
 * 篩選按鈕到 character/artist 等沒 nh 資料的類別時，清單不會變空白，但 female/male
 * 仍然會按 nh 熱榜排序。
 *
 * 排序鏈跟 searchTags 共用 `compareNhFallback`，nh 權重的相對重要性一處決定。
 *
 * 結果按 namespaces 組合 memoize；refreshTagDb 時整個 Map clear。
 */
const _fallbackCache = new Map<string, TagEntry[]>()
export interface FallbackEntriesOptions {
  namespaces?: readonly string[]
}
export function getFallbackEntries(opts: FallbackEntriesOptions = {}): TagEntry[] {
  const cacheKey = opts.namespaces && opts.namespaces.length ? [...opts.namespaces].sort().join(',') : '*'
  const cached = _fallbackCache.get(cacheKey)
  if (cached) return cached
  if (!entries) return []

  const nsSet = opts.namespaces && opts.namespaces.length ? new Set(opts.namespaces) : null

  const ranked: NhRankable[] = []
  for (const entry of entries) {
    if (nsSet && !nsSet.has(entry.ns)) continue
    const nsTier = NS_TIER_MAP.get(entry.ns)
    if (nsTier === undefined) continue
    ranked.push({
      entry,
      nhCount: getNhWeight(entry.ns, entry.raw) ?? 0,
      nsTier,
    })
  }
  ranked.sort(compareNhFallback)
  const result = ranked.map(r => r.entry)
  _fallbackCache.set(cacheKey, result)
  return result
}
