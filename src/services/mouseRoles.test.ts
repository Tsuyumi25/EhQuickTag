import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { assignRole, MOUSE_BUTTONS, type MouseRoles } from './mouseRoles'
import type { Selection } from './tagPick'

const DEFAULT: MouseRoles = { left: 'positive', middle: 'or', right: 'negative' }
const rolesArb = fc.constantFrom<Selection[]>(
  ['positive', 'negative', 'or'], ['positive', 'or', 'negative'], ['negative', 'positive', 'or'],
  ['negative', 'or', 'positive'], ['or', 'positive', 'negative'], ['or', 'negative', 'positive'],
).map(([left, middle, right]): MouseRoles => ({ left, middle, right }))

describe('assignRole', () => {
  it('選了別顆鍵正在用的動作，兩顆互換', () => {
    expect(assignRole(DEFAULT, 'left', 'negative')).toEqual({ left: 'negative', middle: 'or', right: 'positive' })
  })

  test.prop([rolesArb, fc.constantFrom(...MOUSE_BUTTONS), fc.constantFrom<Selection>('positive', 'negative', 'or')])(
    '結果一定是三個動作各一顆鍵，而且那顆鍵拿到指定的動作',
    (roles, button, role) => {
      const next = assignRole(roles, button, role)
      expect(next[button]).toBe(role)
      expect(new Set(Object.values(next)).size).toBe(3)
    },
  )
})
