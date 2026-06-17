/**
 * Generate nh popularity snapshots, one JSON per nh API endpoint.
 *
 * nh API: https://nhentai.net/api/v2/tags/{endpoint}?sort=popular
 *
 * Each endpoint maps to one or more e-hentai namespaces (see nhPopularity.ts
 * dispatch logic). Endpoints are stored as separate JSON files for clarity—
 * each tag pool stays in its own file.
 *
 * Usage: npx tsx scripts/gen-nh-popularity.ts
 *
 * Output: src/data/nh-popularity-{endpoint}.json  ({ normalized_name: count })
 */

import { normalize } from '../src/services/nhNormalize'

const NH_API = 'https://nhentai.net/api/v2/tags'
const PER_PAGE = 100  // nh API max; actual response often includes ~20 bonus items
const OUT_DIR = 'src/data'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const REQUEST_DELAY_MS = 2500  // nh rate limit guard
const RATE_LIMIT_BACKOFF_MS = 60000  // 60s wait on HTTP 429

const ENDPOINTS = ['artist', 'character', 'parody', 'group'] as const
type Endpoint = typeof ENDPOINTS[number]

// character / parody 內容多，5 頁能拉到尾巴 count ~10 以上
const DEFAULT_PAGES: Record<Endpoint, number> = {
  artist: 2,
  character: 5,
  parody: 5,
  group: 1,
}

interface NhTag {
  name: string
  count: number
}

interface NhTagResponse {
  result: NhTag[]
}

async function fetchPage(endpoint: Endpoint, page: number): Promise<NhTag[]> {
  const url = `${NH_API}/${endpoint}?sort=popular&per_page=${PER_PAGE}&page=${page}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) {
      const data = (await res.json()) as NhTagResponse
      return data.result
    }
    if (res.status === 429 && attempt < 2) {
      process.stdout.write(`[429 backoff ${RATE_LIMIT_BACKOFF_MS / 1000}s] `)
      await new Promise(r => setTimeout(r, RATE_LIMIT_BACKOFF_MS))
      continue
    }
    throw new Error(`${endpoint} p${page}: HTTP ${res.status}`)
  }
  throw new Error(`${endpoint} p${page}: retries exhausted`)
}

async function fetchEndpoint(endpoint: Endpoint, pages: number): Promise<Record<string, number>> {
  process.stdout.write(`  ${endpoint}: `)
  const all: NhTag[] = []
  for (let p = 1; p <= pages; p++) {
    const tags = await fetchPage(endpoint, p)
    all.push(...tags)
    if (p < pages) await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))
  }
  const map: Record<string, number> = {}
  for (const { name, count } of all) {
    const key = normalize(name)
    if (!key) continue
    if (!(key in map) || count > map[key]) map[key] = count
  }
  console.log(`${all.length} entries → ${Object.keys(map).length} unique`)
  return map
}

async function main() {
  console.log(`fetching nh popularity snapshots (pages: ${JSON.stringify(DEFAULT_PAGES)})…`)

  const { writeFileSync } = await import('fs')

  for (const endpoint of ENDPOINTS) {
    const map = await fetchEndpoint(endpoint, DEFAULT_PAGES[endpoint])
    const out = `${OUT_DIR}/nh-popularity-${endpoint}.json`
    writeFileSync(out, JSON.stringify(map))
    if (endpoint !== ENDPOINTS[ENDPOINTS.length - 1]) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))
    }
  }

  console.log(`\nwrote ${ENDPOINTS.length} files to ${OUT_DIR}/`)
}

main()
