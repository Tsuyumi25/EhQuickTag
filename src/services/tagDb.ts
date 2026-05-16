import { GM, GM_xmlhttpRequest } from '$'

const DB_URL = 'https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.html.json'
const CACHE_KEY = 'eqt_tag_db'
const CACHE_TS_KEY = 'eqt_tag_db_ts'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

export interface TagEntry {
  /** e.g. "female:stockings" */
  fullTag: string
  /** namespace e.g. "female" */
  ns: string
  /** raw tag name e.g. "stockings" */
  raw: string
  /** Chinese name (HTML stripped) e.g. "过膝袜" */
  name: string
}

let entries: TagEntry[] | null = null

// --- GM availability detection ---

const hasGM = typeof GM?.getValue === 'function'
const hasGMXHR = typeof GM_xmlhttpRequest === 'function'

// --- storage abstraction ---

async function cacheGet(key: string): Promise<string | null> {
  if (hasGM) return (await GM.getValue<string>(key, '')) || null
  return localStorage.getItem(key)
}

async function cacheSet(key: string, value: string): Promise<void> {
  if (hasGM) { await GM.setValue(key, value); return }
  try { localStorage.setItem(key, value) } catch { /* quota exceeded */ }
}

// --- fetch abstraction ---

function stripHtml(html: string): string {
  const tmp = document.createElement('span')
  tmp.innerHTML = html
  return tmp.textContent ?? ''
}

interface DbJson {
  data: {
    namespace: string
    data: Record<string, { name: string; intro: string; links: string }>
  }[]
}

function buildIndex(db: DbJson): TagEntry[] {
  const result: TagEntry[] = []

  for (const section of db.data) {
    const ns = section.namespace
    if (ns === 'rows') continue

    for (const [raw, info] of Object.entries(section.data)) {
      result.push({
        fullTag: `${ns}:${raw}`,
        ns,
        raw,
        name: stripHtml(info.name),
      })
    }
  }

  return result
}

async function fetchDb(): Promise<string> {
  if (hasGMXHR) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: DB_URL,
        onload: (res) => {
          if (res.status === 200) resolve(res.responseText)
          else reject(new Error(`HTTP ${res.status}`))
        },
        onerror: () => reject(new Error('Network error')),
      })
    })
  }

  // fallback: native fetch (works on e-hentai, may fail on exhentai due to CORS)
  const res = await fetch(DB_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export async function loadTagDb(): Promise<TagEntry[]> {
  if (entries) return entries

  // try cache
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < CACHE_TTL) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      entries = JSON.parse(cached)
      return entries!
    }
  }

  // fetch fresh
  const raw = await fetchDb()
  const db: DbJson = JSON.parse(raw)
  entries = buildIndex(db)

  // cache the index
  await cacheSet(CACHE_KEY, JSON.stringify(entries))
  await cacheSet(CACHE_TS_KEY, String(Date.now()))

  return entries
}

// --- search with scoring (aligned with EhSyringe) ---

const NS_SCORE: Record<string, number> = {
  other: 10,
  location: 9,
  female: 9,
  male: 8.5,
  mixed: 8,
  parody: 3.3,
  character: 2.8,
  artist: 2.5,
  cosplayer: 2.4,
  group: 2.2,
  language: 2,
  reclass: 1,
  temp: 0,
}

function scoreField(ns: string, search: string, field: string, positionMultiplier: number): number {
  const idx = field.toLowerCase().indexOf(search)
  if (idx < 0) return 0
  const nsScore = NS_SCORE[ns] ?? 1
  return (nsScore * (search.length + 1) / field.length) * (idx === 0 ? 2 : 1) * positionMultiplier
}

/** Resolve "f:" → "female", "m:" → "male", etc. */
const NS_ALIASES: Record<string, string> = {
  r: 'reclass', g: 'group', a: 'artist', cos: 'cosplayer',
  p: 'parody', c: 'character', f: 'female', m: 'male',
  x: 'mixed', l: 'language', o: 'other', loc: 'location',
}

export function searchTags(query: string, limit = 20): TagEntry[] {
  if (!entries || !query.trim()) return []

  let q = query.toLowerCase().trim()
  let pool = entries

  // namespace filter: "f:stock" → filter to female, search "stock"
  const colIdx = q.indexOf(':')
  if (colIdx >= 1) {
    const prefix = q.slice(0, colIdx)
    const resolvedNs = NS_ALIASES[prefix] ?? prefix
    if (NS_SCORE[resolvedNs] !== undefined) {
      pool = pool.filter(e => e.ns === resolvedNs)
      q = q.slice(colIdx + 1)
    }
  }

  if (!q) return pool.slice(0, limit)

  const scored: { entry: TagEntry; score: number }[] = []

  for (const entry of pool) {
    const s =
      scoreField(entry.ns, q, entry.raw, 1)
      + scoreField(entry.ns, q, entry.name, 1)

    if (s > 0) scored.push({ entry, score: s })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(s => s.entry)
}
