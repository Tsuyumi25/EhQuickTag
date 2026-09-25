import { ref } from 'vue'
import { createPageContext } from '@/composables/createPageContext'
import { useEhFormHost } from '@/composables/useEhFormHost'
import { bindSearchBar } from '@/services/search/searchSession'
import { submitSearch } from '@/services/search/submitSearch'
import type { DblClickAction } from '@/services/store'

export const usePageSearch = createPageContext(() => {
  const host = useEhFormHost()
  const searchText = host?.searchText ?? ref('')

  bindSearchBar({
    modelValue: () => searchText.value,
    emitUpdate: (value) => { searchText.value = value },
  })

  function search(action: DblClickAction, newTabActive?: boolean): void {
    submitSearch(action, host?.input.form ?? null, searchText.value, newTabActive)
  }

  return { searchText, search }
})
