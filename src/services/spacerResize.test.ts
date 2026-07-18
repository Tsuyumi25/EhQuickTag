import { describe, it, expect } from 'vitest'
import {
  computeSpacerResize,
  SPACER_MIN_WIDTH,
  SPACER_SNAP_RANGE,
  type SpacerResizeInput,
} from './spacerResize'

// 基準場景(座標皆 viewport 絕對 x):
//   參照行:  [中文]     [全彩]      [間隔]        [單行本]
//             0──52     56──108     112──176      180──248
//   被拖的 spacer 實測 rect:left=156、right=196(寬 40)
const TARGETS_L = [0, 56, 112, 180] as const
const TARGETS_R = [52, 108, 176, 248] as const

function input(overrides: Partial<SpacerResizeInput>): SpacerResizeInput {
  return {
    align: 'left',
    side: 'right',
    widthF: 40,
    deltaX: 0,
    rectLeft: 156,
    rectRight: 196,
    targetsL: TARGETS_L,
    targetsR: TARGETS_R,
    maxWidth: 400,
    ...overrides,
  }
}

describe('computeSpacerResize · left 行(左緣錨、右吸右)', () => {
  it('自由拖曳:增量直接累積,無吸附', () => {
    const r = computeSpacerResize(input({ deltaX: 10 }))
    // predR = 156 + 50 = 206,距最近目標 176 / 248 都超出吸附範圍
    expect(r).toEqual({ widthF: 50, width: 50, guideX: null })
  })

  it('右緣接近參照右緣時吸附(gap 恆等式的核心場景)', () => {
    // widthF 18 → predR = 174,距目標 176 差 2 ≤ SNAP_RANGE
    const r = computeSpacerResize(input({ deltaX: -22 }))
    expect(r.widthF).toBe(18)           // 意圖寬不被吸附覆蓋
    expect(r.width).toBe(176 - 156)     // 吸附解:右緣正好落在 176
    expect(r.guideX).toBe(176)
  })

  it('意圖寬跟著手走,滑出範圍即脫離吸附', () => {
    // 上一題吸附中(widthF=18),繼續向左拖 6 → predR = 168,距 176 差 8…
    const snapped = computeSpacerResize(input({ deltaX: -22 }))
    const still = computeSpacerResize(input({ widthF: snapped.widthF, deltaX: -6 }))
    expect(still.guideX).toBe(176)      // 差 8 = SNAP_RANGE,仍在範圍邊緣
    const out = computeSpacerResize(input({ widthF: still.widthF, deltaX: -1 }))
    expect(out.guideX).toBeNull()       // 再 1px 就脫離
    expect(out.width).toBe(11)
  })

  it('下限 clamp 到 SPACER_MIN_WIDTH', () => {
    const r = computeSpacerResize(input({ deltaX: -1000 }))
    expect(r.widthF).toBe(SPACER_MIN_WIDTH)
    expect(r.width).toBe(SPACER_MIN_WIDTH)
  })

  it('上限 clamp 到行容器寬', () => {
    const r = computeSpacerResize(input({ deltaX: 1000, maxWidth: 300 }))
    expect(r.widthF).toBe(300)
    expect(r.width).toBe(300)
  })

  it('超行寬的吸附解被排除', () => {
    // 目標 176 需要寬 20,maxWidth 15 容不下 → 不吸,raw 也被 clamp
    const r = computeSpacerResize(input({ deltaX: -22, maxWidth: 15 }))
    expect(r.guideX).toBeNull()
    expect(r.width).toBe(15)
  })

  it('冪等:同一輸入重複計算得到同一結果', () => {
    const a = computeSpacerResize(input({ deltaX: -22 }))
    const b = computeSpacerResize(input({ deltaX: -22 }))
    expect(a).toEqual(b)
  })
})

describe('computeSpacerResize · right 行(右緣錨、左吸左)', () => {
  it('左把手向左拖增寬(scale = -1)', () => {
    const r = computeSpacerResize(input({ align: 'right', side: 'left', deltaX: -10 }))
    expect(r.widthF).toBe(50)
  })

  it('左緣接近參照左緣時吸附(完整鏡像)', () => {
    // widthF 46 → predL = 196 - 46 = 150…調 deltaX 讓 predL 靠近目標 148?
    // 目標集沒有 148——用 targetsL 的 112:widthF 82 → predL = 114,差 2
    const r = computeSpacerResize(input({ align: 'right', side: 'left', deltaX: -42 }))
    expect(r.widthF).toBe(82)
    expect(r.width).toBe(196 - 112)     // 左緣正好落在 112
    expect(r.guideX).toBe(112)
  })
})

describe('computeSpacerResize · center 行(中心不變量、雙邊吸附)', () => {
  it('增量 ×2 讓被拖的邊跟手', () => {
    const r = computeSpacerResize(input({ align: 'center', deltaX: 5 }))
    expect(r.widthF).toBe(50)
  })

  it('左把手在 center 行同樣增寬(scale = -2)', () => {
    const r = computeSpacerResize(input({ align: 'center', side: 'left', deltaX: -5 }))
    expect(r.widthF).toBe(50)
  })

  it('右緣候選:width = 2 × (目標 − 中心)', () => {
    // 中心 = 176。widthF 50 → predR = 201,目標 200 差 1 → 吸
    const r = computeSpacerResize(input({
      align: 'center', deltaX: 5,
      targetsL: [], targetsR: [200],
    }))
    expect(r.width).toBe(2 * (200 - 176))
    expect(r.guideX).toBe(200)
  })

  it('左緣候選:width = 2 × (中心 − 目標)', () => {
    // widthF 50 → predL = 151,目標 150 差 1 → 吸
    const r = computeSpacerResize(input({
      align: 'center', deltaX: 5,
      targetsL: [150], targetsR: [],
    }))
    expect(r.width).toBe(2 * (176 - 150))
    expect(r.guideX).toBe(150)
  })

  it('雙邊候選取全局最近', () => {
    // predR = 201 距 200 差 1;predL = 151 距 149 差 2 → 右緣候選勝
    const r = computeSpacerResize(input({
      align: 'center', deltaX: 5,
      targetsL: [149], targetsR: [200],
    }))
    expect(r.guideX).toBe(200)
  })
})

describe('computeSpacerResize · 吸附範圍邊界', () => {
  it('恰好在 SNAP_RANGE 上仍吸附,超出 1px 不吸', () => {
    // predR = 156 + widthF;目標 176
    const at = computeSpacerResize(input({ widthF: 176 - 156 - SPACER_SNAP_RANGE, deltaX: 0 }))
    expect(at.guideX).toBe(176)
    const beyond = computeSpacerResize(input({ widthF: 176 - 156 - SPACER_SNAP_RANGE - 1, deltaX: 0 }))
    expect(beyond.guideX).toBeNull()
  })
})
