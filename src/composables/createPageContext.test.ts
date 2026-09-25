import { afterEach, describe, expect, it } from 'vitest'
import { createSSRApp, defineComponent, effectScope, h, type EffectScope } from 'vue'
// 沒有 jsdom，但 SSR renderer 一樣會跑 setup 並建立真正的 appContext，
// 足以驗證 root 與後代之間的共用
import { renderToString } from 'vue/server-renderer'
import { createPageContext } from '@/composables/createPageContext'

interface FakeHost { readonly id: string }

const scopes: EffectScope[] = []

function scoped<T>(fn: () => T): T {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(fn)!
}

/** 模擬 host 的接管：每跑一次就在頁面上多留一份痕跡 */
function takeoverFactory(takenOver: string[]) {
  return (): FakeHost => {
    const host = { id: `host-${takenOver.length + 1}` }
    takenOver.push(host.id)
    return host
  }
}

function appAcquiring(usePage: () => unknown, acquired: unknown[]) {
  const Descendant = defineComponent({
    setup() {
      acquired.push(usePage())
      return () => h('i')
    },
  })
  return defineComponent({
    setup() {
      acquired.push(usePage())
      return () => h(Descendant)
    },
  })
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})

describe('createPageContext', () => {
  it('同一個 scope 重複取得拿到同一份，原生頁面只被接管一次', () => {
    const takenOver: string[] = []
    const usePage = createPageContext(takeoverFactory(takenOver))
    const [first, second] = scoped(() => [usePage(), usePage()])
    expect(second).toBe(first)
    expect(takenOver).toEqual(['host-1'])
  })

  it('不同 scope 各自接管自己的頁面，互不共用', () => {
    const takenOver: string[] = []
    const usePage = createPageContext(takeoverFactory(takenOver))
    const first = scoped(usePage)
    const second = scoped(usePage)
    expect(second).not.toBe(first)
    expect(takenOver).toEqual(['host-1', 'host-2'])
  })

  it('偵測失敗的 null 同樣被記住，不會為了重探而再跑一次接管', () => {
    let probes = 0
    const usePage = createPageContext(() => (probes++ === 0 ? null : { id: 'late' }))
    expect(scoped(() => [usePage(), usePage()])).toEqual([null, null])
    expect(probes).toBe(1)
    expect(scoped(usePage)).toEqual({ id: 'late' })
  })

  it('沒有 scope 也沒有 component instance 時直接丟錯，不默默建立無人回收的 watcher', () => {
    const usePage = createPageContext(takeoverFactory([]))
    expect(usePage).toThrow(/active component setup or effect scope/)
  })

  it('root 接管之後，同一個 app 的後代拿到同一份；另一個 app 自己接管一份', async () => {
    const takenOver: string[] = []
    const usePage = createPageContext(takeoverFactory(takenOver))

    const firstApp: unknown[] = []
    await renderToString(createSSRApp(appAcquiring(usePage, firstApp)))
    expect(firstApp).toHaveLength(2)
    expect(firstApp[1]).toBe(firstApp[0])
    expect(takenOver).toEqual(['host-1'])

    const secondApp: unknown[] = []
    await renderToString(createSSRApp(appAcquiring(usePage, secondApp)))
    expect(secondApp[1]).toBe(secondApp[0])
    expect(secondApp[0]).not.toBe(firstApp[0])
    expect(takenOver).toEqual(['host-1', 'host-2'])
  })
})
