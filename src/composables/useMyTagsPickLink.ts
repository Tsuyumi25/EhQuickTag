import { computed, ref, watch } from 'vue'
import { newPickId, pickUrl, savePick } from '@/services/mytags/mytagsPicks'

/**
 * 「到 My Tags 看」做成真的 <a href>，中鍵、右鍵選單開新分頁都照瀏覽器原生的來。
 * href 要在按下去之前就存在，所以選取一變就先取好 ID；快照等按下去（任何一顆鍵或 Enter）才寫入，
 * 比真正的導航早一步。新 ID 取到之前沿用上一個，連結不會因此閃成不能按
 */
export function useMyTagsPickLink(terms: () => readonly string[], onFailed: () => void) {
  const id = ref<string | null>(null)
  watch(() => terms().join('\n'), async (_key, _old, onCleanup) => {
    let stale = false
    onCleanup(() => { stale = true })
    const next = await newPickId()
    if (!stale) id.value = next
  }, { immediate: true })

  const href = computed(() => id.value && terms().length ? pickUrl(location.origin, id.value) : null)

  function persist(): void {
    if (!id.value || !terms().length) return
    savePick(id.value, terms()).catch(onFailed)
  }

  return { href, persist }
}
