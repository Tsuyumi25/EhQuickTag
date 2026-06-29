// Gallery taglist 的 drag-select 純函數狀態機。
//
// 狀態 (DragSelectState):
//   idle        — 沒有 mouse 互動進行中
//   pressed     — mousedown 之後但還沒過 threshold，可能變成 click 或 drag
//   dragging    — 過了 threshold，正在 drag
//
// 事件 (DragSelectEvent):
//   mousedown / mousemove / mouseup（坐標 + 該位置的 chip）
//
// 效應 (DragSelectEffect):
//   apply       — caller 對 chip 套 setSelection(id, mode)
//   panelTag    — caller 對 chip 觸發 setPanelTag(id)
//
// Cohort 規則：drag 只影響跟 cohort 同態的 chip。computeCohort 由「起點狀態套
// delta 後是否變動」決定：
//   - 起點 0 + 左 → cohort 0 (0 → 1 會變)
//   - 起點 1 + 右 → cohort 1 (1 → 0 會變)
//   - 起點 -1 + 左 → cohort -1 (-1 → 0 會變)
//   - 起點 1 + 左 → cohort 0 (1 → 1 不變、fall through 到 add 模式)
//   - 起點 -1 + 右 → cohort 0 (-1 → -1 不變、fall through)
//   - 起點空白 → cohort 暫不定 (null)，等第一個 drag 進入的 chip 決定
//
// Click semantic（pressed → mouseup，未過 threshold）：直接套 delta 到 initialChip，
// 不走 cohort filter（單一 chip 不需要 group constraint，clamp 自然處理）。

export type Selection = 'positive' | 'negative'
export type TriState = -1 | 0 | 1
export type Cohort = TriState

export interface ChipRef {
  id: string
  state: TriState
}

export type DragSelectState =
  | { kind: 'idle' }
  | {
      kind: 'pressed'
      mode: Selection
      startX: number
      startY: number
      initialChip: ChipRef | null
      cohort: Cohort | null // null = 等第一個 chip 來定 cohort
    }
  | {
      kind: 'dragging'
      mode: Selection
      cohort: Cohort | null
      toggled: ReadonlySet<string>
    }

export type DragSelectEvent =
  | {
      kind: 'mousedown'
      button: number // 0 = left, 2 = right; 其他 button 會被 reducer 忽略
      x: number
      y: number
      chip: ChipRef | null
    }
  | { kind: 'mousemove'; x: number; y: number; chip: ChipRef | null }
  | { kind: 'mouseup' }

export type DragSelectEffect =
  | { kind: 'apply'; id: string; mode: Selection }
  | { kind: 'panelTag'; id: string }

export interface DragSelectConfig {
  /** mousemove 跨多少 px 才從 pressed 進 dragging。預設 3 */
  dragThresholdPx: number
}

export const DEFAULT_CONFIG: DragSelectConfig = { dragThresholdPx: 3 }

const IDLE: DragSelectState = { kind: 'idle' }

/** 給 start state + drag direction，回傳要套用 cohort filter 的狀態值 */
export function computeCohort(startState: TriState, mode: Selection): Cohort {
  const delta = mode === 'positive' ? 1 : -1
  const startNew = clamp(startState + delta)
  return startNew === startState ? 0 : startState
}

function clamp(n: number): TriState {
  if (n <= -1) return -1
  if (n >= 1) return 1
  return 0
}

function buttonToMode(button: number): Selection | null {
  if (button === 0) return 'positive'
  if (button === 2) return 'negative'
  return null
}

function distanceSquared(dx: number, dy: number): number {
  return dx * dx + dy * dy
}

export interface ReduceResult {
  state: DragSelectState
  effects: DragSelectEffect[]
}

/**
 * 純函數 reducer：(state, event, config) → (state', effects[])。
 * 不接觸 DOM、不 mutate 輸入。
 */
export function reduce(
  state: DragSelectState,
  event: DragSelectEvent,
  config: DragSelectConfig = DEFAULT_CONFIG,
): ReduceResult {
  switch (state.kind) {
    case 'idle':
      return reduceIdle(event)
    case 'pressed':
      return reducePressed(state, event, config)
    case 'dragging':
      return reduceDragging(state, event)
  }
}

function reduceIdle(event: DragSelectEvent): ReduceResult {
  if (event.kind !== 'mousedown') return { state: IDLE, effects: [] }
  const mode = buttonToMode(event.button)
  if (!mode) return { state: IDLE, effects: [] }
  const cohort = event.chip ? computeCohort(event.chip.state, mode) : null
  return {
    state: {
      kind: 'pressed',
      mode,
      startX: event.x,
      startY: event.y,
      initialChip: event.chip,
      cohort,
    },
    effects: [],
  }
}

