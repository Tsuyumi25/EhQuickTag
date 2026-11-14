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
// Cohort 規則：drag 只影響跟起點 chip 同態的 chip（cohort = 起點狀態）。tagPick 的按法每一下
// 都會變（同一顆鍵關、別顆鍵換），同態的 chip 按同一顆鍵會走到同一個落點：
//   - 起點 0 + 左 → 只激活還沒選的，刷不到已經是 1 的
//   - 起點 1 + 左 → 只把 1 關回 0
//   - 起點 1 + 右 → 只把 1 換成 -1，依此類推
//   - 起點空白 → cohort 暫不定 (null)，等第一個 drag 進入的 chip 決定
//
// Click semantic（pressed → mouseup，未過 threshold）：直接把這個動作套到 initialChip，
// 不走 cohort filter（單一 chip 不需要 group constraint）。
//
// Panel 跟游標：聚光燈跟隨集 = cohort ∪ 已碰過(toggled)。游標進入其中之一就 setPanelTag，
// 跟 apply 的一次性 dedupe 脫鉤。toggle 後 chip state 會變，靠 toggled 仍認得出。
// panelId 記當前面板 chip，只在換 chip 時才 emit。

import type { TagPick, Selection } from '@/services/tagPick'

export type Cohort = TagPick

export interface ChipRef {
  id: string
  state: TagPick
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
      panelId: string | null // 當前 panel 顯示的 chip，只在游標換 chip 時才重新 emit
    }

export type DragSelectEvent =
  | {
      kind: 'mousedown'
      mode: Selection // 按下的鍵在設定裡被指派的動作；實體鍵怎麼對應由 caller 決定
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

/**
 * 單一 chip 的命中判定——整個檔案唯一一份規則，pressed / dragging 都呼叫。
 * toggle 後 chip.state 會變、不再等於 cohort，靠 toggled 認出仍是「這趟動過的」。
 * 不變式：apply ⟹ follow。
 */
function decideChip(
  chip: ChipRef,
  ctx: { cohort: Cohort; toggled: ReadonlySet<string> },
): { apply: boolean; follow: boolean } {
  const inCohort = chip.state === ctx.cohort
  const alreadyToggled = ctx.toggled.has(chip.id)
  return {
    apply: inCohort && !alreadyToggled,
    follow: inCohort || alreadyToggled,
  }
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
  const { mode } = event
  const cohort = event.chip?.state ?? null
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

  // 過 threshold → 進 dragging。initial chip（按下處）+ event.chip（游標處）依序過同一條
  // decideChip；同一顆 chip 時第二圈用 panelId 擋掉、只跑一次。
  const toggled = new Set<string>()
  const effects: DragSelectEffect[] = []
  let cohort = state.cohort
  let panelId: string | null = null

  for (const chip of [state.initialChip, event.chip]) {
    if (!chip || chip.id === panelId) continue
    cohort ??= chip.state
    const { apply, follow } = decideChip(chip, { cohort, toggled })
    if (apply) {
      effects.push({ kind: 'apply', id: chip.id, mode: state.mode })
      toggled.add(chip.id)
    }
    if (follow) {
      effects.push({ kind: 'panelTag', id: chip.id })
      panelId = chip.id
    }
  }

  return {
    state: {
      kind: 'dragging',
      mode: state.mode,
      cohort,
      toggled,
      panelId,
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

  const cohort = state.cohort ?? event.chip.state
  const { apply, follow } = decideChip(event.chip, { cohort, toggled: state.toggled })

  // 既不選、也不跟 → 不同態的 chip，真正的 skip。cohort 剛被這顆 chip 定下時它必定同態，走不到這裡
  if (!apply && !follow) return { state, effects: [] }

  const effects: DragSelectEffect[] = []

  let toggled = state.toggled
  if (apply) {
    toggled = new Set(state.toggled).add(event.chip.id)
    effects.push({ kind: 'apply', id: event.chip.id, mode: state.mode })
  }

  // 過了 skip 就必定 follow（apply ⟹ follow）；只在換到不同於當前面板的 chip 才 emit
  if (event.chip.id !== state.panelId) {
    effects.push({ kind: 'panelTag', id: event.chip.id })
  }

  return {
    state: {
      kind: 'dragging',
      mode: state.mode,
      cohort,
      toggled,
      panelId: event.chip.id,
    },
    effects,
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
  configOrGetter: DragSelectConfig | (() => DragSelectConfig) = DEFAULT_CONFIG,
): DragSelectStore {
  let current: DragSelectState = IDLE
  // getter 形式：caller 想要設定能 reactive 跟著變（譬如 settings toggle 改
  // threshold 來啟用 / 禁用 drag）。靜態形式保留給 test / property test 直接用
  const getConfig =
    typeof configOrGetter === 'function' ? configOrGetter : () => configOrGetter
  return {
    dispatch(event) {
      const r = reduce(current, event, getConfig())
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
