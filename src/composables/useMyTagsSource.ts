import { ref, shallowRef, watch, type Ref } from 'vue'
import { loadPick, pickTags, PICK_PARAM } from '@/services/mytags/mytagsPicks'
import { fetchGallery } from '@/composables/useEhGalleryPreview'

export function useMyTagsSource(hash: Ref<string>) {
  const tags = shallowRef<string[]>([])
  const message = ref('')

  watch(hash, async (fragment, _before, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    tags.value = []
    message.value = ''
    const params = new URLSearchParams(fragment.slice(1))
    const hasPick = params.has(PICK_PARAM)
    const hasGallery = params.has('eqt_gid') || params.has('eqt_token')
    if (!hasPick && !hasGallery) return
    if (hasPick && hasGallery) {
      message.value = 'panel.pickConflict'
      return
    }
    message.value = 'gallery.loading'
    try {
      if (hasPick) {
        const pick = await loadPick(params.get(PICK_PARAM)!)
        if (cancelled) return
        tags.value = pick ? pickTags(pick.terms) : []
        message.value = pick ? '' : 'panel.pickMissing'
      } else {
        const gid = Number(params.get('eqt_gid'))
        const token = params.get('eqt_token')
        if (!Number.isSafeInteger(gid) || gid <= 0 || !token || !/^[0-9a-f]{10}$/.test(token)) {
          message.value = 'panel.gallerySourceInvalid'
          return
        }
        const gallery = await fetchGallery(gid, token)
        if (cancelled) return
        tags.value = gallery?.tags.map(tag => tag.full) ?? []
        message.value = gallery ? '' : 'gallery.failed'
      }
    } catch {
      if (!cancelled) message.value = hasPick ? 'panel.pickLoadFailed' : 'gallery.failed'
    }
  }, { immediate: true, flush: 'sync' })

  return { tags, message }
}
