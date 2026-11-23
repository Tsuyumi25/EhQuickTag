import type { ComputedRef, InjectionKey } from 'vue'
import { tagChipStyle, type ColorUsage, type TagColors } from '@/services/mytags/mytagsColors'

// 色盤旁的「既有顏色」由手上有整份 My Tags 的那一層 provide：/mytags 面板或圖庫頁的
// 編輯區。中間的 Catalog / Draft / TagList 不必知道它
export const MYTAGS_COLOR_USAGE: InjectionKey<ComputedRef<ColorUsage[]>> = Symbol('mytagsColorUsage')

const ehStyle = (colors: TagColors) => tagChipStyle(colors, false)
const exStyle = (colors: TagColors) => tagChipStyle(colors, true)

export function useMyTagsColors() {
  const isExHentai = globalThis.location?.hostname === 'exhentai.org'
  return isExHentai ? exStyle : ehStyle
}
