// useDragSelect: drag-select 狀態機的 Vue / DOM adapter。
//
// 狀態機本身（含 state ownership）在 services/gallery/dragSelectMachine 的
// createDragSelectStore，這層只負責：
//   - DOM mousedown / mousemove / mouseup 翻譯成 reducer event；實體滑鼠鍵照設定換成 +1 / −1 / OR
//   - 把 store 回傳的 effects 派給 caller 注入的 callback
//   - 透過 @vueuse/core useEventListener 處理 document-level 監聽的 auto cleanup
//
// 兩次 mousemove 之間會補點、每點各 hit-test 一次：瀏覽器的 mousemove 間隔跟著手速放大，
// 只看事件落點的話，甩得快就會整顆跳過窄 chip。過了門檻之後沿游標畫一條軌跡（全域開關）。
//
// caller 注入 chipAt (DOM hit-test) + applySelection / setPanelTag (業務動作)
import { shallowRef, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  createDragSelectStore,
  type ChipRef,
  type DragSelectConfig,
  type DragSelectEvent,
} from '@/services/gallery/dragSelectMachine'
import type { Selection } from '@/services/tagPick'
import { interpolate, type Point } from '@/services/gallery/dragPath'
import { endTrail, extendTrail, startTrail } from '@/composables/paintTrailCanvas'
import { dragTrailEnabled, mouseRoles } from '@/services/store'
import type { MouseButtonName } from '@/services/mouseRoles'

const BUTTON_NAMES: Record<number, MouseButtonName> = { 0: 'left', 1: 'middle', 2: 'right' }

export interface UseDragSelectOptions {
  /** viewport 座標底下的 chip ref，不在 chip 上是 null。補出來的點沒有事件，所以只能吃座標 */
  chipAt: (x: number, y: number) => ChipRef | null
  /** 對 chip 套用 selection delta（toggle 邏輯由 caller 那邊的 setSelection 負責） */
  applySelection: (id: string, mode: Selection) => void
  /** chip 被選取時觸發 intro panel 顯示 */
  setPanelTag?: (id: string) => void
  /** reducer 設定。預設 dragThresholdPx=3 */
  config?: Partial<DragSelectConfig>
  takeOver?: boolean
  /**
   * 刷選途中只記下要套的 chip、放開才一起套。給「套用後 chip 會離開原位」的清單用（歷史紀錄
   * 加回搜尋就從那一列消失）：邊刷邊套的話後面的 chip 會補位滑到游標底下被順手刷到。
   * 單擊本來就在放開時才套，不受影響
   */
  deferApply?: boolean
}

export function useDragSelect(opts: UseDragSelectOptions): {
  onAreaMouseDown: (e: MouseEvent) => void
  /** deferApply 時這趟刷到、還沒套的 chip 跟按下的動作，給 caller 畫預覽；沒開 deferApply 恆為空 */
  pending: Readonly<Ref<ReadonlyMap<string, Selection>>>
} {
  const dragThresholdPx = opts.config?.dragThresholdPx ?? 3
  const store = createDragSelectStore(() => ({ dragThresholdPx }))
  let lastPoint: Point | null = null
  const pending = shallowRef<ReadonlyMap<string, Selection>>(new Map())

  function dispatch(event: DragSelectEvent): void {
    const effects = store.dispatch(event)
    const deferring = opts.deferApply && store.state().kind === 'dragging'
    for (const eff of effects) {
      if (eff.kind === 'apply') {
        if (deferring) pending.value = new Map(pending.value).set(eff.id, eff.mode)
        else opts.applySelection(eff.id, eff.mode)
      } else if (eff.kind === 'panelTag') opts.setPanelTag?.(eff.id)
    }
  }

  function flushPending(): void {
    const batch = pending.value
    if (!batch.size) return
    pending.value = new Map()
    for (const [id, mode] of batch) opts.applySelection(id, mode)
  }

  function onAreaMouseDown(e: MouseEvent): void {
    const button = BUTTON_NAMES[e.button]
    if (!button) return
    // 中鍵在 tag 區裡一律接手，跟左右鍵一樣能從空隙開始拖；按下時先擋掉瀏覽器的自動捲動與貼上
    if (opts.takeOver || e.button === 1) e.preventDefault()
    if (opts.takeOver) e.stopImmediatePropagation()
    lastPoint = { x: e.clientX, y: e.clientY }
    dispatch({ kind: 'mousedown', mode: mouseRoles.value[button], x: e.clientX, y: e.clientY, chip: opts.chipAt(e.clientX, e.clientY) })
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
      if (state.kind === 'dragging' && !wasDragging && dragTrailEnabled.value) startTrail(state.mode, p)
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
    flushPending()
  }, { capture: opts.takeOver })

  return { onAreaMouseDown, pending }
}
