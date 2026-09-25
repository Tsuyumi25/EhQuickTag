import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'
import { GM } from '$'
import { useEhFormHost } from '@/composables/useEhFormHost'
import { usePageSearch } from '@/composables/usePageSearch'
import { history, sessionTerms, loadSessionHistory } from '@/services/search/searchSession'

vi.mock('$', () => ({ GM: { openInTab: vi.fn() } }))
vi.mock('@/services/store', () => ({ enableHistory: ref(true) }))
vi.mock('@/services/gmStorage', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
}))
vi.mock('@/composables/useEhFormHost', () => ({ useEhFormHost: vi.fn() }))

let scope: EffectScope

beforeEach(async () => {
  scope = effectScope()
  history.value = []
  sessionTerms.value = []
  await loadSessionHistory()
})

afterEach(() => {
  scope.stop()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('usePageSearch', () => {
  it('第二個使用者取得搜尋狀態時，不把尚未提交的輸入重新記成載入時的歷史', async () => {
    const nativeText = ref('initial$')
    vi.mocked(useEhFormHost).mockReturnValue({
      searchText: nativeText,
      input: { form: null } as HTMLInputElement,
      anchor: {} as HTMLElement,
      setControlsWidth() {},
    })
    const bar = scope.run(usePageSearch)!
    expect(history.value).toEqual(['initial$'])
    bar.searchText.value = 'edited$'
    await nextTick()
    const popup = scope.run(usePageSearch)!
    expect(popup.searchText.value).toBe('edited$')
    expect(history.value).toEqual(['initial$'])
    popup.searchText.value = 'from-popup$'
    expect(nativeText.value).toBe('from-popup$')
  })

  it('沒有搜尋欄的頁面仍共用查詢，並在同站新分頁搜尋而保留當前頁', () => {
    vi.mocked(useEhFormHost).mockReturnValue(null)
    vi.stubGlobal('window', { location: { href: 'https://exhentai.org/g/123/abc/' } })
    const first = scope.run(usePageSearch)!
    first.searchText.value = 'query & more'
    const second = scope.run(usePageSearch)!
    second.search('search', false)
    expect(GM.openInTab).toHaveBeenCalledWith('https://exhentai.org/?f_search=query+%26+more', { active: false })
    expect(window.location.href).toBe('https://exhentai.org/g/123/abc/')
  })
})
