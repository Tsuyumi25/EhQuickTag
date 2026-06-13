import tagData from '@/data/nh-popularity-tag.json'
import artistData from '@/data/nh-popularity-artist.json'
import characterData from '@/data/nh-popularity-character.json'
import parodyData from '@/data/nh-popularity-parody.json'
import groupData from '@/data/nh-popularity-group.json'
import languageData from '@/data/nh-popularity-language.json'
import { normalize } from './nhNormalize'

// nh API 按 endpoint 分 tag 池：每個 ns-specific endpoint 對應一個 e-hentai namespace；
// /tag endpoint 是雜燴池——以 f/m/x/o 高人氣 entry 為主，也含 character/group/parody/artist
// 的長尾條目（上傳量小的 niche）。
const SPECIFIC_POOLS: Record<string, Map<string, number>> = {
  artist: new Map(Object.entries(artistData as Record<string, number>)),
  character: new Map(Object.entries(characterData as Record<string, number>)),
  parody: new Map(Object.entries(parodyData as Record<string, number>)),
  group: new Map(Object.entries(groupData as Record<string, number>)),
  language: new Map(Object.entries(languageData as Record<string, number>)),
}

// _tag 池主要為這些 ns 服務——它們沒有 ns-specific endpoint，只能從雜燴池查。
const TAG_POOL: Map<string, number> = new Map(Object.entries(tagData as Record<string, number>))
const TAG_POOL_NS: ReadonlySet<string> = new Set(['female', 'male', 'mixed', 'other'])

/**
 * 以 (namespace, tag raw) 查 nh 人氣權重。
 *
 * - ns 有專屬池（artist/character/parody/group/language）→ 只查專屬池，沒中回 undefined。
 *   **不**回退到 _tag 池——_tag 池的同名 entry 通常屬於不同 namespace 的高人氣標籤，
 *   錯誤回退會讓 niche 的 character/artist 繼承不屬於自己的票數，把錯的標籤推到前面。
 * - ns 屬於 TAG_POOL_NS（f/m/x/o）→ 查 _tag 池。
 * - 其他 ns（location/cosplayer/reclass/temp）→ undefined，排序退回 nsTier + length 兜底。
 *
 * Caller：searchTags 做排序權重；getFallbackEntries 取 ranked 預設清單給 SearchPopup。
 */
export function getNhWeight(ns: string, raw: string): number | undefined {
  const key = normalize(raw)
  const specificPool = SPECIFIC_POOLS[ns]
  if (specificPool) return specificPool.get(key)
  if (TAG_POOL_NS.has(ns)) return TAG_POOL.get(key)
  return undefined
}
