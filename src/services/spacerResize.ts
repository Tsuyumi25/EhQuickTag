import type { LineTextAlign } from '@/types'

// 間隔(fixed spacer)拖曳 resize 的純計算核心。跟 gallery 的 dragSelectMachine
// 同一套分工:數學住在可單元測試的純函式裡,TagBar 的 pointer handler 只當
// 薄 DOM adapter(量 rect、餵輸入、套結果)。
//
// 閉環實測模型:寬度是唯一控制量,由逐次滑鼠增量累積;每次呼叫都以 spacer 當下
// 的實測 rect 為參考系,公式冪等——同一組輸入永遠得到同一組輸出,pointermove
// 快於渲染幀時重複計算無害。行內 flex-wrap 折行只改 spacer 的位置不改寬度,
// 下一次實測自動反映新現實,不需要快照補償。
//
// 檔內分三層,吸附層不認識 resize 的幾何:
//
//   1. 幾何   edgeSensitivity / edgePosition——「這一緣在哪、對寬度多敏感」
//   2. 吸附   findSnapNudge——只做減法:目標與預測位置的差,除以位移導數
//   3. 組合   computeSpacerResize——先算不吸附的結果,求出修正量後把它加回
//             位移、重跑同一條寬度公式,最後驗證那一緣真的落在目標上
//
// 這樣切的理由:吸附的輸出是「位移還差多少」而不是「該有多寬」,於是三種對齊
// 共用同一個求解迴圈,倍率(center 行的 ×2)只存在於 scale 一處。位移導數
// dEdge/dDeltaX = edgeSensitivity × scale 展開後恆為 +1(被拖的那一緣,定義上
// 跟著手指走)、-1(center 行對稱移動的另一緣)或 0(釘死的錨緣,不能當吸附來源)。
//
// 座標一律用 viewport 絕對 x。吸附判斷是「絕對對絕對」做差,天然是相對量,所以
// flex gap 不進計算——對齊「按鈕的邊」與對齊「相鄰 item 的反向邊」等價,兩邊各自
// 的 gap 在等式兩側同時出現、互相抵消。

export const DEFAULT_SPACER_WIDTH = 40
export const SPACER_MIN_WIDTH = 8
export const SPACER_SNAP_RANGE = 8

// 整數化後允許的落點誤差。Math.round 對寬度最多帶來半 px 偏移(center 行減半),
// 再留一點浮點餘裕。超過這個量代表吸附解被上下限吃掉了,不是捨入造成的
const SNAP_LANDING_TOLERANCE = 0.51

type Edge = 'left' | 'right'

export interface SpacerResizeInput {
  align: LineTextAlign
  side: 'left' | 'right'       // 被拖的把手(center 行兩緣都有把手)
  widthF: number               // 當前意圖寬度(浮點累積)
  deltaX: number               // 本次滑鼠位移(clientX - lastX)
  rectLeft: number             // spacer 當下實測左緣(viewport 絕對 x)
  rectRight: number
  targetsL: readonly number[]  // 參照 item 左緣集合,viewport 絕對 x(供 spacer 左緣吸)
  targetsR: readonly number[]  // 參照 item 右緣集合(供 spacer 右緣吸)
  maxWidth: number             // 行容器寬:「間隔永遠不寬於它的行」
}

export interface SpacerResizeResult {
  widthF: number           // 新意圖寬度(回存,下次呼叫的輸入)
  width: number            // 應套用的整數寬(吸附命中時為吸附解)
  guideX: number | null    // 吸附目標的 viewport 絕對 x;未命中為 null
}

interface SnapNudge {
  distance: number   // 預測位置與目標的距離,用來挑最近的候選
  deltaX: number     // 位移還差多少才能讓那一緣落在目標上
  edge: Edge
  target: number
}

// 這一緣的位置對「寬度」的靈敏度。left / right 行各有一緣釘死在行的端點
// (靈敏度 0);center 行中心是不變量,兩緣各攤一半
function edgeSensitivity(align: LineTextAlign, edge: Edge): number {
  if (align === 'center') return edge === 'right' ? 0.5 : -0.5
  if (align === 'left') return edge === 'right' ? 1 : 0
  return edge === 'left' ? -1 : 0
}

// 給定寬度時這一緣會落在哪。釘死的那一緣直接回實測值——它不隨寬度動
function edgePosition(
  align: LineTextAlign,
  edge: Edge,
  width: number,
  rectLeft: number,
  rectRight: number,
): number {
  if (align === 'left') return edge === 'left' ? rectLeft : rectLeft + width
  if (align === 'right') return edge === 'right' ? rectRight : rectRight - width
  const center = (rectLeft + rectRight) / 2
  return edge === 'right' ? center + width / 2 : center - width / 2
}

// 吸附層:對每個「動得了的緣」× 每個目標算一次差,取範圍內最近者。這裡不解寬度、
// 不認識 center 的倍率,只把距離換算成「位移還差多少」
function findSnapNudge(input: SpacerResizeInput, widthF: number, scale: number): SnapNudge | null {
  let best: SnapNudge | null = null

  const collect = (edge: Edge, targets: readonly number[]): void => {
    const motion = edgeSensitivity(input.align, edge) * scale
    if (motion === 0) return   // 錨緣:拖再多也不動,不能吸
    const predicted = edgePosition(input.align, edge, widthF, input.rectLeft, input.rectRight)
    for (const target of targets) {
      const distance = Math.abs(target - predicted)
      if (distance > SPACER_SNAP_RANGE) continue
      // 平手取先到者(收集順序來自 DOM,穩定)
      if (best && distance >= best.distance) continue
      best = { distance, deltaX: (target - predicted) / motion, edge, target }
    }
  }

  collect('left', input.targetsL)
  collect('right', input.targetsR)
  return best
}

export function computeSpacerResize(input: SpacerResizeInput): SpacerResizeResult {
  // 增量方向 / 倍率:被拖的把手在左緣時向左拖增寬(負向);center 行兩端
  // 對稱伸縮、各攤一半,×2 才能讓被拖的邊跟手
  const dir = input.side === 'left' ? -1 : 1
  const scale = (input.align === 'center' ? 2 : 1) * dir

  const clampWidth = (w: number): number =>
    Math.min(input.maxWidth, Math.max(SPACER_MIN_WIDTH, w))

  // 不吸附的結果。意圖寬度是逐次增量的浮點累積,吸附不覆蓋它——它一直跟著手走,
  // 滑出吸附範圍即自然脫離
  const widthF = clampWidth(input.widthF + input.deltaX * scale)
  const unsnapped: SpacerResizeResult = { widthF, width: Math.round(widthF), guideX: null }

  const nudge = findSnapNudge(input, widthF, scale)
  if (!nudge) return unsnapped

  // 把修正量加回位移,重跑同一條寬度公式
  const width = Math.round(clampWidth(widthF + nudge.deltaX * scale))

  // 驗證吸附真的成立才畫線:上下限可能把解吃掉(目標比行容器還遠、或需要的寬度
  // 小於最小寬),整數化也有半 px 誤差。落不到目標就退回不吸附的結果,guide 線
  // 因此永遠與實際套用的寬度一致
  const landed = edgePosition(input.align, nudge.edge, width, input.rectLeft, input.rectRight)
  if (Math.abs(landed - nudge.target) > SNAP_LANDING_TOLERANCE) return unsnapped

  return { widthF, width, guideX: nudge.target }
}
