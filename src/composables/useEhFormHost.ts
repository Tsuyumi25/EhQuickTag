// 在 EH 列表頁的 search form 內植入 wrapper / anchor，回傳 handle 給 caller
// 接 Vue 反應式狀態。所有跟 EH 自己 DOM 打交道的事都收在這——querySelector、
// reparent、CSS var setter

export interface EhFormHost {
  input: HTMLInputElement
  anchor: HTMLElement
  setControlsWidth(width: number): void
}

export function useEhFormHost(): EhFormHost | null {
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

  // TagBar Teleport 目標。擋外部翻譯插件（如 EH 翻譯腳本）污染 i18n 過的按鈕
  // 文字——main.ts 的 #eqt-app 已經有 translate=no、anchor 是另一棵樹要獨立補
  const anchor = document.createElement('div')
  anchor.id = 'eqt-bar-anchor'
  anchor.setAttribute('translate', 'no')
  parent.appendChild(anchor)

  return {
    input,
    anchor,
    setControlsWidth(width) {
      parent.style.setProperty('--eqt-controls-w', `${width}px`)
    },
  }
}
