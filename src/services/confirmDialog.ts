// 頁面內的確認框，取代 window.confirm()。
//
// ⚠️ 原生 confirm() 被使用者勾了「不要讓這個頁面再顯示對話框」之後，會不跳窗直接回
// false，跟按取消分不出來——刪除鍵就變成按了沒反應。這個設定以整個站為單位，EH 自己
// 的對話框也能觸發它。

import { shallowRef } from 'vue'

export interface ConfirmRequest {
  message: string
  /** 確認鍵寫出後果（例如「刪除」），不用「確定」 */
  confirmLabel: string
  resolve: (ok: boolean) => void
}

export const confirmRequest = shallowRef<ConfirmRequest | null>(null)

export function askConfirm(message: string, confirmLabel: string): Promise<boolean> {
  confirmRequest.value?.resolve(false)
  const { promise, resolve } = Promise.withResolvers<boolean>()
  confirmRequest.value = {
    message,
    confirmLabel,
    resolve: (ok) => {
      confirmRequest.value = null
      resolve(ok)
    },
  }
  return promise
}
