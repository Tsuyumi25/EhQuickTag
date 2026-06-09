export function hideDragImage(dataTransfer: DataTransfer) {
  const img = new Image()
  dataTransfer.setDragImage(img, 0, 0)
}

export const baseDragOptions = {
  animation: 150,
  forceFallback: true,
  setData: hideDragImage,
}

// Sortablejs group 名稱：TagBar 內部 buttons-line 跨行重排 + SearchPanel chip
// clone-out 共用同一個 group，這樣 SearchPanel chip 才能 drop 進 TagBar。
// 雙方都 import 這顆 const 避免 rename / 加第三個參與者時兩處 hardcode 漂移
export const EQT_TAGS_GROUP = 'eqt-tags'
