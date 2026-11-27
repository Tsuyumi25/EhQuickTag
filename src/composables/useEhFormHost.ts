import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { createPageContext } from '@/composables/createPageContext'
import { createAnchor } from '@/utils/createAnchor'

export interface EhFormHost {
  input: HTMLInputElement
  searchText: Ref<string>
}

export interface EhTagBarHost {
  anchor: HTMLElement
  setControlsWidth(width: number): void
}

// 只同步原生搜尋框的文字，不動 DOM：TagBar 關掉時，列表 dock、搜尋 popup 仍要能就地送出原生表單
function setupEhFormHost(): EhFormHost | null {
  // 搜尋頁的輸入框是 id="f_search"；favorites.php 的只有 name="f_search"、沒有 id，用 name 兩邊都認得
  const input = document.querySelector<HTMLInputElement>('input[name="f_search"]')
  if (!input) return null

  const searchText = ref(input.value)
  const readInput = () => { searchText.value = input.value }
  input.addEventListener('input', readInput)
  watch(searchText, (value) => {
    if (input.value !== value) input.value = value
  })
  onScopeDispose(() => input.removeEventListener('input', readInput))

  return { input, searchText }
}

export const useEhFormHost = createPageContext(setupEhFormHost)

function setupEhTagBarHost(): EhTagBarHost | null {
  const form = useEhFormHost()
  if (!form) return null
  const { input } = form
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

  return {
    anchor,
    setControlsWidth(width) {
      parent.style.setProperty('--eqt-controls-w', `${width}px`)
    },
  }
}

/** 接管原生搜尋列、掛上 TagBar（標籤列與搜尋面板）的 Teleport 目標。兩個都關時不呼叫，原生搜尋列原封不動 */
export const useEhTagBarHost = createPageContext(setupEhTagBarHost)
