import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  reduce,
  computeCohort,
  createDragSelectStore,
  DEFAULT_CONFIG,
  type DragSelectState,
  type DragSelectEvent,
  type DragSelectEffect,
  type ChipRef,
  type Selection,
  type TriState,
} from './dragSelectMachine'

const IDLE: DragSelectState = { kind: 'idle' }

function chip(id: string, state: TriState): ChipRef {
  return { id, state }
}

function runSequence(events: DragSelectEvent[]): {
  finalState: DragSelectState
  allEffects: DragSelectEffect[]
} {
  let state: DragSelectState = IDLE
  const allEffects: DragSelectEffect[] = []
  for (const e of events) {
    const { state: next, effects } = reduce(state, e, DEFAULT_CONFIG)
    state = next
    allEffects.push(...effects)
  }
  return { finalState: state, allEffects }
}

describe('computeCohort', () => {
  // 6 個 case + 通則：cohort = (startNew === startState) ? 0 : startState
  it('start 0 + positive → cohort 0 (will move 0 → 1)', () => {
    expect(computeCohort(0, 'positive')).toBe(0)
  })
  it('start 0 + negative → cohort 0 (will move 0 → -1)', () => {
    expect(computeCohort(0, 'negative')).toBe(0)
  })
  it('start 1 + negative → cohort 1 (cancel positives)', () => {
    expect(computeCohort(1, 'negative')).toBe(1)
  })
  it('start -1 + positive → cohort -1 (cancel negatives)', () => {
    expect(computeCohort(-1, 'positive')).toBe(-1)
  })
  it('start 1 + positive → cohort 0 (capped, fall through)', () => {
    expect(computeCohort(1, 'positive')).toBe(0)
  })
  it('start -1 + negative → cohort 0 (capped, fall through)', () => {
    expect(computeCohort(-1, 'negative')).toBe(0)
  })
})

describe('reduce: idle', () => {
  it('ignores non-mousedown events', () => {
    expect(reduce(IDLE, { kind: 'mousemove', x: 10, y: 10, chip: null }, DEFAULT_CONFIG))
      .toEqual({ state: IDLE, effects: [] })
    expect(reduce(IDLE, { kind: 'mouseup' }, DEFAULT_CONFIG))
      .toEqual({ state: IDLE, effects: [] })
  })

  it('ignores mousedown with non-left/right button', () => {
    const r = reduce(IDLE, { kind: 'mousedown', button: 1, x: 0, y: 0, chip: null }, DEFAULT_CONFIG)
    expect(r.state).toEqual(IDLE)
    expect(r.effects).toEqual([])
  })

  it('mousedown(left) on empty → pressed with cohort=null', () => {
    const r = reduce(IDLE, { kind: 'mousedown', button: 0, x: 5, y: 5, chip: null }, DEFAULT_CONFIG)
    expect(r.state).toEqual({
      kind: 'pressed',
      mode: 'positive',
      startX: 5,
      startY: 5,
      initialChip: null,
      cohort: null,
    })
    expect(r.effects).toEqual([])
  })

  it('mousedown(right) on chip(1) → pressed with cohort=1', () => {
    const c = chip('a', 1)
    const r = reduce(IDLE, { kind: 'mousedown', button: 2, x: 0, y: 0, chip: c }, DEFAULT_CONFIG)
    expect(r.state).toMatchObject({ kind: 'pressed', mode: 'negative', cohort: 1 })
  })
})

describe('reduce: click semantic (pressed → mouseup without move)', () => {
  it('mousedown on chip + immediate mouseup → applies delta to initial chip', () => {
    const c = chip('a', 0)
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: c },
      { kind: 'mouseup' },
    ])
    expect(allEffects).toEqual([
      { kind: 'apply', id: 'a', mode: 'positive' },
      { kind: 'panelTag', id: 'a' },
    ])
  })

  it('mousedown on empty + mouseup → no effects (nothing to click)', () => {
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: null },
      { kind: 'mouseup' },
    ])
    expect(allEffects).toEqual([])
  })

  it('move below threshold then mouseup → still click semantic', () => {
    const c = chip('a', 1)
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 2, x: 0, y: 0, chip: c },
      { kind: 'mousemove', x: 1, y: 1, chip: c }, // distance √2 < 3
      { kind: 'mouseup' },
    ])
    expect(allEffects).toEqual([
      { kind: 'apply', id: 'a', mode: 'negative' },
      { kind: 'panelTag', id: 'a' },
    ])
  })
})

