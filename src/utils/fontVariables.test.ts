import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { fontFamily, fontWeight } from '@/services/store'
import { bindFontVariables } from '@/utils/fontVariables'

vi.mock('@/services/store', () => ({ fontFamily: ref(''), fontWeight: ref('') }))

const scopes: EffectScope[] = []

function bound() {
  const properties = new Map<string, string>()
  const root = {
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
  } as unknown as HTMLElement
  const scope = effectScope()
  scopes.push(scope)
  scope.run(() => bindFontVariables(root))
  return { scope, read: (name: string) => properties.get(name) ?? '' }
}

beforeEach(() => {
  fontFamily.value = ''
  fontWeight.value = ''
})

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})

describe('bindFontVariables', () => {
  it('綁上時就套用已載入的設定，之後的變更跟著同步', async () => {
    fontFamily.value = 'serif'
    fontWeight.value = '600'
    const { read } = bound()
    expect(read('--eqt-font-family')).toBe('serif')
    expect(read('--eqt-font-weight')).toBe('600')
    fontWeight.value = '400'
    await nextTick()
    expect(read('--eqt-font-weight')).toBe('400')
  })

  it('清空其中一項只移除該覆寫，讓它回到繼承', async () => {
    fontFamily.value = 'serif'
    fontWeight.value = '600'
    const { read } = bound()
    fontWeight.value = ''
    await nextTick()
    expect(read('--eqt-font-weight')).toBe('')
    expect(read('--eqt-font-family')).toBe('serif')
  })

  it('scope 結束後不再同步', async () => {
    fontWeight.value = '600'
    const { scope, read } = bound()
    scope.stop()
    fontWeight.value = '400'
    await nextTick()
    expect(read('--eqt-font-weight')).toBe('600')
  })
})
