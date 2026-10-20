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

// EVR 的整合文件（docs/integration.md）寫明的 hook。先關掉我們的設定頁：它靠 onClickOutside 判斷關閉，
// EVR 的面板蓋上來之後，第一下點進 EVR 就會把它在背後關掉；等它卸載了再請 EVR 打開
export async function openEvrSettings(): Promise<void> {
  showSettings.value = false
  await nextTick()
  document.dispatchEvent(new Event('evr:open-settings'))
}

export function openSearchPopup(): void {
  showSearchPopup.value = true
}
