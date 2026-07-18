import type { LineTextAlign } from '@/types'

// 間隔(fixed spacer)拖曳 resize 的純計算核心。跟 gallery 的 dragSelectMachine
// 同一套分工:數學住在可單元測試的純函式裡,TagBar 的 pointer handler 只當
// 薄 DOM adapter(量 rect、餵輸入、套結果)。
//
// 閉環實測模型:寬度是唯一控制量,由逐次滑鼠增量累積;吸附候選基於 spacer
// 當下實測 rect 計算,公式冪等——同一組輸入永遠得到同一組輸出,pointermove
// 快於渲染幀時重複計算無害。行內 flex-wrap 折行只改 spacer 的位置不改寬度,
// 下一次實測自動反映新現實,不需要快照補償。
//
// 吸附邊由「行的有效對齊」決定,核心是 gap 恆等式——對齊「按鈕的邊」等價於
// 對齊「相鄰 item 的反向邊」,兩邊各自的 flex gap 在等式兩側同時出現、互相抵消:
//   left 行:行首釘死、左緣是錨,預測右緣 = 實測左緣 + 意圖寬 → 右吸右
//   right 行:行尾釘死在容器右緣、右緣是錨 → 左吸左
//   center 行:兩端各以半速對稱伸縮,中心是數學不變量——「兩邊同時對齊」
//     無解,但單邊對齊可解:左右緣各對自己的目標集合產生吸附候選,取全局
//     最近者;增量 ×2 讓被拖的邊跟手

export const DEFAULT_SPACER_WIDTH = 40
export const SPACER_MIN_WIDTH = 8
export const SPACER_SNAP_RANGE = 8

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

export function computeSpacerResize(input: SpacerResizeInput): SpacerResizeResult {
  // 增量方向 / 倍率:被拖的把手在左緣時向左拖增寬(負向);center 行兩端
  // 對稱伸縮、各攤一半,×2 才能讓被拖的邊跟手
  const dir = input.side === 'left' ? -1 : 1
  const scale = (input.align === 'center' ? 2 : 1) * dir

  // 意圖寬度 = 逐次增量的浮點累積,夾在 [最小寬, 行寬] 內。吸附命中不覆蓋
  // 它——它一直跟著手走,滑出吸附範圍即自然脫離
  const widthF = Math.min(
    input.maxWidth,
    Math.max(SPACER_MIN_WIDTH, input.widthF + input.deltaX * scale),
  )

  // 吸附 = 候選比較:對每個(目標邊緣, spacer 動邊)解出「吸上去所需的寬度」
  // 與意圖位置的距離,取範圍內全局最近者。超行寬的解一併排除——渲染端
  // max-width 會擋住實際位置,吸了也到不了目標
  const candidates: { d: number; w: number; x: number }[] = []
  const consider = (d: number, w: number, x: number): void => {
    if (d <= SPACER_SNAP_RANGE && w >= SPACER_MIN_WIDTH && w <= input.maxWidth) {
      candidates.push({ d, w, x })
    }
  }
  if (input.align === 'left') {
    const predR = input.rectLeft + widthF
    for (const t of input.targetsR) consider(Math.abs(t - predR), t - input.rectLeft, t)
  } else if (input.align === 'right') {
    const predL = input.rectRight - widthF
    for (const t of input.targetsL) consider(Math.abs(t - predL), input.rectRight - t, t)
  } else {
    const center = (input.rectLeft + input.rectRight) / 2
    const predR = center + widthF / 2
    const predL = center - widthF / 2
    for (const t of input.targetsR) consider(Math.abs(t - predR), 2 * (t - center), t)
    for (const t of input.targetsL) consider(Math.abs(t - predL), 2 * (center - t), t)
  }

  let best: { d: number; w: number; x: number } | null = null
  for (const c of candidates) {
    if (!best || c.d < best.d) best = c
  }

  return {
    widthF,
    width: Math.round(best ? best.w : widthF),
    guideX: best ? best.x : null,
  }
}
