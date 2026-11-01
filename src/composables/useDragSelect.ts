// useDragSelect: drag-select 狀態機的 Vue / DOM adapter。
//
// 狀態機本身（含 state ownership）在 services/gallery/dragSelectMachine 的
// createDragSelectStore，這層只負責：
//   - DOM mousedown / mousemove / mouseup 翻譯成 reducer event
//   - 把 store 回傳的 effects 派給 caller 注入的 callback
//   - 透過 @vueuse/core useEventListener 處理 document-level 監聽的 auto cleanup
//
// 兩次 mousemove 之間會補點、每點各 hit-test 一次：瀏覽器的 mousemove 間隔跟著手速放大，
// 只看事件落點的話，甩得快就會整顆跳過窄 chip。過了門檻之後沿游標畫一條軌跡。
//
// caller 注入 chipAt (DOM hit-test) + applySelection / setPanelTag (業務動作)
import { useEventListener } from '@vueuse/core'
import {
  createDragSelectStore,
  type ChipRef,
  type Selection,
  type DragSelectConfig,
  type DragSelectEvent,
} from '@/services/gallery/dragSelectMachine'
import { interpolate, type Point } from '@/services/gallery/dragPath'
import { endTrail, extendTrail, startTrail } from '@/composables/paintTrailCanvas'

export interface UseDragSelectOptions {
  /** viewport 座標底下的 chip ref，不在 chip 上是 null。補出來的點沒有事件，所以只能吃座標 */
  chipAt: (x: number, y: number) => ChipRef | null
  /** 對 chip 套用 selection delta（toggle 邏輯由 caller 那邊的 setSelection 負責） */
  applySelection: (id: string, mode: Selection) => void
  /** chip 被選取時觸發 intro panel 顯示 */
  setPanelTag?: (id: string) => void
  /** 每趟 drag 跨過門檻時問一次要不要畫軌跡；設定中途改了，下一趟生效 */
  trail: () => boolean
  /** reducer 設定。預設 dragThresholdPx=3 */
  config?: Partial<DragSelectConfig>
  takeOver?: boolean
}

export function useDragSelect(opts: UseDragSelectOptions): {
  onAreaMouseDown: (e: MouseEvent) => void
} {
  const dragThresholdPx = opts.config?.dragThresholdPx ?? 3
  const store = createDragSelectStore(() => ({ dragThresholdPx }))
  let lastPoint: Point | null = null

  function dispatch(event: DragSelectEvent): void {
    const effects = store.dispatch(event)
    for (const eff of effects) {
      if (eff.kind === 'apply') opts.applySelection(eff.id, eff.mode)
      else if (eff.kind === 'panelTag') opts.setPanelTag?.(eff.id)
    }
  }

  function onAreaMouseDown(e: MouseEvent): void {
    if (e.button !== 0 && e.button !== 2) return
    if (opts.takeOver) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    lastPoint = { x: e.clientX, y: e.clientY }
    dispatch({
      kind: 'mousedown',
      button: e.button,
      x: e.clientX,
      y: e.clientY,
      chip: opts.chipAt(e.clientX, e.clientY),
    })
  }

  useEventListener(document, 'mousemove', (e: MouseEvent) => {
    if (store.isIdle()) return
    if (opts.takeOver) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    const to = { x: e.clientX, y: e.clientY }
    for (const p of interpolate(lastPoint ?? to, to)) {
      const wasDragging = store.state().kind === 'dragging'
      dispatch({ kind: 'mousemove', x: p.x, y: p.y, chip: opts.chipAt(p.x, p.y) })
      const state = store.state()
      // 軌跡從過了門檻才開始畫：沒過門檻的放開是單擊，單擊不該冒出筆跡
      if (state.kind === 'dragging' && !wasDragging && opts.trail()) startTrail(state.mode, p)
    }
    lastPoint = to
    if (store.state().kind === 'dragging') extendTrail(to)
  }, { capture: opts.takeOver })

  useEventListener(document, 'mouseup', (e: MouseEvent) => {
    if (store.isIdle()) return
    if (opts.takeOver) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    lastPoint = null
    endTrail()
    dispatch({ kind: 'mouseup' })
  }, { capture: opts.takeOver })

  return { onAreaMouseDown }
}
