import { ref } from 'vue'
import { fetchGzText } from '@/services/tags/fetchGzText'
import { cacheGet, cacheSet } from '@/services/gmStorage'

// 繁簡、日漢逐字對照表。由 scripts/gen-cjk-dict.ts 產生，GHA 每月推到 data 分支（.github/workflows/cjk-dict.yml）。
// 只有 tagDb 的搜尋與中文名稱顯示會用到；還沒載入或載入失敗時當空表，轉換照原樣輸出，搜尋與顯示照常，
// 只是少了繁簡／日漢互通

export type CjkDictMirror = 'jsdelivr' | 'fastly' | 'gcore' | 'github'

const ASSET_PATH = 'Tsuyumi25/EhQuickTag@data/cjk-dict/cjk-dict.json.gz'

export const CJK_DICT_MIRRORS: Record<CjkDictMirror, { label: string; url: string }> = {
  jsdelivr: { label: 'jsDelivr', url: `https://cdn.jsdelivr.net/gh/${ASSET_PATH}` },
  fastly:   { label: 'jsDelivr (Fastly)', url: `https://fastly.jsdelivr.net/gh/${ASSET_PATH}` },
  gcore:    { label: 'jsDelivr (Gcore)', url: `https://gcore.jsdelivr.net/gh/${ASSET_PATH}` },
  github:   { label: 'GitHub Raw', url: 'https://raw.githubusercontent.com/Tsuyumi25/EhQuickTag/data/cjk-dict/cjk-dict.json.gz' },
}

const SCHEMA_VERSION = 1
const CACHE_KEY = 'eqt_cjk_dict_v1'
const CACHE_TS_KEY = 'eqt_cjk_dict_v1_ts'

interface Payload {
  version: number
  cn2jp: Record<string, string[]>
  t2s: Record<string, string>
  s2t: Record<string, string>
}

interface Tables {
  cn2jp: Readonly<Record<string, readonly string[]>>
  jp2cn: Readonly<Record<string, string>>
  t2s: Readonly<Record<string, string>>
  s2t: Readonly<Record<string, string>>
}

const EMPTY: Tables = { cn2jp: {}, jp2cn: {}, t2s: {}, s2t: {} }

let tables: Tables | null = null

export const cjkDictVersion = ref(0)

function isPayload(x: unknown): x is Payload {
  const p = x as Partial<Payload> | null
  return typeof p === 'object' && p !== null && p.version === SCHEMA_VERSION
    && typeof p.cn2jp === 'object' && typeof p.t2s === 'object' && typeof p.s2t === 'object'
}

function install(payload: Payload): void {
  tables = {
    cn2jp: payload.cn2jp,
    jp2cn: Object.fromEntries(Object.entries(payload.cn2jp).flatMap(([k, v]) => v.map(vv => [vv, k]))),
    t2s: payload.t2s,
    s2t: payload.s2t,
  }
  cjkDictVersion.value++
}

// 讀 version 讓畫面上的轉換結果在字典晚到時跟著重算
function current(): Tables {
  void cjkDictVersion.value
  return tables ?? EMPTY
}

export interface LoadCjkDictOptions {
  mirror?: CjkDictMirror
  ttlDays?: number
}

export async function loadCjkDict(opts: LoadCjkDictOptions = {}): Promise<void> {
  if (tables) return

  const ttl = (opts.ttlDays ?? 30) * 24 * 60 * 60 * 1000
  const cachedTs = Number(await cacheGet(CACHE_TS_KEY)) || 0
  if (Date.now() - cachedTs < ttl) {
    const cached = await cacheGet(CACHE_KEY)
    const parsed: unknown = cached ? JSON.parse(cached) : null
    if (isPayload(parsed)) {
      install(parsed)
      return
    }
  }

  const text = await fetchGzText(CJK_DICT_MIRRORS[opts.mirror ?? 'jsdelivr'].url)
  const payload: unknown = JSON.parse(text)
  if (!isPayload(payload)) throw new Error('CJK dict payload schema mismatch')
  install(payload)
  await cacheSet(CACHE_KEY, text)
  await cacheSet(CACHE_TS_KEY, String(Date.now()))
}

export async function refreshCjkDict(opts: LoadCjkDictOptions = {}): Promise<void> {
  tables = null
  await cacheSet(CACHE_TS_KEY, '0')
  await loadCjkDict(opts)
}

export function isASCII(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) >= 0x80) return false
  }
  return true
}

/** Convert traditional/JP kanji → CN simplified */
export function toCN(text: string): string {
  const { t2s, jp2cn } = current()
  let ret = ''
  for (const ch of text) {
    ret += t2s[ch] ?? jp2cn[ch] ?? ch
  }
  return ret
}

/**
 * Convert CN simplified → Traditional Chinese (char-level, OpenCC STCharacters)
 * 一對多取第一個。沒考慮地區慣用詞（譬如「软件 → 軟件」而非台灣慣用的「軟體」）
 */
export function toTW(text: string): string {
  const { s2t } = current()
  let ret = ''
  for (const ch of text) {
    ret += s2t[ch] ?? ch
  }
  return ret
}

const MAX_COMBINE = 16

/** Convert CN simplified → JP kanji variants (one-to-many, cartesian product) */
export function toJP(text: string): string[] {
  const { cn2jp } = current()
  let res = ['']
  for (const ch of text) {
    const jp = cn2jp[ch]
    if (jp) {
      if (jp.length > 1 && res.length < MAX_COMBINE) {
        const tmp: string[] = []
        for (const r of res) {
          for (const j of jp) {
            tmp.push(r + j)
          }
        }
        res = tmp
        continue
      }
      const rep = jp[0]
      for (let i = 0; i < res.length; i++) {
        res[i] += rep
      }
    } else {
      for (let i = 0; i < res.length; i++) {
        res[i] += ch
      }
    }
  }
  return res
}
