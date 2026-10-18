// useDragSelect: drag-select 狀態機的 Vue / DOM adapter。
//
// 狀態機本身（含 state ownership）在 services/gallery/dragSelectMachine 的
// createDragSelectStore，這層只負責：
//   - DOM mousedown / mousemove / mouseup 翻譯成 reducer event
//   - 把 store 回傳的 effects 派給 caller 注入的 callback
//   - 透過 @vueuse/core useEventListener 處理 document-level 監聽的 auto cleanup
//
// caller 注入 chipFromEvent (DOM hit-test) + applySelection / setPanelTag (業務動作)
import { useEventListener } from '@vueuse/core'
import {
  createDragSelectStore,
  type ChipRef,
  type Selection,
  type DragSelectConfig,
  type DragSelectEvent,
} from '@/services/gallery/dragSelectMachine'

export interface UseDragSelectOptions {
  /**
   * DOM hit-test：滑鼠事件底下的 chip ref，不在 chip 上是 null。chip 上有浮層時 target 不是 chip，
   * caller 才需要自己拿座標 elementFromPoint
   */
  chipFromEvent: (event: MouseEvent) => ChipRef | null
  /** 對 chip 套用 selection delta（toggle 邏輯由 caller 那邊的 setSelection 負責） */
  applySelection: (id: string, mode: Selection) => void
  /** chip 被選取時觸發 intro panel 顯示 */
  setPanelTag?: (id: string) => void
  /** reducer 設定。預設 dragThresholdPx=3 */
  config?: Partial<DragSelectConfig>
  /**
   * 是否啟用 drag-select。false 時 threshold = Infinity，reducer 永遠不進 dragging，
   * 行為等同單純 click（pressed → mouseup → 對 initialChip 套 delta）
   */
  enabled?: () => boolean
  takeOver?: boolean
}

export function useDragSelect(opts: UseDragSelectOptions): {
  onAreaMouseDown: (e: MouseEvent) => void
} {
  const baseThreshold = opts.config?.dragThresholdPx ?? 3
  const store = createDragSelectStore(() => ({
    dragThresholdPx: opts.enabled?.() === false ? Infinity : baseThreshold,
  }))

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
    dispatch({
      kind: 'mousedown',
      button: e.button,
      x: e.clientX,
      y: e.clientY,
      chip: opts.chipFromEvent(e),
    })
  }

  useEventListener(document, 'mousemove', (e: MouseEvent) => {
    if (store.isIdle()) return
    if (opts.takeOver) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    dispatch({
      kind: 'mousemove',
      x: e.clientX,
      y: e.clientY,
      chip: opts.chipFromEvent(e),
    })
  }, { capture: opts.takeOver })

  useEventListener(document, 'mouseup', (e: MouseEvent) => {
    if (store.isIdle()) return
    if (opts.takeOver) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    dispatch({ kind: 'mouseup' })
  }, { capture: opts.takeOver })

  return { onAreaMouseDown }
}
