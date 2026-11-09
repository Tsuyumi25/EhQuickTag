import { GM } from '$'
import type { DblClickAction } from '@/services/store'

/** 搜尋送出去會到的網址：有原生表單就照表單欄位（分類、進階選項）組，沒有就只帶 f_search */
export function searchHref(form: HTMLFormElement | null, query: string): string {
  if (form) {
    const url = new URL(form.action || window.location.href)
    new FormData(form).forEach((v, k) => url.searchParams.set(k, v as string))
    return url.href
  }
  const url = new URL('/', window.location.href)
  url.searchParams.set('f_search', query)
  return url.href
}

export function submitSearch(
  action: DblClickAction,
  form: HTMLFormElement | null,
  query: string,
  newTabActive?: boolean,
): void {
  if (form && action !== 'searchNewTab') {
    form.submit()
    return
  }
  // 沒原生表單的頁面永遠開新分頁，避免搜尋離開當前頁。
  // fire-and-forget；GM.openInTab 視 manager 實作回 control 物件或 Promise，
  // Promise.resolve 收齊兩種、`.catch` 兜底避免 unhandled rejection 噴 console
  Promise.resolve(GM.openInTab(searchHref(form, query), { active: newTabActive ?? true })).catch(() => {})
}
