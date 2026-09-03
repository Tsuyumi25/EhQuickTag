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

import type { SampleGallery } from '@/services/mytagsSamples'

const API = 'https://api.e-hentai.org/api.php'
/** gdata 一次最多吃 25 筆 */
const BATCH = 25
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

interface GdataEntry {
  gid?: number
  token?: string
  title?: string
  category?: string
  thumb?: string
  tags?: string[]
  error?: string
}

/** `namespace: 1` 才會回帶命名空間的標籤（`male:example` 而不是 `example`） */
async function gdata(refs: GalleryRef[]): Promise<SampleGallery[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'gdata',
      gidlist: refs.map((r) => [r.gid, r.token]),
      namespace: 1,
    }),
  })
  if (!res.ok) return []
  const body = await res.json() as { gmetadata?: GdataEntry[] }
  return (body.gmetadata ?? [])
    .filter((g): g is GdataEntry & { gid: number } => typeof g.gid === 'number' && !g.error)
    .map((g) => ({
      gid: g.gid,
      token: g.token ?? '',
      title: g.title ?? '',
      category: g.category ?? '',
      thumb: g.thumb ?? '',
      tags: g.tags ?? [],
    }))
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
  /** 餵回 `listingUrl` 就會拿到下一頁；`null` 代表已經到底或抓失敗 */
  next: string | null
}

/** 畫廊為空代表這一頁沒有結果或抓失敗——兩者對呼叫端沒有差別 */
export async function fetchListing(url: string): Promise<Listing> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) return { galleries: [], next: null }
    const html = await res.text()
    const next = parseNextCursor(html)
    const refs = parseRefs(html)
    if (!refs.length) return { galleries: [], next }

    const galleries: SampleGallery[] = []
    for (let i = 0; i < refs.length; i += BATCH) {
      galleries.push(...await gdata(refs.slice(i, i + BATCH)))
    }
    return { galleries, next }
  } catch { return { galleries: [], next: null } }
}