describe('reduce: drag past threshold', () => {
  it('initial chip in cohort → applied on threshold cross', () => {
    const c = chip('a', 0)
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: c },
      { kind: 'mousemove', x: 10, y: 0, chip: c },
    ])
    expect(allEffects).toEqual([
      { kind: 'apply', id: 'a', mode: 'positive' },
      { kind: 'panelTag', id: 'a' },
    ])
  })

  it('cohort filter blocks chip with mismatched state', () => {
    const start = chip('a', 0) // cohort = 0
    const next = chip('b', -1) // mismatched, should be skipped
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: start },
      { kind: 'mousemove', x: 10, y: 0, chip: next },
    ])
    // initial chip a applied (cohort 0, state 0); next chip b NOT applied (state -1 ≠ cohort 0)
    expect(allEffects).toEqual([
      { kind: 'apply', id: 'a', mode: 'positive' },
      { kind: 'panelTag', id: 'a' },
    ])
  })

  it('chip applied at most once per drag (dedupe)', () => {
    const c = chip('a', 0)
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: c },
      { kind: 'mousemove', x: 10, y: 0, chip: c }, // applies a
      { kind: 'mousemove', x: 11, y: 0, chip: c }, // still on a, should dedupe
      { kind: 'mousemove', x: 12, y: 0, chip: c },
    ])
    expect(allEffects.filter(e => e.kind === 'apply')).toEqual([
      { kind: 'apply', id: 'a', mode: 'positive' },
    ])
  })

  it('capped: start 1 + left → cohort 0 → initial chip NOT applied, but 0 chips ARE', () => {
    const start = chip('a', 1)
    const zero = chip('b', 0)
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: start },
      { kind: 'mousemove', x: 10, y: 0, chip: zero },
    ])
    expect(allEffects).toEqual([
      { kind: 'apply', id: 'b', mode: 'positive' },
      { kind: 'panelTag', id: 'b' },
    ])
  })

  it('deferred cohort: empty start, first encountered chip decides cohort', () => {
    const c1 = chip('a', 1) // first chip, state 1, right drag → cohort 1
    const c2 = chip('b', 1) // matches cohort 1 → applies
    const c3 = chip('c', 0) // mismatched cohort, skip
    const { allEffects } = runSequence([
      { kind: 'mousedown', button: 2, x: 0, y: 0, chip: null }, // empty start
      { kind: 'mousemove', x: 10, y: 0, chip: c1 }, // crosses threshold, sets cohort=1
      { kind: 'mousemove', x: 20, y: 0, chip: c2 },
      { kind: 'mousemove', x: 30, y: 0, chip: c3 },
    ])
    expect(allEffects.filter(e => e.kind === 'apply').map(e => (e as { id: string }).id))
      .toEqual(['a', 'b'])
  })

  it('mouseup ends drag, future mousemove ignored', () => {
    const c = chip('a', 0)
    const c2 = chip('b', 0)
    const { finalState, allEffects } = runSequence([
      { kind: 'mousedown', button: 0, x: 0, y: 0, chip: c },
      { kind: 'mousemove', x: 10, y: 0, chip: c },
      { kind: 'mouseup' },
      { kind: 'mousemove', x: 20, y: 0, chip: c2 }, // should be ignored
    ])
    expect(finalState).toEqual(IDLE)
    expect(allEffects.filter(e => e.kind === 'apply').map(e => (e as { id: string }).id))
      .toEqual(['a'])
  })
})

describe('createDragSelectStore', () => {
  it('initial state is idle', () => {
    const store = createDragSelectStore()
    expect(store.isIdle()).toBe(true)
    expect(store.state().kind).toBe('idle')
  })

  it('dispatch updates state and returns effects', () => {
    const store = createDragSelectStore()
    const effects = store.dispatch({
      kind: 'mousedown',
      button: 0,
      x: 0,
      y: 0,
      chip: chip('a', 0),
    })
    expect(effects).toEqual([])
    expect(store.isIdle()).toBe(false)
    expect(store.state()).toMatchObject({ kind: 'pressed', mode: 'positive' })

    const upEffects = store.dispatch({ kind: 'mouseup' })
    expect(upEffects).toEqual([
      { kind: 'apply', id: 'a', mode: 'positive' },
      { kind: 'panelTag', id: 'a' },
    ])
    expect(store.isIdle()).toBe(true)
  })
})

describe('property: drag invariants', () => {
  const chipArb = fc.tuple(fc.string({ minLength: 1, maxLength: 5 }), fc.integer({ min: -1, max: 1 }))
    .map<ChipRef>(([id, st]) => ({ id, state: st as TriState }))

  const moveArb = (chips: ChipRef[]) => fc.tuple(
    fc.integer({ min: -100, max: 100 }),
    fc.integer({ min: -100, max: 100 }),
    fc.option(fc.constantFrom(...chips), { nil: null }),
  ).map<DragSelectEvent>(([x, y, c]) => ({ kind: 'mousemove', x, y, chip: c }))

  test.prop([
    fc.array(chipArb, { minLength: 1, maxLength: 5 }),
    fc.constantFrom(0 as const, 2 as const),
  ])('每個 chip ID 最多被 apply 一次（單一 drag 內 dedupe）', (chips, button) => {
    const moves = Array.from({ length: 20 }, (_, i) => ({
      kind: 'mousemove' as const,
      x: 10 + i * 5,
      y: 0,
      chip: chips[i % chips.length],
    }))
    const { allEffects } = runSequence([
      { kind: 'mousedown', button, x: 0, y: 0, chip: chips[0] },
      ...moves,
      { kind: 'mouseup' },
    ])
    const applyIds = allEffects.filter(e => e.kind === 'apply').map(e => (e as { id: string }).id)
    expect(applyIds.length).toBe(new Set(applyIds).size)
  })

  test.prop([fc.array(chipArb, { minLength: 1, maxLength: 5 })])(
    'mouseup 之後 state 一定回到 idle',
    (chips) => {
      const { finalState } = runSequence([
        { kind: 'mousedown', button: 0, x: 0, y: 0, chip: chips[0] },
        { kind: 'mousemove', x: 50, y: 50, chip: chips[0] },
        { kind: 'mouseup' },
      ])
      expect(finalState.kind).toBe('idle')
    },
  )

  test.prop([
    fc.integer({ min: -1, max: 1 }),
    fc.constantFrom('positive' as const, 'negative' as const),
  ])('computeCohort 通則：cohort=(startNew===startState) ? 0 : startState', (start, mode) => {
    const tri = start as TriState
    const delta = mode === 'positive' ? 1 : -1
    const startNew = Math.max(-1, Math.min(1, tri + delta))
    const expected = startNew === tri ? 0 : tri
    expect(computeCohort(tri, mode)).toBe(expected)
  })
})
