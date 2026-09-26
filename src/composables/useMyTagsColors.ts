import { tagChipStyle, type TagColors } from '@/services/mytags/mytagsColors'

const ehStyle = (colors: TagColors) => tagChipStyle(colors, false)
const exStyle = (colors: TagColors) => tagChipStyle(colors, true)

export function useMyTagsColors() {
  const isExHentai = globalThis.location?.hostname === 'exhentai.org'
  return isExHentai ? exStyle : ehStyle
}
