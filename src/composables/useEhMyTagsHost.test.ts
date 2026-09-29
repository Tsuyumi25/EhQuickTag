import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
// 沒有 jsdom，靠 SSR renderer 取得真正的 appContext，重現 root 接管、後代取用的路徑
import { renderToString } from 'vue/server-renderer'
import { useEhMyTagsHost } from '@/composables/useEhMyTagsHost'
import { postMassAction } from '@/services/mytags/mytagsApi'

vi.mock('@/services/store', () => ({ fontFamily: ref(''), fontWeight: ref('') }))
vi.mock('@/services/mytags/mytagsApi', () => ({ postForm: vi.fn(), postMassAction: vi.fn() }))

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

interface FixtureRow {
  id: number
  full: string
  weight: number
  color?: string
  hidden?: boolean
  watch?: boolean
}

interface FakeNode {
  id?: string
  title?: string
  value?: string
  checked?: boolean
  textContent?: string
  querySelectorAll?: () => FakeNode[]
}

// 沒有 jsdom，POST 回來的文件只能用替身；parse 走的是 `doc instanceof Document`
// 那條分支，所以把這個 class 本身當成全域 Document，才能測到真的那條路徑
class FakeMyTagsDoc {
  constructor(
    private readonly nodes: Record<string, FakeNode>,
    private readonly fields: Record<string, FakeNode>,
  ) {}

  querySelector(selector: string): FakeNode | null {
    return this.nodes[selector] ?? null
  }

  querySelectorAll(): FakeNode[] {
    return []
  }

  getElementById(id: string): FakeNode | null {
    return this.fields[id] ?? null
  }
}

/** `form` / `container` 關掉就是 EH 回了一張不是 /mytags 的頁；`set` 是回應頁選中的組 */
function massResponse(
  rows: FixtureRow[],
  opts: { form?: boolean; container?: boolean; set?: string | null } = {},
): Document {
  const fields: Record<string, FakeNode> = {}
  const previews = rows.map((row) => {
    fields[`tagweight_${row.id}`] = { value: String(row.weight) }
    fields[`tagcolor_${row.id}`] = { value: row.color ?? '' }
    fields[`taghide_${row.id}`] = { checked: row.hidden ?? false }
    fields[`tagwatch_${row.id}`] = { checked: row.watch ?? false }
    return { id: `tagpreview_${row.id}`, title: row.full }
  })
  const nodes: Record<string, FakeNode> = {}
  if (opts.form !== false) nodes['#usertag_form'] = {}
  if (opts.container !== false) nodes['#usertags_outer'] = { querySelectorAll: () => previews }
  if (opts.set !== null) nodes['#tagset_outer option[selected]'] = { value: opts.set ?? '1', textContent: 'first set' }
  vi.stubGlobal('Document', FakeMyTagsDoc)
  return new FakeMyTagsDoc(nodes, fields) as unknown as Document
}

async function hostOnMyTagsPage() {
  myTagsPage()
  const [host] = await acquireInApp(useEhMyTagsHost)
  return host!
}

describe('批次刪除 / 搬移的回應驗證', () => {
  it('回應不是 /mytags 頁面時算失敗，不把「一列都沒有」當成全刪掉了', async () => {
    const host = await hostOnMyTagsPage()
    vi.mocked(postMassAction).mockResolvedValue(massResponse([], { form: false, container: false, set: null }))
    await expect(host.deleteTags([11, 12], '1')).resolves.toBeNull()
  })

  it('只缺標籤列容器的頁面同樣算失敗', async () => {
    const host = await hostOnMyTagsPage()
    vi.mocked(postMassAction).mockResolvedValue(massResponse([], { container: false }))
    await expect(host.moveTags([11], '2', '1')).resolves.toBeNull()
  })

  it('回應切到別組時不採用，免得拿別組的列蓋掉來源組', async () => {
    const host = await hostOnMyTagsPage()
    vi.mocked(postMassAction).mockResolvedValue(massResponse(
      [{ id: 21, full: 'alpha:one', weight: 10 }],
      { set: '2' },
    ))
    await expect(host.deleteTags([11], '1')).resolves.toBeNull()
  })

  it('合法的空標籤集是成功，回傳空列', async () => {
    const host = await hostOnMyTagsPage()
    vi.mocked(postMassAction).mockResolvedValue(massResponse([]))
    await expect(host.deleteTags([11], '1')).resolves.toEqual([])
  })

  it('合法頁面回傳解析後、還留在來源組的標籤列', async () => {
    const host = await hostOnMyTagsPage()
    vi.mocked(postMassAction).mockResolvedValue(massResponse([
      { id: 0, full: '', weight: 10 },
      { id: 12, full: 'beta:two', weight: -5, color: '#123456', hidden: true },
    ]))
    await expect(host.deleteTags([11, 12], '1')).resolves.toEqual([
      { id: 12, full: 'beta:two', weight: -5, color: '#123456', hidden: true, watch: false, tagSet: '1' },
    ])
  })
})
