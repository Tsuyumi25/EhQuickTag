import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { stepPick, type TagPick, type Selection } from './tagPick'

const PICKS: TagPick[] = [-1, 0, 1, 'or']
const pickArb = fc.constantFrom(...PICKS)
const pressArb = fc.constantFrom<Selection>('positive', 'negative', 'or')

describe('stepPick', () => {
  it.each<[TagPick, Selection, TagPick]>([
    [-1, 'positive', 0], [0, 'positive', 1], [1, 'positive', 1],
    [1, 'negative', 0], [0, 'negative', -1], [-1, 'negative', -1],
    ['or', 'positive', 1], ['or', 'negative', 0], ['or', 'or', 'or'],
  ])('%s + %s → %s', (from, press, to) => {
    expect(stepPick(from, press)).toBe(to)
  })

  test.prop([pickArb])('中鍵：一律到 OR', (pick) => {
    expect(stepPick(pick, 'or')).toBe('or')
  })

  test.prop([fc.array(fc.constantFrom<Selection>('positive', 'negative'), { maxLength: 20 })])(
    '只用左右鍵永遠到不了 OR',
    (presses) => {
      expect(presses.reduce<TagPick>((pick, press) => stepPick(pick, press), 0)).not.toBe('or')
    },
  )
})

describe('stepPick: allowed 缺格時原地不動', () => {
  it('沒有 -1 的按鈕（positive-multi）：0 上按右鍵不動', () => {
    expect(stepPick(0, 'negative', new Set<TagPick>([0, 1, 'or']))).toBe(0)
  })

  it('沒有 OR 的按鈕：中鍵不動', () => {
    expect(stepPick(0, 'or', new Set<TagPick>([-1, 0, 1]))).toBe(0)
    expect(stepPick(1, 'or', new Set<TagPick>([-1, 0, 1]))).toBe(1)
  })

  test.prop([pickArb, pressArb, fc.subarray(PICKS, { minLength: 1 })])(
    '落點一定在 allowed 裡，或者等於出發點',
    (pick, press, allowed) => {
      const next = stepPick(pick, press, new Set(allowed))
      expect(next === pick || allowed.includes(next)).toBe(true)
    },
  )
})
