// 把一整頁畫廊抓回來，攤在面板裡。
//
// ⭐ 縮圖是雪碧圖：每一格的 inline style 自帶圖片網址、偏移和尺寸，所以原樣搬過來
// 就會顯示，不用解析。而且一張雪碧圖裝二十格 = 一個請求換二十張縮圖。

import { parseTaglistRoot } from '@/composables/useEhGalleryHost'

export interface GalleryPageThumb {
  /** 單頁的 /s/... 連結 */
  href: string
  label: string
  /** EH 算好的 background 定位。整段照抄，不要拆 */
  style: string
}

/** EH 的標籤層級：gt 確定 · gtl 投票多但未確定 · gtw 權重低。跟 GalleryTagList 同一套 */
export type TagTier = 'gt' | 'gtl' | 'gtw'

export interface GalleryPageTag {
  full: string
  /** gdata 給不了這個，而它正好回答「這個標籤到底算不算數」 */
  tier: TagTier
}

export interface GalleryDetail {
  gid: number
  token: string
  title: string
  titleJp: string
  category: string
  uploader: string
  /** 封面同樣是一段現成的 background style */
  coverStyle: string
  rating: string
  facts: { label: string; value: string }[]
  tags: GalleryPageTag[]
  thumbs: GalleryPageThumb[]
}

function textOf(root: ParentNode, sel: string): string {
  return root.querySelector(sel)?.textContent?.trim() ?? ''
}

function styleOf(root: ParentNode, sel: string): string {
  return root.querySelector(sel)?.getAttribute('style') ?? ''
}

export function parseGalleryDoc(doc: Document, gid: number, token: string): GalleryDetail {
  // ⚠️ 不能讀 chip 上的字：EH 對有別名的標籤會顯示成「原名 | 別名」，拿去當名稱就對不上
  // 其他地方的同一個標籤。onclick 裡的 nsRaw 才是原名
  const taglist = doc.querySelector('#taglist')
  const tags: GalleryPageTag[] = (taglist ? parseTaglistRoot(taglist) : []).map((tag) => ({
    full: tag.nsRaw,
    tier: /\bgtw\b/.test(tag.tierClass) ? 'gtw' : /\bgtl\b/.test(tag.tierClass) ? 'gtl' : 'gt',
  }))

  const thumbs: GalleryPageThumb[] = []
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('#gdt a')) {
    const box = a.querySelector<HTMLElement>('div[style]')
    if (!box) continue
    thumbs.push({
      href: a.getAttribute('href') ?? '',
      label: box.getAttribute('title') ?? '',
      style: box.getAttribute('style') ?? '',
    })
  }

  const facts: { label: string; value: string }[] = []
  for (const row of doc.querySelectorAll('#gdd tr')) {
    const label = (row.querySelector('.gdt1')?.textContent ?? '').replace(/:\s*$/, '').trim()
    const value = row.querySelector('.gdt2')?.textContent?.trim() ?? ''
    if (label) facts.push({ label, value })
  }

  return {
    gid,
    token,
    title: textOf(doc, '#gn'),
    titleJp: textOf(doc, '#gj'),
    category: textOf(doc, '#gdc'),
    uploader: textOf(doc, '#gdn a'),
    coverStyle: styleOf(doc, '#gd1 div'),
    // 「Average: 3.66」——原樣留著，我們不重算也不重排
    rating: textOf(doc, '#rating_label'),
    facts,
    tags,
    thumbs,
  }
}

/** 抓失敗回傳 null。頁面結構跟我們預期不同時也算失敗——寧可不顯示，不要顯示半套 */
export async function fetchGallery(gid: number, token: string): Promise<GalleryDetail | null> {
  try {
    const res = await fetch(`/g/${gid}/${token}/`, { credentials: 'same-origin' })
    if (!res.ok) return null
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
    const detail = parseGalleryDoc(doc, gid, token)
    return detail.title || detail.thumbs.length ? detail : null
  } catch { return null }
}
