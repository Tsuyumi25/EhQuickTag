import { GM } from '$'
import type { DblClickAction } from '@/services/store'

export function submitSearch(
  action: DblClickAction,
  form: HTMLFormElement | null,
  query: string,
  newTabActive?: boolean,
): void {
  if (form) {
    if (action === 'searchNewTab') {
      const url = new URL(form.action || window.location.href)
      new FormData(form).forEach((v, k) => url.searchParams.set(k, v as string))
      // fire-and-forget；GM.openInTab 視 manager 實作回 control 物件或 Promise，
      // Promise.resolve 收齊兩種、`.catch` 兜底避免 unhandled rejection 噴 console
      Promise.resolve(GM.openInTab(url.href, { active: newTabActive ?? true })).catch(() => {})
    } else {
      form.submit()
    }
    return
  }
  // 沒原生表單的頁面永遠開新分頁，避免搜尋離開當前頁。
  const url = new URL('/', window.location.href)
  url.searchParams.set('f_search', query)
  Promise.resolve(GM.openInTab(url.href, { active: newTabActive ?? true })).catch(() => {})
}
