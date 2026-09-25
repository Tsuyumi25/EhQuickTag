import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { fontFamily, fontWeight } from '@/services/store'
import { createAnchor } from '@/utils/createAnchor'

vi.mock('@/services/store', () => ({ fontFamily: ref(''), fontWeight: ref('') }))

const scopes: EffectScope[] = []

beforeEach(() => {
  fontFamily.value = ''
  fontWeight.value = ''
  vi.stubGlobal('document', {
    createElement: () => {
      const properties = new Map<string, string>()
      const attributes = new Map<string, string>()
      return {
        id: '',
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        getAttribute: (name: string) => attributes.get(name) ?? null,
        style: {
          setProperty: (name: string, value: string) => properties.set(name, value),
          removeProperty: (name: string) => properties.delete(name),
          getPropertyValue: (name: string) => properties.get(name) ?? '',
        },
      }
    },
  })
})

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.unstubAllGlobals()
})

function mountPoint(id: string) {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, anchor: scope.run(() => createAnchor(id))! }
}

describe('createAnchor font synchronization', () => {
  it('建立時就有已載入的字體，後續變更同步到每個掛載點', async () => {
    fontFamily.value = 'serif'
    fontWeight.value = '600'
    const anchors = ['eqt-app', 'eqt-bar-anchor', 'eqt-gallery-anchor', 'eqt-mytags-anchor']
      .map((id) => mountPoint(id).anchor)
    for (const anchor of anchors) {
      expect(anchor.style.getPropertyValue('--eqt-font-family')).toBe('serif')
      expect(anchor.style.getPropertyValue('--eqt-font-weight')).toBe('600')
      expect(anchor.getAttribute('translate')).toBe('no')
    }
    fontFamily.value = 'monospace'
    fontWeight.value = '400'
    await nextTick()
    for (const anchor of anchors) {
      expect(anchor.style.getPropertyValue('--eqt-font-family')).toBe('monospace')
      expect(anchor.style.getPropertyValue('--eqt-font-weight')).toBe('400')
    }
  })

  it('清空其中一項設定只移除該覆寫，讓字體回到繼承', async () => {
    fontFamily.value = 'serif'
    fontWeight.value = '600'
    const { anchor } = mountPoint('eqt-app')
    fontFamily.value = ''
    await nextTick()
    expect(anchor.style.getPropertyValue('--eqt-font-family')).toBe('')
    expect(anchor.style.getPropertyValue('--eqt-font-weight')).toBe('600')
    fontWeight.value = ''
    await nextTick()
    expect(anchor.style.getPropertyValue('--eqt-font-weight')).toBe('')
  })

  it('結束一個 scope 只停止它的字體同步，後建的掛載點仍取得最新設定', async () => {
    fontFamily.value = 'serif'
    const first = mountPoint('eqt-app')
    const second = mountPoint('eqt-bar-anchor')
    first.scope.stop()
    fontFamily.value = 'monospace'
    await nextTick()
    expect(first.anchor.style.getPropertyValue('--eqt-font-family')).toBe('serif')
    expect(second.anchor.style.getPropertyValue('--eqt-font-family')).toBe('monospace')
    expect(mountPoint('eqt-gallery-anchor').anchor.style.getPropertyValue('--eqt-font-family')).toBe('monospace')
  })
})
