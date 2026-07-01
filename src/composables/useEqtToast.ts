// Vue-Toastification useToast() 的 branded wrapper——所有 toast 一律加
// [EhQuickTag] 前綴，避免使用者裝多個 userscript 時搞不清是哪個插件跳的訊息。
//
// callers 用法跟原生 useToast 完全一樣，只是換 import。有需要 raw toast (不加
// 前綴) 時可以繼續用 vue-toastification 的 useToast。
import { useToast as useToastification } from 'vue-toastification'

const PREFIX = '[EhQuickTag] '

export function useEqtToast() {
  const toast = useToastification()
  return {
    success: (msg: string) => toast.success(PREFIX + msg),
    error:   (msg: string) => toast.error(PREFIX + msg),
    warning: (msg: string) => toast.warning(PREFIX + msg),
    info:    (msg: string) => toast.info(PREFIX + msg),
  }
}
