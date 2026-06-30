import { ref } from 'vue'
import { GM } from '$'
import { hasGMXHR, cacheGet, cacheSet } from '@/services/gmStorage'

// mokurin000 (== 000ylop alias) e-hentai-tag-count：每小時 GHA 自動 release。
// 整條 pipeline: URenko/e-hentai-db nightly SQLite → group by tag_name → CSV.
// 我們只用 tagname_count.csv.gz（兩欄含 header），不用 legacy tid_count_tag。
const CSV_URL = 'https://github.com/mokurin000/e-hentai-tag-count/releases/latest/download/tagname_count.csv.gz'

const CACHE_KEY = 'eqt_tag_count_v1'
const CACHE_TS_KEY = 'eqt_tag_count_v1_ts'

// 過濾全 EH 歷史只被 vote 過 < 5 次的死 tag。對齊 JHenTai 的 row[1] >= 5
const MIN_COUNT = 5

let counts: Map<string, number> | null = null

export const tagCountVersion = ref(0)

/** 查單一 tag 的 EH 站內 gallery 數量（已過濾 < MIN_COUNT），用作 search ranking weight */
export function getTagCount(ns: string, raw: string): number | undefined {
  if (!counts) return undefined
  return counts.get(`${ns}:${raw.toLowerCase()}`)
}

export interface LoadTagCountOptions {
  ttlDays?: number
}

export async function loadTagCount(opts: LoadTagCountOptions = {}): Promise<void> {
  if (counts) return

  const ttl = (opts.ttlDays ?? 7) * 24 * 60 * 60 * 1000
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < ttl) {
    const cached = await cacheGet(CACHE_KEY)
    if (cached) {
      counts = new Map(Object.entries(JSON.parse(cached) as Record<string, number>))
      tagCountVersion.value++
      return
    }
  }

  const csv = await fetchAndDecompress(CSV_URL)
  counts = parseCsv(csv)
  await cacheSet(CACHE_KEY, JSON.stringify(Object.fromEntries(counts)))
  await cacheSet(CACHE_TS_KEY, String(Date.now()))
  tagCountVersion.value++
}

export async function refreshTagCount(opts: LoadTagCountOptions = {}): Promise<void> {
  counts = null
  await cacheSet(CACHE_TS_KEY, '0')
  await loadTagCount(opts)
}

// 用 DecompressionStream 解 gzip——現代瀏覽器原生支援，不引第三方 lib
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

function parseCsv(csv: string): Map<string, number> {
  const result = new Map<string, number>()
  const lines = csv.split('\n')
  // skip header (第一行: "tag_name,len")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    // 用 lastIndexOf 而不是 split——保留 tag name 含逗號的可能性（雖然當前 CSV 沒）
    const commaIdx = line.lastIndexOf(',')
    if (commaIdx < 0) continue
    const count = Number(line.slice(commaIdx + 1))
    // NaN >= MIN_COUNT 為 false，無效行自動跳過
    if (count >= MIN_COUNT) {
      result.set(line.slice(0, commaIdx).toLowerCase(), count)
    }
  }
  return result
}
