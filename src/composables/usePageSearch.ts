import { ref } from 'vue'
import { createPageContext } from '@/composables/createPageContext'
import { useEhFormHost } from '@/composables/useEhFormHost'
import { bindSearchBar } from '@/services/search/searchSession'
import { searchHref, submitSearch } from '@/services/search/submitSearch'
import type { DblClickAction } from '@/services/store'

export const usePageSearch = createPageContext(() => {
  const host = useEhFormHost()
  const searchText = host?.searchText ?? ref('')
  const form = host?.input.form ?? null

  bindSearchBar({
    modelValue: () => searchText.value,
    emitUpdate: (value) => { searchText.value = value },
  })

  function search(action: DblClickAction, newTabActive?: boolean): void {
    submitSearch(action, form, searchText.value, newTabActive)
  }

  // 原生表單的分類、進階選項由 EH 自己的 onclick 改，不是 reactive：要用的當下再讀
  function href(): string {
    return searchHref(form, searchText.value)
  }

  return { searchText, search, href, inPlace: !!form }
})
