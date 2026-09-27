// 從另一本圖庫導入標籤候選。
//
// 導入的標籤不另開一排，而是記下「哪幾本、各自什麼線型」，由 taglist 決定怎麼呈現：
// 這本已經有的標籤掛上佐證記號，還沒有的混進原本的命名空間當候選。

import type { TagTier } from '@/composables/useEhGalleryPreview'

export interface GalleryRef {
  gid: number
  token: string
}

/** e-hentai / exhentai 的圖庫網址都行，只認 `/g/<gid>/<token>` 這段 */
export function parseGalleryUrl(input: string): GalleryRef | null {
  const m = /\/g\/(\d+)\/([0-9a-f]{10})(?:[/?#]|$)/.exec(input.trim())
  return m ? { gid: Number(m[1]), token: m[2] } : null
}

export interface ImportSource {
  gid: number
  title: string
  tier: TagTier
}

/** nsRaw → 帶進這個標籤的那幾本 */
export type Imports = ReadonlyMap<string, readonly ImportSource[]>

export interface ImportedGallery {
  gid: number
  title: string
  tags: readonly { full: string; tier: TagTier }[]
}

/**
 * 同一本再導入一次就換掉它先前的貢獻，不會重複算。
 *
 * 不收的標籤：
 * - 語言：別本是什麼語言跟這本無關，帶過來幾乎一定是錯的
 * - parody:original：EH 自動加上的，沒辦法投票
 */
export function withImport(imports: Imports, gallery: ImportedGallery): Map<string, ImportSource[]> {
  const next = new Map<string, ImportSource[]>()
  for (const [tag, sources] of imports) {
    const kept = sources.filter((s) => s.gid !== gallery.gid)
    if (kept.length) next.set(tag, kept)
  }
  for (const tag of gallery.tags) {
    if (tag.full.startsWith('language:') || tag.full === 'parody:original') continue
    const source = { gid: gallery.gid, title: gallery.title, tier: tag.tier }
    next.set(tag.full, [...(next.get(tag.full) ?? []), source])
  }
  return next
}

const TIER_RANK: Record<TagTier, number> = { gtw: 0, gtl: 1, gt: 2 }

/** 同一個標籤被幾本導入時，以最穩的那本為準 */
export function bestTier(sources: readonly ImportSource[]): TagTier {
  let best: TagTier = 'gtw'
  for (const s of sources) if (TIER_RANK[s.tier] > TIER_RANK[best]) best = s.tier
  return best
}

/** 導入能給這本已有標籤的佐證：別本最穩的那條線是實線、虛線還是點線；沒被導入就沒有 */
export function evidenceOf(sources: readonly ImportSource[]): 'solid' | 'dashed' | 'dotted' | null {
  if (!sources.length) return null
  const best = bestTier(sources)
  return best === 'gt' ? 'solid' : best === 'gtl' ? 'dashed' : 'dotted'
}
