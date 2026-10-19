// 撈一批畫廊的完整標籤，分兩段。
//
// ⛔ 不從搜尋結果頁讀標籤。只有「擴充」顯示模式的列會帶完整標籤表，而顯示模式存在
// `sl` cookie 裡，不是每次請求的參數——想切就得改使用者自己的瀏覽設定，而且 cookie
// 已經有值時當次請求仍照舊模式算繪，第一次抓一定拿到半套標籤。半套標籤算出來的
// 紅綠是錯的，比抓不到更糟。
//
// ✅ 改用官方 API 拿標籤：搜尋頁只負責給 gid + token（任何顯示模式都有），
// 標籤和封面向 api.e-hentai.org 要（`access-control-allow-origin: *`，兩個站台都通）。
// 不碰任何 cookie。

import type { SampleGallery } from '@/services/mytags/mytagsSamples'

const API = 'https://api.e-hentai.org/api.php'
/** gdata 一次最多吃 25 筆 */
export const GDATA_BATCH = 25
const HREF = /\/g\/(\d+)\/([0-9a-f]{10})/g
// 「下一頁」那顆按鈕。EH 把游標算好寫在它的 href 裡。
// ⚠️ `(?:amp;)?` 不能省：原始碼裡的分隔符是 HTML 實體 `&amp;`，我們讀的是未解析的
// 字串，所以 `next=` 前面看到的是 `;` 而不是 `&`。
const UNEXT = /id="unext"[^>]*\bhref="[^"]*[?&](?:amp;)?next=([\d-]+)/

export interface GalleryRef { gid: number; token: string }

/** 搜尋結果頁裡的所有畫廊連結。緊湊 / 擴充 / 縮圖模式的 href 格式都一樣 */
export function parseRefs(html: string): GalleryRef[] {
  const seen = new Set<number>()
  const out: GalleryRef[] = []
  for (const m of html.matchAll(HREF)) {
    const gid = Number(m[1])
    if (seen.has(gid)) continue
    seen.add(gid)
    out.push({ gid, token: m[2] })
  }
  return out
}

/** 單一畫廊連結的 gid + token；與 {@link parseRefs} 共用同一條 pattern */
export function parseGalleryRef(href: string): GalleryRef | null {
  for (const match of href.matchAll(HREF)) return { gid: Number(match[1]), token: match[2] }
  return null
}

interface GdataEntry {
  gid?: number
  token?: string
  title?: string
  category?: string
  thumb?: string
  tags?: string[]
  /** 平均分，十進位字串 */
  rating?: string
  expunged?: boolean
  error?: string
}

/** `namespace: 1` 才會回帶命名空間的標籤（`male:example` 而不是 `example`） */
async function gdata(refs: GalleryRef[], signal?: AbortSignal): Promise<(GdataEntry & { gid: number })[]> {
  const res = await fetch(API, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'gdata',
      gidlist: refs.map((r) => [r.gid, r.token]),
      namespace: 1,
    }),
  })
  if (!res.ok) throw new Error(`Gallery metadata HTTP ${res.status}`)
  const body = await res.json() as { gmetadata?: GdataEntry[] }
  return (body.gmetadata ?? []).filter((g): g is GdataEntry & { gid: number } => typeof g.gid === 'number' && !g.error)
}

async function sampleGalleries(refs: GalleryRef[], signal?: AbortSignal): Promise<SampleGallery[]> {
  return (await gdata(refs, signal)).map((g) => ({
    gid: g.gid,
    token: g.token ?? '',
    title: g.title ?? '',
    category: g.category ?? '',
    thumb: g.thumb ?? '',
    tags: g.tags ?? [],
    expunged: g.expunged,
  }))
}

/** 每本的平均分（gid → 分數）。缺值或壞值的畫廊不放進結果，呼叫端當成未知 */
export async function fetchAverageRatings(refs: GalleryRef[], signal?: AbortSignal): Promise<Map<number, number>> {
  const ratings = new Map<number, number>()
  for (const g of await gdata(refs, signal)) {
    const value = Number(g.rating)
    if (typeof g.rating === 'string' && g.rating.trim() && value >= 0 && value <= 5) ratings.set(g.gid, value)
  }
  return ratings
}

/**
 * 下一頁的游標，`null` 代表沒有下一頁了。
 *
 * ⛔ 不能用「這一頁不滿 25 本」判斷結束：最後一頁照樣是滿的（實測跳到底仍有 25 本），
 * 只是 EH 不再產生 #unext。那個 anchor 在不在，是唯一說得準的訊號。
 */
export function parseNextCursor(html: string): string | null {
  return UNEXT.exec(html)?.[1] ?? null
}

export interface Listing {
  galleries: SampleGallery[]
  /** 餵回 `listingUrl` 就會拿到下一頁；`null` 代表已經到底 */
  next: string | null
}

/** 失敗必須拋出，避免呼叫端把未完成的頁面記成搜尋到底。 */
export async function fetchListing(url: string, signal?: AbortSignal): Promise<Listing> {
  signal?.throwIfAborted()
  const res = await fetch(url, { credentials: 'same-origin', signal })
  if (!res.ok) throw new Error(`Listing HTTP ${res.status}`)
  const html = await res.text()
  signal?.throwIfAborted()
  const next = parseNextCursor(html)
  const refs = parseRefs(html)
  if (!refs.length) return { galleries: [], next }

  const galleries: SampleGallery[] = []
  for (let i = 0; i < refs.length; i += GDATA_BATCH) {
    signal?.throwIfAborted()
    galleries.push(...await sampleGalleries(refs.slice(i, i + GDATA_BATCH), signal))
  }
  signal?.throwIfAborted()
  return { galleries, next }
}
