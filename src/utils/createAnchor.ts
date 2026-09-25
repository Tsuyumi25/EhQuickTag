import { watch } from 'vue'
import { fontFamily, fontWeight } from '@/services/store'

export function createAnchor(id: string): HTMLDivElement {
  const anchor = document.createElement('div')
  anchor.id = id
  // Teleport 掛載點可能在 #eqt-app 外，需各自阻擋翻譯插件改寫文字。
  anchor.setAttribute('translate', 'no')
  watch([fontFamily, fontWeight], ([family, weight]) => {
    if (family) anchor.style.setProperty('--eqt-font-family', family)
    else anchor.style.removeProperty('--eqt-font-family')
    if (weight) anchor.style.setProperty('--eqt-font-weight', weight)
    else anchor.style.removeProperty('--eqt-font-weight')
  }, { immediate: true })
  return anchor
}
