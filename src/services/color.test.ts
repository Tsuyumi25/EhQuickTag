import { describe, expect, it } from 'vitest'
import { formatRgbInput, parseColorInput } from '@/services/color'

describe('parseColorInput', () => {
  it('alpha 模式補上不透明通道', () => {
    expect(parseColorInput('#abc', true)).toBe('#aabbccff')
    expect(parseColorInput('rgb(17, 34, 51)', true)).toBe('#112233ff')
  })

  it('alpha 模式保留透明度', () => {
    expect(parseColorInput('#abcd', true)).toBe('#aabbccdd')
    expect(parseColorInput('rgba(17, 34, 51, 0.5)', true)).toBe('#11223380')
  })

  it('不含 alpha 的模式只回傳六位色號', () => {
    expect(parseColorInput('#abcd', false)).toBe('#aabbcc')
    expect(parseColorInput('#11223380', false)).toBe('#112233')
    expect(parseColorInput('rgba(17, 34, 51, 0.5)', false)).toBe('#112233')
  })

  it('拒絕無法解析的顏色', () => {
    expect(parseColorInput('#12', false)).toBeNull()
    expect(parseColorInput('sample', true)).toBeNull()
  })
})

describe('formatRgbInput', () => {
  it('不含 alpha 的模式忽略來源透明度', () => {
    expect(formatRgbInput('#11223380', false)).toBe('rgb(17, 34, 51)')
  })

  it('alpha 模式顯示來源透明度', () => {
    expect(formatRgbInput('#11223380', true)).toBe('rgba(17, 34, 51, 0.5)')
  })
})
