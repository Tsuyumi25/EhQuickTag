/**
 * Fetch per-(ns, raw) result counts from exhentai /tag/ pages for f/m/x/o/language.
 *
 * Usage:
 *   TAG='female:lolicon' npx tsx --env-file=.env scripts/fetch-eh-popularity.ts
 *   LIMIT=20 npx tsx --env-file=.env scripts/fetch-eh-popularity.ts
 *   npx tsx --env-file=.env scripts/fetch-eh-popularity.ts
 *
 * Output: src/data/eh-popularity-{female,male,mixed,other,language}.json
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { normalize } from '../src/services/nhNormalize'

const DB_URL = 'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.text.json'
const EH_BASE = 'https://exhentai.org/tag'
const OUT_DIR = 'src/data'
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const REQUEST_DELAY_MIN_MS = 3000
const REQUEST_DELAY_MAX_MS = 6000
const BATCH_SIZE = 50
const LONG_PAUSE_MS = 60000

function nextDelay(): number {
  return REQUEST_DELAY_MIN_MS + Math.random() * (REQUEST_DELAY_MAX_MS - REQUEST_DELAY_MIN_MS)
}
const NAMESPACES = ['female', 'male', 'mixed', 'other', 'language'] as const
type Ns = typeof NAMESPACES[number]

interface DbNsBlock {
  namespace: string
  data: Record<string, unknown>
}
interface DbResponse {
  data: DbNsBlock[]
}

const FOUND_REGEX = /Found(?: about)? ([\d,]+) results?/
const FOUND_THOUSANDS_PLACEHOLDER = 5000

function buildCookie(): string {
  const member = process.env.EH_IPB_MEMBER_ID
  const pass = process.env.EH_IPB_PASS_HASH
  const igneous = process.env.EH_IGNEOUS
  if (!member || !pass || !igneous) {
    throw new Error('Missing EH_IPB_MEMBER_ID / EH_IPB_PASS_HASH / EH_IGNEOUS in .env')
  }
  return `ipb_member_id=${member}; ipb_pass_hash=${pass}; igneous=${igneous}`
}

async function fetchCount(ns: string, raw: string, cookie: string, debug = false): Promise<number | null> {
  const url = `${EH_BASE}/${ns}:${raw.replace(/ /g, '+')}`
  if (debug) console.log(`GET ${url}`)
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': cookie },
      redirect: 'follow',
    })
    if (debug) console.log(`  HTTP ${res.status}, final URL ${res.url}`)
    if (res.status === 429) {
      process.stdout.write(`[429 ${LONG_PAUSE_MS / 1000}s] `)
      await new Promise(r => setTimeout(r, LONG_PAUSE_MS))
      continue
    }
    if (!res.ok) return null
    const html = await res.text()
    if (/temporarily banned/i.test(html)) {
      console.log('\n----- BAN PAGE HTML -----')
      console.log(html)
      console.log('----- END BAN PAGE -----')
      throw new Error('Banned. See HTML above.')
    }
    const m = FOUND_REGEX.exec(html)
    if (m) return parseInt(m[1].replace(/,/g, ''), 10)
    if (html.includes('Found thousands of results')) return FOUND_THOUSANDS_PLACEHOLDER
    if (html.includes('No hits found')) return 0
    if (debug) {
      console.log(`  no FOUND match and no "No hits found"; html ${html.length} bytes`)
      const peek = ['Sad Panda', 'You shall not pass', 'login', 'sign in']
      for (const s of peek) if (html.toLowerCase().includes(s.toLowerCase())) console.log(`  hint: contains "${s}"`)
    }
    return null
  }
  throw new Error('Sustained 429 after 3 retries (treat as ban).')
}

async function sanityCheck(cookie: string): Promise<void> {
  const count = await fetchCount('female', 'big breasts', cookie)
  if (count === null) throw new Error('Sanity check failed: cannot parse female:big breasts page')
  if (count < 100000) throw new Error(`Sanity check suspicious: female:big breasts = ${count}`)
  console.log(`Sanity check OK: female:big breasts = ${count.toLocaleString()}`)
}

async function loadDb(): Promise<Map<Ns, string[]>> {
  console.log('Fetching EhTagTranslation DB…')
  const res = await fetch(DB_URL)
  if (!res.ok) throw new Error(`DB fetch failed: ${res.status}`)
  const db = (await res.json()) as DbResponse
  const out = new Map<Ns, string[]>()
  for (const ns of NAMESPACES) {
    const block = db.data.find(b => b.namespace === ns)
    out.set(ns, block ? Object.keys(block.data) : [])
  }
  return out
}

async function main() {
  const cookie = buildCookie()

  const single = process.env.TAG
  if (single) {
    const colon = single.indexOf(':')
    if (colon < 0) throw new Error('TAG must be in form ns:raw (e.g. TAG="female:lolicon")')
    const ns = single.slice(0, colon)
    const raw = single.slice(colon + 1)
    const count = await fetchCount(ns, raw, cookie, true)
    console.log(`\n=> ${ns}:${raw} = ${count}`)
    return
  }

  await sanityCheck(cookie)

  const limit = Number(process.env.LIMIT) || Infinity

  const nsTags = await loadDb()
  for (const ns of NAMESPACES) {
    const all = nsTags.get(ns)!
    const tags = Number.isFinite(limit) ? all.slice(0, limit) : all
    const outPath = `${OUT_DIR}/eh-popularity-${ns}.json`

    const result: Record<string, number> = existsSync(outPath)
      ? JSON.parse(readFileSync(outPath, 'utf8'))
      : {}
    const todo = tags.filter(raw => !(normalize(raw) in result))
    const skipped = tags.length - todo.length
    const avgDelay = (REQUEST_DELAY_MIN_MS + REQUEST_DELAY_MAX_MS) / 2
    const batchOverhead = Math.floor(todo.length / BATCH_SIZE) * LONG_PAUSE_MS
    const etaMs = todo.length * avgDelay + batchOverhead
    console.log(`\n${ns}: ${todo.length} todo, ${skipped} cached, ETA ${Math.ceil(etaMs / 60000)} min`)

    const failed: string[] = []
    const flush = () => writeFileSync(outPath, JSON.stringify(result) + '\n')

    for (let i = 0; i < todo.length; i++) {
      const raw = todo[i]
      const prefix = `[${i + 1}/${todo.length}] ${ns}:${raw}`
      let count: number | null
      try {
        count = await fetchCount(ns, raw, cookie)
      } catch (e) {
        flush()
        console.log(`\n${prefix} → ABORTED`)
        console.log(`  → flushed ${Object.keys(result).length} entries to ${outPath} before abort`)
        throw e
      }
      if (count === null) {
        failed.push(raw)
        console.log(`${prefix} = FAIL`)
      } else {
        result[normalize(raw)] = count
        flush()
        console.log(`${prefix} = ${count.toLocaleString()}`)
      }
      if (i + 1 >= todo.length) continue
      if ((i + 1) % BATCH_SIZE === 0) {
        console.log(`  --- batch pause ${LONG_PAUSE_MS / 1000}s ---`)
        await new Promise(r => setTimeout(r, LONG_PAUSE_MS))
      } else {
        await new Promise(r => setTimeout(r, nextDelay()))
      }
    }

    flush()
    console.log(`\n  → wrote ${outPath} (${Object.keys(result).length} entries total, ${failed.length} failed this run)`)
    if (failed.length > 0) {
      console.log(`  failed: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? ` ... (+${failed.length - 10})` : ''}`)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
