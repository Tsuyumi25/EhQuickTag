import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import { useEhFormHost } from '@/composables/useEhFormHost'

vi.mock('@/services/store', () => ({ fontFamily: ref(''), fontWeight: ref('') }))

const scopes: EffectScope[] = []

function nativeSearch(value: string) {
  const parent = {
    querySelector: () => null,
    insertBefore: vi.fn(),
    appendChild: vi.fn(),
    style: { setProperty: vi.fn() },
  }
  const input = Object.assign(new EventTarget(), { value, parentElement: parent })
  vi.stubGlobal('document', {
    querySelector: () => input,
    createElement: () => ({
      appendChild: vi.fn(),
      setAttribute: vi.fn(),
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
    }),
  })
  return input
}

function acquireHost() {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, host: scope.run(useEhFormHost)! }
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.unstubAllGlobals()
})

describe('useEhFormHost search synchronization', () => {
  it('呼叫端立即取得載入時的查詢，後續輸入與清空同步回同一份狀態', () => {
    const input = nativeSearch('initial query')
    const { host } = acquireHost()
    const initialSnapshot = host!.searchText.value
    input.value = 'edited query'
    input.dispatchEvent(new Event('input'))
    expect(host!.searchText.value).toBe('edited query')
    input.value = ''
    input.dispatchEvent(new Event('input'))
    expect(host!.searchText.value).toBe('')
    expect(initialSnapshot).toBe('initial query')
  })

  it('插件修改搜尋狀態後，原生表單提交會讀到更新後的值', async () => {
    const input = nativeSearch('initial query')
    const { host } = acquireHost()
    host!.searchText.value = 'replacement query'
    await nextTick()
    expect(input.value).toBe('replacement query')
  })

  it('同一個頁面重複取得回同一份 host，原生搜尋列不會再被包一次', () => {
    const input = nativeSearch('initial query')
    const { scope, host } = acquireHost()
    const again = scope.run(useEhFormHost)!
    expect(again).toBe(host)
    input.value = 'edited query'
    input.dispatchEvent(new Event('input'))
    expect(again!.searchText.value).toBe('edited query')
    expect(input.parentElement.insertBefore).toHaveBeenCalledTimes(1)
    expect(input.parentElement.appendChild).toHaveBeenCalledTimes(1)
  })

  it('scope 結束後，舊的事件監聽與 watcher 都停止同步', async () => {
    const input = nativeSearch('initial query')
    const { scope, host } = acquireHost()
    scope.stop()
    input.value = 'native after disposal'
    input.dispatchEvent(new Event('input'))
    expect(host!.searchText.value).toBe('initial query')
    host!.searchText.value = 'plugin after disposal'
    await nextTick()
    expect(input.value).toBe('native after disposal')
  })

  it('沒有原生搜尋欄時回傳 null，讓其他頁面使用自己的搜尋狀態', () => {
    vi.stubGlobal('document', { querySelector: () => null })
    expect(acquireHost().host).toBeNull()
  })
})
