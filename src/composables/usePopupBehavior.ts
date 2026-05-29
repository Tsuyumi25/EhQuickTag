import { provide, type Ref } from 'vue'
import { onClickOutside, useScrollLock, useEventListener } from '@vueuse/core'

// 子元件（譬如 LineColorSwatch）可以 inject 這個 register 函數，
// 把自己 teleport 到 body 的浮層 el 註冊進 ignore list。
// register 回傳 unregister 函數，讓子元件 watch 自己的 popupEl 切換時主動清理。
export const POPUP_IGNORE_KEY = Symbol('popup-register-ignore')
export type PopupIgnoreRegister = (el: HTMLElement) => () => void

export function usePopupBehavior(options: {
  popupEl: Ref<HTMLElement | null>
  // onClose 由呼叫端決定優先級（譬如「先關 inner autocomplete，否則 emit close」）。
  // Esc 和 onClickOutside 都會走這個 callback。
  onClose: () => void
  // Ctrl+Enter 觸發。沒有 onSave 的 popup（譬如 SettingsPopup 改動即時生效）可省略。
  onSave?: () => void
}): void {
  // plain array：vueuse 的 onClickOutside 每次點擊事件 iterate 一次，
  // 所以後續 push/splice 都會被看到。reactive 不必要（DOM nodes 也不適合被 proxy）。
  const ignoreList: HTMLElement[] = []

  provide<PopupIgnoreRegister>(POPUP_IGNORE_KEY, (el) => {
    ignoreList.push(el)
    return () => {
      const idx = ignoreList.indexOf(el)
      if (idx >= 0) ignoreList.splice(idx, 1)
    }
  })

  onClickOutside(options.popupEl, options.onClose, {
    ignore: ignoreList,
  })

  useScrollLock(document.body, true)

  useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      options.onClose()
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && options.onSave) {
      e.preventDefault()
      options.onSave()
    }
  })
}
