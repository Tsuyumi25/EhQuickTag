// 抓回來的畫廊樣本，以及對每一本的判斷。
//
// ⭐ 判斷綁在畫廊上，不綁在設定上——所以改權重之後先前判過的不用重判。

import { outcomeOf, type FactsOf } from '@/services/mytags/mytagsScore'

export interface SampleGallery {
  gid: number
  token: string
  title: string
  category: string
  /** 列表頁直接給的封面圖。EH 的封面 URL 是永久的，存下來就能一直用 */
  thumb: string
  tags: string[]
  expunged?: boolean
}

/** 使用者的判斷：這本該被擋 / 這本該留下 */
export type Verdict = 'block' | 'keep'

export interface SampleStore {
  galleries: Record<string, SampleGallery>
  verdicts: Record<string, Verdict>
}

export function emptyStore(): SampleStore {
  return { galleries: {}, verdicts: {} }
}

export interface Accuracy {
  judged: number
  /** 設定的去向跟判斷一致 */
  correct: number
  /** 判為該留，設定卻擋了——誤傷 */
  overBlocked: number
  /** 判為該擋，設定卻放行——漏網 */
  leaked: number
}

/**
 * 拿判過的每一本重算一次，看這組設定對幾本。
 *
 * 只算判過的：沒判過的畫廊沒有正確答案可比，算進分母沒有意義。
 */
export function accuracy(
  store: SampleStore,
  factsOf: FactsOf,
  threshold: number,
): Accuracy {
  const out: Accuracy = { judged: 0, correct: 0, overBlocked: 0, leaked: 0 }
  for (const [gid, want] of Object.entries(store.verdicts)) {
    const g = store.galleries[gid]
    if (!g) continue
    out.judged += 1
    const blocked = outcomeOf(g.tags, factsOf, threshold).side === 'left'
    if (blocked === (want === 'block')) out.correct += 1
    else if (blocked) out.overBlocked += 1
    else out.leaked += 1
  }
  return out
}

/**
 * 搜尋 URL。只用來拿 gid + token，標籤和封面走官方 API，所以不需要指定顯示模式。
 *
 * `f_cats=0`、`f_sft` 與 `f_sfu` 停用分類、標籤與上傳者過濾，以取得被擋掉的樣本。
 * 語言排除仍由 EH 套用；樣本入庫後保留，不隨語言設定變更重新篩選。
 * 硬隱藏的標籤尤其明顯：不停用就是零筆。某些 artist 只在特定分類下有作品，預設
 * 排除該分類的使用者連一筆樣本都抓不到。
 *
 * ⛔ 翻頁不是 `page=N`。EH 為了減輕深分頁的負擔改成游標式，`page=` 現在被忽略——
 * 帶什麼值都回傳第一頁，看起來像在翻，其實原地踏步。`next` 從上一頁的
 * `parseNextCursor` 拿，是排除式的：下一頁第一本的 gid 比它小。
 */
export function listingUrl(keywords: string, origin: string, next?: string | null, expunged = false): string {
  const u = new URL('/', origin)
  u.searchParams.set('f_search', keywords)
  u.searchParams.set('f_cats', '0')
  for (const f of ['f_sft', 'f_sfu']) u.searchParams.set(f, 'on')
  if (expunged) u.searchParams.set('f_sh', 'on')
  if (next) u.searchParams.set('next', next)
  return u.toString()
}
