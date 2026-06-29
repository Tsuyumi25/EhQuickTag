// useDragSelect: drag-select 狀態機的 Vue / DOM adapter。
//
// 狀態機本身（含 state ownership）在 services/gallery/dragSelectMachine 的
// createDragSelectStore，這層只負責：
//   - DOM mousedown / mousemove / mouseup 翻譯成 reducer event
//   - 把 store 回傳的 effects 派給 caller 注入的 callback
//   - 透過 @vueuse/core useEventListener 處理 document-level 監聽的 auto cleanup
//
// caller 注入 chipFromPoint (DOM hit-test) + applySelection / setPanelTag (業務動作)
import { useEventListener } from '@vueuse/core'
import {
  createDragSelectStore,
  type ChipRef,
  type Selection,
  type DragSelectConfig,
  type DragSelectEvent,
} from '@/services/gallery/dragSelectMachine'

export interface UseDragSelectOptions {
  /** DOM hit-test：給定 viewport 座標回傳 chip ref 或 null（不在 chip 上） */
  chipFromPoint: (x: number, y: number) => ChipRef | null
  /** 對 chip 套用 selection delta（toggle 邏輯由 caller 那邊的 setSelection 負責） */
  applySelection: (id: string, mode: Selection) => void
  /** chip 被選取時觸發 intro panel 顯示 */
  setPanelTag: (id: string) => void
  /** reducer 設定。預設 dragThresholdPx=3 */
  config?: Partial<DragSelectConfig>
  /**
   * 是否啟用 drag-select。false 時 threshold = Infinity，reducer 永遠不進 dragging，
   * 行為等同單純 click（pressed → mouseup → 對 initialChip 套 delta）
   */
  enabled?: () => boolean
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
      else if (eff.kind === 'panelTag') opts.setPanelTag(eff.id)
    }
  }

  function onAreaMouseDown(e: MouseEvent): void {
    dispatch({
      kind: 'mousedown',
      button: e.button,
      x: e.clientX,
      y: e.clientY,
      chip: opts.chipFromPoint(e.clientX, e.clientY),
    })
  }

  useEventListener(document, 'mousemove', (e: MouseEvent) => {
    if (store.isIdle()) return
    dispatch({
      kind: 'mousemove',
      x: e.clientX,
      y: e.clientY,
      chip: opts.chipFromPoint(e.clientX, e.clientY),
    })
  })

  useEventListener(document, 'mouseup', () => {
    if (store.isIdle()) return
    dispatch({ kind: 'mouseup' })
  })

  return { onAreaMouseDown }
}
