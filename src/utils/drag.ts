export function hideDragImage(dataTransfer: DataTransfer) {
  const img = new Image()
  dataTransfer.setDragImage(img, 0, 0)
}

export const baseDragOptions = {
  animation: 150,
  forceFallback: true,
  setData: hideDragImage,
}
