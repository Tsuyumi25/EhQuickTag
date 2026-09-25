import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { createPageContext } from '@/composables/createPageContext'
import { createAnchor } from '@/utils/createAnchor'

export interface EhFormHost {
  input: HTMLInputElement
  searchText: Ref<string>
  anchor: HTMLElement
  setControlsWidth(width: number): void
}

function setupEhFormHost(): EhFormHost | null {
  const input = document.querySelector<HTMLInputElement>('#f_search')
  if (!input) return null

  const parent = input.parentElement!

  // 原生三件套 wrapper：type-based selector 沿用 fix(search-controls) 那輪——
  // EH 原生 input、EHS 漢化插件改寫後的 button 都保留 type 屬性
  const submitEl = parent.querySelector<HTMLElement>(':scope > [type="submit"]')
  const clearEl = parent.querySelector<HTMLElement>(':scope > [type="button"]')
  const nativeRow = document.createElement('div')
  nativeRow.className = 'eqt-native-search-row'
  parent.insertBefore(nativeRow, input)
  nativeRow.appendChild(input)
  if (submitEl) nativeRow.appendChild(submitEl)
  if (clearEl) nativeRow.appendChild(clearEl)

  const anchor = createAnchor('eqt-bar-anchor')
  parent.appendChild(anchor)

  const searchText = ref(input.value)
  const readInput = () => { searchText.value = input.value }
  input.addEventListener('input', readInput)
  watch(searchText, (value) => {
    if (input.value !== value) input.value = value
  })
  onScopeDispose(() => input.removeEventListener('input', readInput))

  return {
    input,
    searchText,
    anchor,
    setControlsWidth(width) {
      parent.style.setProperty('--eqt-controls-w', `${width}px`)
    },
  }
}

export const useEhFormHost = createPageContext(setupEhFormHost)
