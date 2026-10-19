import { nextTick, ref } from 'vue'
import { conditionsFromTerms, type MaterialCondition } from '@/services/listing/galleryRules'

export const showSettings = ref(false)
export const initialSettingsTab = ref<string | null>(null)
export const showSearchPopup = ref(false)
export const showRules = ref(false)
/** 規則頁收起來、讓出搜尋頁給使用者看即時效果 */
export const rulesCollapsed = ref(false)
// 放在頁面層級而不是規則頁元件裡：規則頁關掉再打開，素材還在
export const ruleMaterials = ref<MaterialCondition[]>([])
/** 條件用原始寫法編輯；關掉是圖形介面 */
export const ruleConditionSource = ref(false)
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

// EVR 的 README 寫明的 hook。先關掉這裡：兩邊都會鎖 body 的捲動，EVR 打開時記下的是
// 「已經被我們鎖住」的狀態，關掉後會把頁面還原成鎖住；等我們卸載、鎖解開了再請它打開
export async function openEvrSettings(): Promise<void> {
  showSettings.value = false
  await nextTick()
  document.dispatchEvent(new Event('evr:open-settings'))
}

export function openSearchPopup(): void {
  showSearchPopup.value = true
}
