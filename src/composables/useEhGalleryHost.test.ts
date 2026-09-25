import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
// SSR renderer 跑得出真正的 appContext，能在沒有 jsdom 的情況下重現
// 「root 先接管、後代再取用」這條實際路徑
import { renderToString } from 'vue/server-renderer'
import { useEhGalleryHost } from '@/composables/useEhGalleryHost'

vi.mock('@/services/store', () => ({
  fontFamily: ref(''),
  fontWeight: ref(''),
  galleryTaglistExpand: ref(false),
  galleryTaglistHeight: ref(160),
}))

function galleryPage(present = true) {
  const createElement = () => ({
    id: '',
    classList: { toggle: vi.fn() },
    style: { setProperty: vi.fn(), removeProperty: vi.fn() },
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
    closest: () => null,
  })
  const taglist = { querySelectorAll: () => [] }
  const gd4 = { querySelector: () => null, firstChild: null, appendChild: vi.fn() }
  const created = vi.fn(createElement)
  vi.stubGlobal('document', {
    querySelector: (selector: string) => {
      if (!present) return null
      if (selector === '#taglist') return taglist
      if (selector === '#gd4') return gd4
      return null
    },
    createElement: created,
  })
  return { taglist, gd4, created }
}

async function acquireInApp<T>(use: () => T): Promise<T[]> {
  const acquired: T[] = []
  const Descendant = defineComponent({
    setup() {
      acquired.push(use())
      return () => h('i')
    },
  })
  const Root = defineComponent({
    setup() {
      acquired.push(use())
      return () => h(Descendant)
    },
  })
  await renderToString(createSSRApp(Root))
  return acquired
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useEhGalleryHost 接管次數', () => {
  it('後代取用的是 root 接管好的那份，#gd4 不會被包第二層也不會多一個 anchor', async () => {
    const { taglist, gd4 } = galleryPage()
    const [rootHost, descendantHost] = await acquireInApp(useEhGalleryHost)
    expect(descendantHost).toBe(rootHost)
    expect(rootHost!.taglistEl).toBe(taglist)
    expect(gd4.appendChild).toHaveBeenCalledTimes(2)   // native wrapper + anchor
    expect(gd4.appendChild).toHaveBeenLastCalledWith(rootHost!.anchor)
  })

  it('不是 gallery 頁時回 null，後代也拿到同一個結論而不重探 DOM', async () => {
    const { created } = galleryPage(false)
    const [rootHost, descendantHost] = await acquireInApp(useEhGalleryHost)
    expect(rootHost).toBeNull()
    expect(descendantHost).toBeNull()
    expect(created).not.toHaveBeenCalled()
  })
})
