// 把一個標籤的設定寫回 EH。
//
// ⛔ 不走原生那顆 Save 按鈕。EH 用一個全域變數當單線鎖，而它的回呼在錯誤分支不會
// 把鎖放掉——一次失敗之後，這一整頁的存檔就全部靜默失效，只能重整。
// 自己發請求就沒有這個問題，而且順序和錯誤都在我們手上。
//
// 憑證跟 galleryVote 同一個來源：原生頁面的全域變數。

import { pageWindow } from '@/utils/pageWindow'

interface NativePageGlobals {
  apiuid?: number
  apikey?: string
  api_url?: string
}

export interface TagWrite {
  id: number
  weight: number
  hidden: boolean
  watch: boolean
  color: string
}

export type WriteResult =
  | { ok: true }
  | { ok: false; error: string }

function endpoint(w: NativePageGlobals): string {
  if (typeof w.api_url === 'string' && w.api_url) return w.api_url
  return location.hostname === 'exhentai.org'
    ? 'https://s.exhentai.org/api.php'
    : 'https://api.e-hentai.org/api.php'
}

export function canWrite(): boolean {
  const w = pageWindow<NativePageGlobals>()
  return typeof w.apiuid === 'number' && typeof w.apikey === 'string'
}

export async function setUserTag(tag: TagWrite): Promise<WriteResult> {
  const w = pageWindow<NativePageGlobals>()
  if (typeof w.apiuid !== 'number' || typeof w.apikey !== 'string') {
    return { ok: false, error: 'no-credentials' }
  }
  try {
    const res = await fetch(endpoint(w), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        method: 'setusertag',
        apiuid: w.apiuid,
        apikey: w.apikey,
        tagid: tag.id,
        tagwatch: tag.watch ? 1 : 0,
        taghide: tag.hidden ? 1 : 0,
        tagcolor: tag.color,
        tagweight: String(tag.weight),
      }),
    })
    if (!res.ok) return { ok: false, error: `http-${res.status}` }
    const body = await res.json() as { error?: string; login?: string; tagid?: number }
    if (body.login) return { ok: false, error: 'login-required' }
    if (body.error) return { ok: false, error: body.error }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ---- 表單動作 ----
//
// 新增 / 刪除 / 搬移 / 標籤集沒有 API，只能送表單。但送表單不等於要 submit 當前頁的
// 那張——`?tagset=N` 掛在 URL 上就決定了這次動的是哪一組，所以自己 POST 過去就好。
//
// ⭐ 換來兩件事：不刷新（回應就是新的 /mytags，直接 parse），以及不必先切到那一組。

/** `change_tagset` 的規則：第一組不帶參數 */
function formUrl(tagSet: string): string {
  return Number(tagSet) > 1
    ? `${location.origin}/mytags?tagset=${encodeURIComponent(tagSet)}`
    : `${location.origin}/mytags`
}

/** 送出後的新頁面。回 null 代表這次沒送成功，呼叫端不要拿舊資料當新的 */
async function postForm(
  tagSet: string,
  fields: [string, string][],
): Promise<Document | null> {
  const body = new URLSearchParams()
  for (const [k, v] of fields) body.append(k, v)
  try {
    const res = await fetch(formUrl(tagSet), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return null
    return new DOMParser().parseFromString(await res.text(), 'text/html')
  } catch { return null }
}

/**
 * 刪除和搬移是同一個動作，差別只在 target：`0` 是刪除，其餘是目標組。
 *
 * ⚠️ 三個 `*_new` 欄位一個都不能少。EH 照表單欄位讀，缺了就當空字串處理。
 * ⚠️ `ids` 必須全部屬於 `tagSet`——這張表單只認得那一組裡的 tagid。跨組要按組拆開送。
 */
export function postMassAction(
  tagSet: string,
  ids: number[],
  target: string,
): Promise<Document | null> {
  const fields: [string, string][] = [
    ['usertag_action', 'mass'],
    ['tagname_new', ''],
    ['tagcolor_new', ''],
    ['tagweight_new', '10'],
    ['usertag_target', target],
  ]
  for (const id of ids) fields.push(['modify_usertags[]', String(id)])
  return postForm(tagSet, fields)
}
