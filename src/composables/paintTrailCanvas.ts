// drag-select 筆刷軌跡的 canvas adapter。輪廓由 @excalidraw/laser-pointer 算：整條軌跡是
// 一個多邊形，尾巴靠線寬縮到 0 消失，不靠透明度——每幀一次 fill，交疊處也不會變深。
//
// 點存頁面座標、畫的時候扣掉捲動量，拖曳中捲動頁面線會黏在內容上。
//
// 同一時間只會有一趟 drag，所以 canvas 整個頁面共用一張：gallery taglist、listing 卡片、
// dock 三處的 useDragSelect 都畫在這裡，不各自掛 overlay。
import { LaserPointer, type SizeMappingDetails } from '@excalidraw/laser-pointer'
import type { Point } from '@/services/gallery/dragPath'
import type { Selection } from '@/services/tagPick'
import '@/styles/paint-trail.scss'

/** 筆刷半徑（px） */
const TRAIL_RADIUS = 4
// 實色會把線底下的 chip 文字整段蓋掉
const TRAIL_ALPHA = 0.5
/** 落筆後多久縮到 0 */
const DECAY_MS = 300
/** 離游標第幾個點之後縮到 0；點是 mousemove 事件數，不是 px */
const DECAY_POINTS = 20

// laser-pointer 讓 sizeMapping 決定每個點的半徑倍率；點的第三個分量（pressure）拿來存落筆時間。
// 時間與長度兩種衰減取小的，跟 Excalidraw 的 eraser／laser 同一個形狀
function easeOut(k: number): number {
  return 1 - (1 - k) ** 4
}
function sizeMapping({ pressure: born, totalLength, currentIndex }: SizeMappingDetails): number {
  const byTime = Math.max(0, 1 - (performance.now() - born) / DECAY_MS)
  const byLength = (DECAY_POINTS - Math.min(DECAY_POINTS, totalLength - currentIndex)) / DECAY_POINTS
  return Math.min(easeOut(byLength), easeOut(byTime))
}

interface Trail {
  stroke: LaserPointer
  color: string
}

let context: CanvasRenderingContext2D | null = null
let current: Trail | null = null
let fading: Trail[] = []
let frame = 0

function mountCanvas(): CanvasRenderingContext2D | null {
  if (context?.canvas.isConnected) return context
  const canvas = document.createElement('canvas')
  canvas.id = 'eqt-paint-trail'
  canvas.setAttribute('translate', 'no')
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  context = canvas.getContext('2d')
  return context
}

/** canvas 的像素尺寸要乘 devicePixelRatio，否則高 DPI 螢幕上的線是糊的 */
function fitToViewport(ctx: CanvasRenderingContext2D): void {
  const dpr = window.devicePixelRatio || 1
  const width = Math.round(window.innerWidth * dpr)
  const height = Math.round(window.innerHeight * dpr)
  if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
    ctx.canvas.width = width
    ctx.canvas.height = height
  }
}

/** 回傳這條軌跡還看不看得見 */
function fillTrail(ctx: CanvasRenderingContext2D, trail: Trail): boolean {
  const outline = trail.stroke.getStrokeOutline()
  if (!outline.length) return false
  ctx.fillStyle = trail.color
  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1])
  ctx.closePath()
  ctx.fill()
  return true
}

function draw(): void {
  frame = 0
  const ctx = context
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.setTransform(dpr, 0, 0, dpr, -window.scrollX * dpr, -window.scrollY * dpr)
  ctx.globalAlpha = TRAIL_ALPHA
  fading = fading.filter(trail => fillTrail(ctx, trail))
  if (current) fillTrail(ctx, current)

  // 拖曳中就算游標停著，尾巴也還在縮，迴圈要一直跑到放開、尾巴縮完
  if (current || fading.length) frame = requestAnimationFrame(draw)
  else window.removeEventListener('scroll', scheduleDraw)
}

function scheduleDraw(): void {
  if (!frame) frame = requestAnimationFrame(draw)
}

function addPoint(trail: Trail, p: Point): void {
  trail.stroke.addPoint([p.x + window.scrollX, p.y + window.scrollY, performance.now()])
}

/** 一趟 drag 過了門檻時呼叫：定下這趟的顏色，從 origin（viewport 座標）起筆 */
export function startTrail(mode: Selection, origin: Point): void {
  const ctx = mountCanvas()
  if (!ctx) return
  fitToViewport(ctx)
  endTrail()
  // canvas 讀不到 CSS 變數，只能在起筆前把 token 解析成實際色值；兩個主題的 token 名稱相同
  const token = { positive: '--eqt-status-include', negative: '--eqt-status-exclude', or: '--eqt-status-or' }[mode]
  current = {
    stroke: new LaserPointer({ size: TRAIL_RADIUS, streamline: 0.2, keepHead: true, sizeMapping }),
    color: getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
  }
  addPoint(current, origin)
  window.addEventListener('scroll', scheduleDraw, { passive: true })
  scheduleDraw()
}

export function extendTrail(to: Point): void {
  if (!current) return
  addPoint(current, to)
  scheduleDraw()
}

/** 放開滑鼠：不再接新的點，游標處的圓頭跟著縮，剩下的尾巴照常縮完 */
export function endTrail(): void {
  if (!current) return
  current.stroke.close()
  current.stroke.options.keepHead = false
  fading.push(current)
  current = null
  scheduleDraw()
}
