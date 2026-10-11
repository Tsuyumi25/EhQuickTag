// 自己評過分的圖庫，列表上的星星是自己打的分；只有這幾本要向 API 要平均分，
// 換算成跟列表同一套的星等，規則的語意才不會因來源不同而變。

import { onScopeDispose, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import { fetchAverageRatings, GDATA_BATCH, parseGalleryRef, type GalleryRef } from '@/composables/useEhSearchListing'
import type { PrototypeListingItem } from '@/composables/useRulePrototypeHost'
import { ruleUsesField, starsFromAverage, type FixedRule } from '@/services/listing/fixedRulePrototype'

/** gid → 星等。拿不到的圖庫不在裡面，判定維持未知 */
export function useSelfRatedStars(
  items: Ref<PrototypeListingItem[]>,
  rules: Ref<FixedRule[]>,
  onError: () => void,
): ShallowRef<ReadonlyMap<number, number>> {
  const stars = shallowRef<ReadonlyMap<number, number>>(new Map())
  // 送過的 gid 不再送，失敗的也一樣：重送一個壞掉的請求不會變好，只會一直打 API
  const requested = new Set<number>()
  const controller = new AbortController()
  let running = false

  async function fill(): Promise<void> {
    if (running || controller.signal.aborted) return
    if (!rules.value.some(rule => rule.enabled && ruleUsesField(rule, 'rating'))) return
    const pending: GalleryRef[] = []
    for (const item of items.value) {
      if (!item.selfRated) continue
      const ref = parseGalleryRef(item.href)
      if (ref && !requested.has(ref.gid)) pending.push(ref)
    }
    if (!pending.length) return
    running = true
    try {
      for (let i = 0; i < pending.length; i += GDATA_BATCH) {
        const batch = pending.slice(i, i + GDATA_BATCH)
        for (const ref of batch) requested.add(ref.gid)
        const averages = await fetchAverageRatings(batch, controller.signal)
        const next = new Map(stars.value)
        for (const [gid, average] of averages) next.set(gid, starsFromAverage(average))
        stars.value = next
      }
    } catch {
      if (!controller.signal.aborted) onError()
    } finally {
      running = false
    }
    // 跑的期間新出現的自評圖庫
    void fill()
  }

  watch(items, () => void fill(), { immediate: true })
  // 規則裡新加了星等條件或重新啟用時，才開始補
  watch(rules, () => void fill(), { deep: true })
  onScopeDispose(() => controller.abort())
  return stars
}
