// 每份快照獨佔一個 key，避免跨分頁更新共用索引時覆蓋彼此的內容。

import { cacheDelete, cacheGet, cacheKeys, cacheSet } from '@/services/gmStorage'
import { parseTerm } from '@/services/search/searchSyntax'

const PICK_PREFIX = 'eqt_pick:'
const PICK_SCHEMA = 2
export const PICKS_LIMIT = 20
export const PICK_PARAM = 'eqt_hash'
const PICK_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export interface TagPick {
  terms: string[]
  savedAt: number
}

export function parsePick(raw: string | null): TagPick | null {
  if (!raw) return null
  try {
    const saved = JSON.parse(raw) as { schema?: number } & Partial<TagPick>
    if (
      saved.schema !== PICK_SCHEMA
      || typeof saved.savedAt !== 'number'
      || !Number.isFinite(saved.savedAt)
      || !Array.isArray(saved.terms)
      || !saved.terms.every((term) => typeof term === 'string')
    ) return null
    return { terms: saved.terms, savedAt: saved.savedAt }
  } catch {
    return null
  }
}

/** 超過上限時要清掉哪幾個 key：最久沒更新的先走，讀不出來的也一併清 */
export function stalePicks(
  entries: readonly { key: string; savedAt: number | null }[],
  limit = PICKS_LIMIT,
): string[] {
  return [...entries]
    .sort((a, b) => (b.savedAt ?? -Infinity) - (a.savedAt ?? -Infinity))
    .slice(limit)
    .map((entry) => entry.key)
}

/** 連結要先有網址才放得進 href，所以 ID 在選取改變時就先取好，真正寫入等使用者按下去 */
export async function newPickId(): Promise<string> {
  let id: string
  do {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => PICK_ALPHABET[byte & 63]).join('')
  } while (await cacheGet(`${PICK_PREFIX}${id}`) !== null)
  return id
}

/** 同一個 ID 重複寫入是覆蓋，按下去好幾次也只留一份 */
export async function savePick(id: string, terms: readonly string[]): Promise<void> {
  const key = `${PICK_PREFIX}${id}`
  await cacheSet(key, JSON.stringify({ schema: PICK_SCHEMA, terms, savedAt: Date.now() }))
  const keys = await cacheKeys(PICK_PREFIX)
  if (keys.length > PICKS_LIMIT) {
    const entries = await Promise.all(keys.filter(k => k !== key).map(async (k) => ({
      key: k,
      savedAt: parsePick(await cacheGet(k))?.savedAt ?? null,
    })))
    await Promise.all(stalePicks(entries, PICKS_LIMIT - 1).map(cacheDelete))
  }
}

export async function loadPick(id: string): Promise<TagPick | null> {
  return parsePick(await cacheGet(`${PICK_PREFIX}${id}`))
}

export function pickUrl(origin: string, id: string): string {
  const url = new URL('/mytags', origin)
  url.hash = new URLSearchParams({ [PICK_PARAM]: id }).toString()
  return url.href
}

export function pickTags(terms: readonly string[]): string[] {
  const tags = new Set<string>()
  for (const raw of terms) {
    const term = parseTerm(raw)
    if (term.namespace && term.tag && !term.parseError) tags.add(`${term.namespace}:${term.tag}`)
  }
  return [...tags]
}
