// drag-select 的補點：瀏覽器的 mousemove 間隔跟著手速放大，只看事件落點的話，甩得快就會
// 整顆跳過窄 chip。兩次事件之間每隔 DRAG_PATH_SPACING 補一點，每點各 hit-test 一次。

export interface Point {
  x: number
  y: number
}

/** 補點間距（px）。比最窄的 chip 窄得多，又不會讓一次大跨度的 mousemove 做上百次 hit-test */
export const DRAG_PATH_SPACING = 4

/**
 * from → to 之間每隔 spacing 取一點，不含 from、含 to。
 * from 已經在上一段處理過，所以不再回傳；兩點重合時只回傳 to。
 */
export function interpolate(from: Point, to: Point, spacing: number = DRAG_PATH_SPACING): Point[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / spacing))
  const points: Point[] = []
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    points.push({ x: from.x + dx * t, y: from.y + dy * t })
  }
  // 終點直接用 to，浮點誤差會讓 from + dx 偏離真正的游標位置
  points.push({ x: to.x, y: to.y })
  return points
}
