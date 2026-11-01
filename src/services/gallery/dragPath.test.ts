import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { interpolate } from './dragPath'

const coord = fc.double({ min: -2000, max: 2000, noNaN: true })
const point = fc.record({ x: coord, y: coord })

describe('interpolate', () => {
  test.prop([point, point, fc.double({ min: 1, max: 20, noNaN: true })])(
    '從 from 開始走，相鄰兩點間距不超過 spacing，終點恰好是 to',
    (from, to, spacing) => {
      const points = interpolate(from, to, spacing)
      expect(points.at(-1)).toEqual(to)
      let prev = from
      for (const p of points) {
        expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThanOrEqual(spacing + 1e-9)
        prev = p
      }
    },
  )

  it('兩點重合只回傳終點，不重複判定起點', () => {
    expect(interpolate({ x: 5, y: 5 }, { x: 5, y: 5 }, 4)).toEqual([{ x: 5, y: 5 }])
  })
})
