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

const RECT_LEFT = 156
const RECT_RIGHT = 196
const RECT_CENTER = (RECT_LEFT + RECT_RIGHT) / 2

function input(overrides: Partial<SpacerResizeInput>): SpacerResizeInput {
  return {
    align: 'left',
    side: 'right',
    widthF: 40,
    deltaX: 0,
    rectLeft: RECT_LEFT,
    rectRight: RECT_RIGHT,
    targetsL: TARGETS_L,
    targetsR: TARGETS_R,
    maxWidth: 400,
    ...overrides,
  }
}

// 測試自己表達的預期模型(刻意不共用被測模組的 edgePosition):給定套用後的寬度,
// 被拖的那一緣應該落在哪
function draggedEdge(align: SpacerResizeInput['align'], side: 'left' | 'right', width: number): number {
  if (align === 'center') return side === 'right' ? RECT_CENTER + width / 2 : RECT_CENTER - width / 2
  return side === 'right' ? RECT_LEFT + width : RECT_RIGHT - width
}

// 沒有任何吸附目標的場景——用來單獨驗證寬度累積與位移導數
const NO_TARGETS = { targetsL: [], targetsR: [] } as const

describe('computeSpacerResize · 意圖寬度累積', () => {
  it('left 行右把手:向右拖增寬', () => {
    const r = computeSpacerResize(input({ ...NO_TARGETS, deltaX: 10 }))
    expect(r).toEqual({ widthF: 50, width: 50, guideX: null, guideIndex: null })
  })

  it('right 行左把手:向左拖增寬', () => {
    const r = computeSpacerResize(input({ ...NO_TARGETS, align: 'right', side: 'left', deltaX: -10 }))
    expect(r.widthF).toBe(50)
  })

  it('center 行:兩端各攤一半,增量加倍才跟得上手', () => {
    const right = computeSpacerResize(input({ ...NO_TARGETS, align: 'center', deltaX: 5 }))
    expect(right.widthF).toBe(50)
    const left = computeSpacerResize(input({ ...NO_TARGETS, align: 'center', side: 'left', deltaX: -5 }))
    expect(left.widthF).toBe(50)
  })

  it('下限 clamp 到 SPACER_MIN_WIDTH', () => {
    const r = computeSpacerResize(input({ ...NO_TARGETS, deltaX: -1000 }))
    expect(r.widthF).toBe(SPACER_MIN_WIDTH)
    expect(r.width).toBe(SPACER_MIN_WIDTH)
  })

  it('上限 clamp 到行容器寬', () => {
    const r = computeSpacerResize(input({ ...NO_TARGETS, deltaX: 1000, maxWidth: 300 }))
    expect(r.widthF).toBe(300)
    expect(r.width).toBe(300)
  })

  it('冪等:同一輸入重複計算得到同一結果', () => {
    const a = computeSpacerResize(input({ deltaX: -22 }))
    const b = computeSpacerResize(input({ deltaX: -22 }))
    expect(a).toEqual(b)
  })
})

// 這是分層的核心不變式:被拖的那一緣「跟著手指走」是這個互動的定義,所以它
// 對 deltaX 的位移導數在四種對齊 / 把手組合下都必須是 1。吸附層正是靠這點
// 才能只做減法、不必為每種對齊各寫一條反解公式
describe('computeSpacerResize · 被拖緣的位移導數恆為 1', () => {
  const cases = [
    { name: 'left 行右把手', align: 'left', side: 'right', deltaX: 10 },
    { name: 'right 行左把手', align: 'right', side: 'left', deltaX: -10 },
    { name: 'center 行右把手', align: 'center', side: 'right', deltaX: 7 },
    { name: 'center 行左把手', align: 'center', side: 'left', deltaX: -7 },
  ] as const

  for (const c of cases) {
    it(`${c.name}:拖 ${c.deltaX}px,被拖緣就移動 ${c.deltaX}px`, () => {
      const before = draggedEdge(c.align, c.side, 40)
      const r = computeSpacerResize(input({ ...NO_TARGETS, align: c.align, side: c.side, deltaX: c.deltaX }))
      const after = draggedEdge(c.align, c.side, r.width)
      expect(after - before).toBeCloseTo(c.deltaX)
    })
  }
})

describe('computeSpacerResize · 吸附(left 行:左緣是錨)', () => {
  it('右緣接近參照右緣時吸上去', () => {
    // widthF 18 → 右緣預測 174,距目標 176 差 2 ≤ SNAP_RANGE
    const r = computeSpacerResize(input({ deltaX: -22 }))
    expect(r.widthF).toBe(18)                          // 意圖寬不被吸附覆蓋
    expect(r.width).toBe(176 - RECT_LEFT)
    expect(draggedEdge('left', 'right', r.width)).toBe(176)
    expect(r.guideX).toBe(176)
  })

  it('意圖寬跟著手走,滑出範圍即脫離吸附', () => {
    // 上一題吸附中(widthF=18),繼續向左拖 6 → 右緣預測 168,距 176 差 8…
    const snapped = computeSpacerResize(input({ deltaX: -22 }))
    const still = computeSpacerResize(input({ widthF: snapped.widthF, deltaX: -6 }))
    expect(still.guideX).toBe(176)      // 差 8 = SNAP_RANGE,仍在範圍邊緣
    const out = computeSpacerResize(input({ widthF: still.widthF, deltaX: -1 }))
    expect(out.guideX).toBeNull()       // 再 1px 就脫離
    expect(out.width).toBe(11)
  })
})

