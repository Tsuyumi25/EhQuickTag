import { describe, it, expect } from 'vitest'
import { tagColors, type TagColorInput } from '@/services/mytagsColors'

const base = { color: '', setColor: '', weight: 10, hidden: false }

/** 選中的那個 base 色會落在 face 或 edge，看亮度決定——這裡只問「選了哪個」 */
function chosen(input: TagColorInput): string[] {
  const c = tagColors(input)
  return [c.face, c.edge]
}

describe('tagColors · 沒設色時的退路', () => {
  it('權重不是負的、也沒隱藏 → 藍', () => {
    expect(chosen({ ...base, weight: 0 })).toContain('3377FF')
  })

  it('權重是負的 → 紅', () => {
    expect(chosen({ ...base, weight: -1 })).toContain('FF6666')
  })

  it('硬隱藏 → 紅，權重再高也一樣', () => {
    expect(chosen({ ...base, weight: 99, hidden: true })).toContain('FF6666')
  })

  it('標籤集的預設色排在權重規則前面', () => {
    expect(chosen({ ...base, setColor: '#AABBCC', weight: -5 })).toContain('AABBCC')
  })

  it('標籤自己的顏色又排在標籤集前面', () => {
    expect(chosen({ ...base, color: '#112233', setColor: '#AABBCC' })).toContain('112233')
  })
})

describe('tagColors · 亮度決定文字色與明暗配置', () => {
  it('亮底 → 深色文字，原色當面、深色當外圈', () => {
    const c = tagColors({ ...base, color: 'FFFFFF' })
    expect(c.text).toBe('090909')
    expect(c.face).toBe('FFFFFF')
    expect(c.edge).toBe('dfdfdf')      // 255 - 32
  })

  it('暗底 → 淺色文字，明暗對調', () => {
    const c = tagColors({ ...base, color: '000000' })
    expect(c.text).toBe('f1f1f1')
    expect(c.face).toBe('000000')      // 0 - 32 夾回 0
    expect(c.edge).toBe('000000')
  })

  it('每個通道各自減 32，不是整體變暗', () => {
    expect(tagColors({ ...base, color: 'FF8040' }).edge).toBe('df6020')
  })
})

describe('tagColors · 壞掉的輸入不要吐 NaN 給 CSS', () => {
  it('色碼不是 hex 就退回中性色', () => {
    const c = tagColors({ ...base, color: 'ZZZZZZ' })
    expect(c.face).toBe('3377FF')
    expect(c.edge).toBe('3377FF')
  })
})
