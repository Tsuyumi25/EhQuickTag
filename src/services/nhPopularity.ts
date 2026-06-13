import tagData from '@/data/nh-popularity-tag.json'
import artistData from '@/data/nh-popularity-artist.json'
import characterData from '@/data/nh-popularity-character.json'
import parodyData from '@/data/nh-popularity-parody.json'
import groupData from '@/data/nh-popularity-group.json'
import languageData from '@/data/nh-popularity-language.json'

// nh API 按 endpoint 分 tag 池：每個 ns-specific endpoint 對應一個 e-hentai namespace；
// /tag endpoint 是雜燴池——含 f/m/x/o 高人氣 entry，也含 character/group/parody/artist
// 的長尾 entry（上傳量很小的 niche 條目）。
const POOLS: Record<string, Map<string, number>> = {
  // 共用 fallback 池——nh /tag endpoint 內容
  _tag: new Map(Object.entries(tagData as Record<string, number>)),
  artist: new Map(Object.entries(artistData as Record<string, number>)),
  character: new Map(Object.entries(characterData as Record<string, number>)),
  parody: new Map(Object.entries(parodyData as Record<string, number>)),
  group: new Map(Object.entries(groupData as Record<string, number>)),
  language: new Map(Object.entries(languageData as Record<string, number>)),
}

// 5 個 e-hentai ns 有對應 nh ns-specific endpoint。查詢時優先這層。
const NS_TO_SPECIFIC_POOL: Record<string, string> = {
  artist: 'artist',
  character: 'character',
  parody: 'parody',
  group: 'group',
  language: 'language',
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_ ]/g, '')
}

/**
 * 以 (namespace, tag raw) 查 nh 人氣權重。
 *
 * Two-tier lookup：
 *   1. 先查 ns-specific pool（artist/character/parody/group/language）——準確、無集合衝突
 *   2. 沒命中 → fallback 到 `_tag` pool（雜燴池）。對 f/m/x/o 這就是主要來源；對其他 ns
 *      （含 specific 涵蓋不到的 character 長尾、cosplayer、location、reclass、temp）這是
 *      兜底，能撈到上傳量小的尾巴 entry
 *   3. 都沒命中 → undefined
 *
 * 兩個 caller：searchTags 做排序權重；getFallbackEntries 取 ranked 預設清單給 AddTagPopup。
 */
export function getNhWeight(ns: string, raw: string): number | undefined {
  const key = normalize(raw)
  const poolKey = NS_TO_SPECIFIC_POOL[ns]
  if (poolKey) {
    const v = POOLS[poolKey].get(key)
    if (v !== undefined) return v
  }
  return POOLS._tag.get(key)
}