describe('computeSpacerResize · 吸附(right 行:右緣是錨,完整鏡像)', () => {
  it('左緣接近參照左緣時吸上去', () => {
    // widthF 82 → 左緣預測 114,距目標 112 差 2
    const r = computeSpacerResize(input({ align: 'right', side: 'left', deltaX: -42 }))
    expect(r.widthF).toBe(82)
    expect(r.width).toBe(RECT_RIGHT - 112)
    expect(draggedEdge('right', 'left', r.width)).toBe(112)
    expect(r.guideX).toBe(112)
  })
})

describe('computeSpacerResize · 吸附(center 行:中心是不變量,兩緣都能吸)', () => {
  it('被拖的右緣吸右', () => {
    // 中心 176。widthF 50 → 右緣預測 201,目標 200 差 1
    const r = computeSpacerResize(input({
      align: 'center', deltaX: 5,
      targetsL: [], targetsR: [200],
    }))
    expect(r.width).toBe(2 * (200 - RECT_CENTER))
    expect(draggedEdge('center', 'right', r.width)).toBe(200)
    expect(r.guideX).toBe(200)
  })

  it('對稱移動的左緣也能吸(導數 -1)', () => {
    // widthF 50 → 左緣預測 151,目標 150 差 1
    const r = computeSpacerResize(input({
      align: 'center', deltaX: 5,
      targetsL: [150], targetsR: [],
    }))
    expect(r.width).toBe(2 * (RECT_CENTER - 150))
    expect(draggedEdge('center', 'left', r.width)).toBe(150)
    expect(r.guideX).toBe(150)
  })

  it('兩緣同時有候選時取全局最近', () => {
    // 右緣預測 201 距 200 差 1;左緣預測 151 距 149 差 2 → 右緣勝
    const r = computeSpacerResize(input({
      align: 'center', deltaX: 5,
      targetsL: [149], targetsR: [200],
    }))
    expect(r.guideX).toBe(200)
  })
})

describe('computeSpacerResize · 釘死的錨緣不能當吸附來源', () => {
  it('left 行:左緣貼著目標也不吸(拖再多它都不動)', () => {
    // 左緣實測 156,離目標 160 只差 4,但 left 行的左緣是錨
    const r = computeSpacerResize(input({ targetsL: [160], targetsR: [] }))
    expect(r.guideX).toBeNull()
    expect(r.width).toBe(40)
  })

  it('right 行:右緣同理', () => {
    // 右緣實測 196,離目標 200 只差 4
    const r = computeSpacerResize(input({
      align: 'right', side: 'left',
      targetsL: [], targetsR: [200],
    }))
    expect(r.guideX).toBeNull()
    expect(r.width).toBe(40)
  })
})

// 吸附解要先真的落在目標上才算數。上下限會把構不到的解吃掉,這時 guide 線
// 必須跟著消失——否則線會停在一個寬度永遠到不了的位置
describe('computeSpacerResize · 落不到目標時退回不吸附', () => {
  it('吸附解超過行容器寬', () => {
    // 目標 176 需要寬 20,maxWidth 15 容不下
    const r = computeSpacerResize(input({ deltaX: -22, maxWidth: 15 }))
    expect(r.guideX).toBeNull()
    expect(r.width).toBe(15)
  })

  it('吸附解小於最小寬', () => {
    // 目標 160 需要寬 4,低於 SPACER_MIN_WIDTH
    const r = computeSpacerResize(input({
      widthF: SPACER_MIN_WIDTH, deltaX: 0,
      targetsL: [], targetsR: [160],
    }))
    expect(r.guideX).toBeNull()
    expect(r.width).toBe(SPACER_MIN_WIDTH)
  })
})

// 呼叫端要拿命中的那顆 item 的 y 範圍畫輔助線,而 y 不能在 pointerdown 時快照
// (拖曳中自己這行折行數一變,下方行整批垂直位移)。所以吸附得回報索引,讓呼叫端
// 當場重量那一顆
describe('computeSpacerResize · 回報命中目標的索引', () => {
  it('右緣命中:索引指向 targetsR 裡的位置', () => {
    const r = computeSpacerResize(input({ deltaX: -22 }))
    expect(r.guideX).toBe(176)
    expect(r.guideIndex).toBe(TARGETS_R.indexOf(176))
  })

  it('左緣命中:索引指向 targetsL 裡的位置(兩集合平行,對應同一顆 item)', () => {
    const r = computeSpacerResize(input({ align: 'right', side: 'left', deltaX: -42 }))
    expect(r.guideX).toBe(112)
    expect(r.guideIndex).toBe(TARGETS_L.indexOf(112))
  })

  it('未命中時為 null', () => {
    const r = computeSpacerResize(input({ ...NO_TARGETS, deltaX: 10 }))
    expect(r.guideIndex).toBeNull()
  })

  it('吸附解落不到目標而退回時也為 null', () => {
    const r = computeSpacerResize(input({ deltaX: -22, maxWidth: 15 }))
    expect(r.guideIndex).toBeNull()
  })
})

describe('computeSpacerResize · 吸附範圍邊界', () => {
  it('恰好在 SNAP_RANGE 上仍吸附,超出 1px 不吸', () => {
    // 右緣預測 = 156 + widthF;目標 176
    const at = computeSpacerResize(input({ widthF: 176 - RECT_LEFT - SPACER_SNAP_RANGE, deltaX: 0 }))
    expect(at.guideX).toBe(176)
    const beyond = computeSpacerResize(input({ widthF: 176 - RECT_LEFT - SPACER_SNAP_RANGE - 1, deltaX: 0 }))
    expect(beyond.guideX).toBeNull()
  })
})