function reducePressed(
  state: Extract<DragSelectState, { kind: 'pressed' }>,
  event: DragSelectEvent,
  config: DragSelectConfig,
): ReduceResult {
  if (event.kind === 'mouseup') {
    // pressed → mouseup = click 語意：直接套 delta 到初始 chip（沒 cohort filter）
    const effects: DragSelectEffect[] = []
    if (state.initialChip) {
      effects.push({ kind: 'apply', id: state.initialChip.id, mode: state.mode })
      effects.push({ kind: 'panelTag', id: state.initialChip.id })
    }
    return { state: IDLE, effects }
  }
  if (event.kind !== 'mousemove') return { state, effects: [] }

  const dx = event.x - state.startX
  const dy = event.y - state.startY
  if (distanceSquared(dx, dy) < config.dragThresholdPx ** 2) {
    return { state, effects: [] }
  }

  // 過 threshold → 進 dragging
  const toggled = new Set<string>()
  const effects: DragSelectEffect[] = []
  let cohort = state.cohort

  // 處理 initial chip：如果 cohort 已定且 initial chip state 跟 cohort 同 → 套用
  if (state.initialChip && cohort !== null && state.initialChip.state === cohort) {
    effects.push({ kind: 'apply', id: state.initialChip.id, mode: state.mode })
    effects.push({ kind: 'panelTag', id: state.initialChip.id })
    toggled.add(state.initialChip.id)
  }

  // 處理當前 chip：可能跟 initial 同 chip、可能新 chip、可能空白
  if (event.chip && !toggled.has(event.chip.id)) {
    if (cohort === null) cohort = computeCohort(event.chip.state, state.mode)
    if (event.chip.state === cohort) {
      effects.push({ kind: 'apply', id: event.chip.id, mode: state.mode })
      effects.push({ kind: 'panelTag', id: event.chip.id })
      toggled.add(event.chip.id)
    }
  }

  return {
    state: {
      kind: 'dragging',
      mode: state.mode,
      cohort,
      toggled,
    },
    effects,
  }
}

function reduceDragging(
  state: Extract<DragSelectState, { kind: 'dragging' }>,
  event: DragSelectEvent,
): ReduceResult {
  if (event.kind === 'mouseup') return { state: IDLE, effects: [] }
  if (event.kind !== 'mousemove') return { state, effects: [] }
  if (!event.chip) return { state, effects: [] }
  if (state.toggled.has(event.chip.id)) return { state, effects: [] }

  let cohort = state.cohort
  if (cohort === null) cohort = computeCohort(event.chip.state, state.mode)

  if (event.chip.state !== cohort) {
    // cohort 已定但 chip 不同態 → 跳過、不入 toggled（之後 state 改變還能處理）
    return { state: { ...state, cohort }, effects: [] }
  }

  const toggled = new Set(state.toggled)
  toggled.add(event.chip.id)
  return {
    state: {
      kind: 'dragging',
      mode: state.mode,
      cohort,
      toggled,
    },
    effects: [
      { kind: 'apply', id: event.chip.id, mode: state.mode },
      { kind: 'panelTag', id: event.chip.id },
    ],
  }
}

// ===  Store：把 state ownership 收進 closure，外面只看 dispatch / state 查詢 ===
//
// reduce() 是 pure：(state, event) → (state', effects)，給 property test 直接打。
// createDragSelectStore() 是 imperative wrapper：closure 拿著當前 state、外面
// dispatch event 進來，store 回傳 effects 給 caller 跑副作用。Vue composable 只
// 需要 store + DOM event 翻譯，不用碰 state shape

export interface DragSelectStore {
  /** 餵 event 給 reducer、回傳 effects 給 caller 執行 */
  dispatch(event: DragSelectEvent): DragSelectEffect[]
  /** 當前 state 唯讀查詢 */
  state(): DragSelectState
  /** 等同 state().kind === 'idle'，給 composable 早 return 用 */
  isIdle(): boolean
}

export function createDragSelectStore(
  config: DragSelectConfig = DEFAULT_CONFIG,
): DragSelectStore {
  let current: DragSelectState = IDLE
  return {
    dispatch(event) {
      const r = reduce(current, event, config)
      current = r.state
      return r.effects
    },
    state() {
      return current
    },
    isIdle() {
      return current.kind === 'idle'
    },
  }
}
