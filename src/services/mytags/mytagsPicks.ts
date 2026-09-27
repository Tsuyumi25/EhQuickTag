// 從圖庫頁選中、要帶進 /mytags 的標籤。
//
// ⭐ URL 只帶 gid，標籤清單放在 GM storage 用 gid 對回來：同時開兩本各自的 /mytags
// 分頁不會互相搶同一份資料，重新整理也還在。代價是會累積，所以只留最近幾筆。
//
// ⚠️ 每本各佔一個 key，不共用一份表：GM storage 沒有交易，兩個分頁同時「讀出整份表、
// 改一格、寫回去」，後寫的會把先寫的那本蓋掉。各寫各的 key 就沒有這個問題；清掉
// 舊的那一步就算兩邊同時做，最多只是多刪或少刪一筆舊的。

import { cacheDelete, cacheGet, cacheKeys, cacheSet } from '@/services/gmStorage'

const PICK_PREFIX = 'eqt_mytags_pick:'
const PICK_SCHEMA = 1
export const PICKS_LIMIT = 20
export const PICK_PARAM = 'eqt_gid'

export interface TagPick {
  tags: string[]
  savedAt: number
}

export function parsePick(raw: string | null): TagPick | null {
  if (!raw) return null
  try {
    const saved = JSON.parse(raw) as { schema?: number } & Partial<TagPick>
    if (
      saved.schema !== PICK_SCHEMA
      || typeof saved.savedAt !== 'number'
      || !Array.isArray(saved.tags)
      || !saved.tags.every((tag) => typeof tag === 'string')
    ) return null
    return { tags: saved.tags, savedAt: saved.savedAt }
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

export async function savePick(gid: number, tags: string[]): Promise<void> {
  const key = `${PICK_PREFIX}${gid}`
  await cacheSet(key, JSON.stringify({ schema: PICK_SCHEMA, tags, savedAt: Date.now() }))
  const keys = await cacheKeys(PICK_PREFIX)
  if (keys.length <= PICKS_LIMIT) return
  const entries = await Promise.all(keys.map(async (k) => ({
    key: k,
    savedAt: parsePick(await cacheGet(k))?.savedAt ?? null,
  })))
  await Promise.all(stalePicks(entries).filter((k) => k !== key).map(cacheDelete))
}

export async function loadPick(gid: string): Promise<string[]> {
  return parsePick(await cacheGet(`${PICK_PREFIX}${gid}`))?.tags ?? []
}

export function pickUrl(origin: string, gid: number): string {
  const url = new URL('/mytags', origin)
  url.searchParams.set(PICK_PARAM, String(gid))
  return url.href
}
