import { ref } from 'vue'
import { conditionsFromTerms, type TagCondition } from '@/services/listing/fixedRulePrototype'
import type { DigestMode } from '@/services/listing/ruleDigest'

export const showSettings = ref(false)
export const initialSettingsTab = ref<string | null>(null)
export const showSearchPopup = ref(false)
export const showRules = ref(false)
/** 規則頁收起來、讓出搜尋頁給使用者看即時效果 */
export const rulesCollapsed = ref(false)
// 放在頁面層級而不是規則頁元件裡：規則頁關掉再打開，素材還在
export const ruleMaterials = ref<TagCondition[]>([])
export const ruleDigestMode = ref<DigestMode>('sentence')
/** 打開規則頁時要選中的規則；規則頁接手之後清回 null */
export const requestedRuleId = ref<number | null>(null)

export function openRules(terms: readonly string[] = []): void {
  ruleMaterials.value.push(...conditionsFromTerms(terms, ruleMaterials.value))
  rulesCollapsed.value = false
  showRules.value = true
}

export function openRule(id: number): void {
  requestedRuleId.value = id
  rulesCollapsed.value = false
  showRules.value = true
}

export function openSettings(tab: string | null = null): void {
  initialSettingsTab.value = tab
  showSettings.value = true
}

export function openSearchPopup(): void {
  showSearchPopup.value = true
}
