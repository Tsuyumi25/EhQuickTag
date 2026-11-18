// Multi-Page Viewer 裡浮出的 .gm：從 MPV 網址找到 /g/ 頁、抓回來取出原生 .gm 與投票憑證
import type { VoteContext } from '@/services/gallery/galleryVote'

/** /mpv/<gid>/<token>/ 對應的 /g/ 網址；不是 MPV 頁時是 null */
export function mpvGalleryUrl(loc: Pick<Location, 'origin' | 'pathname'>): string | null {
  const m = loc.pathname.match(/^\/mpv\/(\d+)\/([0-9a-f]+)\/?$/)
  return m ? `${loc.origin}/g/${m[1]}/${m[2]}/` : null
}

const VOTE_CONTEXT_RE = /var gid = (\d+);[\s\S]*?var token = "([0-9a-f]+)";[\s\S]*?var apiuid = (-?\d+);[\s\S]*?var apikey = "([0-9a-f]+)";/

// MPV 頁上沒有 apiuid / apikey，投票憑證從抓回來的 /g/ 頁 inline script 讀
export function parseVoteContext(html: string): VoteContext | null {
  const m = html.match(VOTE_CONTEXT_RE)
  if (!m) return null
  return { gid: Number(m[1]), token: m[2], apiuid: Number(m[3]), apikey: m[4] }
}

export interface FetchedGallery {
  url: string
  gm: HTMLElement
  vote: VoteContext | null
}

export async function fetchGallery(url: string): Promise<FetchedGallery> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const gm = new DOMParser().parseFromString(html, 'text/html').querySelector<HTMLElement>('.gm')
  if (!gm) throw new Error('.gm not found in gallery page')
  return { url, gm, vote: parseVoteContext(html) }
}
