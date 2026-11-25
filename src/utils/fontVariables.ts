import { watch } from 'vue'
import { fontFamily, fontWeight } from '@/services/store'

// 掛在 <html>：Teleport 到 body 的浮層（列表 dock、說明框、右鍵選單）不在任何掛載點底下，
// 變數只放在掛載點上的話它們讀不到
export function bindFontVariables(root: HTMLElement): void {
  watch([fontFamily, fontWeight], ([family, weight]) => {
    if (family) root.style.setProperty('--eqt-font-family', family)
    else root.style.removeProperty('--eqt-font-family')
    if (weight) root.style.setProperty('--eqt-font-weight', weight)
    else root.style.removeProperty('--eqt-font-weight')
  }, { immediate: true })
}
