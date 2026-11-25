export function createAnchor(id: string): HTMLDivElement {
  const anchor = document.createElement('div')
  anchor.id = id
  // Teleport 掛載點可能在 #eqt-app 外，需各自阻擋翻譯插件改寫文字。
  anchor.setAttribute('translate', 'no')
  return anchor
}
