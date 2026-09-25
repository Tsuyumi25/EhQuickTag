import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
// 沒有 jsdom，靠 SSR renderer 取得真正的 appContext，重現 root 接管、後代取用的路徑
import { renderToString } from 'vue/server-renderer'
import { useEhMyTagsHost } from '@/composables/useEhMyTagsHost'

vi.mock('@/services/store', () => ({ fontFamily: ref(''), fontWeight: ref('') }))
vi.mock('@/services/mytagsApi', () => ({ postMassAction: vi.fn() }))

function myTagsPage() {
  const topbars = {
    nb: { before: vi.fn() },
    lb: { before: vi.fn() },
  }
  const form = { after: vi.fn() }
  const outer = {
    querySelectorAll: () => new Array(4),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const pageBox = { after: vi.fn() }
  const options = [
    { value: '1', selected: true, textContent: 'first set (3)' },
    { value: '2', selected: false, textContent: 'second set (7)' },
  ]
  vi.stubGlobal('location', { pathname: '/mytags' })
  vi.stubGlobal('document', {
    querySelector: (selector: string) => {
      if (selector === '#usertag_form') return form
      if (selector === '#usertags_outer') return outer
      if (selector === '#outer') return pageBox
      return null
    },
    querySelectorAll: (selector: string) => (
      selector === '#tagset_outer select option' ? options : []
    ),
    getElementById: (id: string) => topbars[id as 'nb' | 'lb'] ?? null,
    createComment: (text: string) => ({ text }),
    createElement: () => ({
      id: '',
      setAttribute: vi.fn(),
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
    }),
  })
  return { topbars, pageBox }
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

describe('useEhMyTagsHost 接管次數', () => {
  it('後代取用的是 root 接管好的那份，原生頂部欄的回家標記只留一份', async () => {
    const { topbars, pageBox } = myTagsPage()
    const [rootHost, descendantHost] = await acquireInApp(useEhMyTagsHost)
    expect(descendantHost).toBe(rootHost)
    expect(rootHost!.currentSet).toBe('1')
    expect(topbars.nb.before).toHaveBeenCalledTimes(1)
    expect(topbars.lb.before).toHaveBeenCalledTimes(1)
    expect(pageBox.after).toHaveBeenCalledTimes(1)
    expect(pageBox.after).toHaveBeenCalledWith(rootHost!.anchor)
  })

  it('不在 /mytags 時回 null，後代也拿到同一個結論', async () => {
    myTagsPage()
    vi.stubGlobal('location', { pathname: '/' })
    const [rootHost, descendantHost] = await acquireInApp(useEhMyTagsHost)
    expect(rootHost).toBeNull()
    expect(descendantHost).toBeNull()
  })
})
