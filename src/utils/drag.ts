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

// 行層級自己一個 group：底部工具箱 clone-out 的新行 / 分隔線要 drop 進
// line-rows，而 line-rows 不能收 EQT_TAGS_GROUP 的按鈕（按鈕屬於行內）
export const EQT_LINES_GROUP = 'eqt-lines'
