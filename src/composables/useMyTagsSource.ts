import { ref, shallowRef, watch, type Ref } from 'vue'
import { loadPick, pickTags, PICK_PARAM } from '@/services/mytags/mytagsPicks'

export function useMyTagsSource(hash: Ref<string>) {
  const tags = shallowRef<string[]>([])
  const message = ref('')

  watch(hash, async (fragment, _before, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    tags.value = []
    message.value = ''
    const params = new URLSearchParams(fragment.slice(1))
    if (!params.has(PICK_PARAM)) return
    if (params.has('eqt_gid') || params.has('eqt_token')) {
      message.value = 'panel.pickConflict'
      return
    }
    message.value = 'gallery.loading'
    try {
      const pick = await loadPick(params.get(PICK_PARAM)!)
      if (cancelled) return
      tags.value = pick ? pickTags(pick.terms) : []
      message.value = pick ? '' : 'panel.pickMissing'
    } catch {
      if (!cancelled) message.value = 'panel.pickLoadFailed'
    }
  }, { immediate: true, flush: 'sync' })

  return { tags, message }
}
