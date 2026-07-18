import type { Button } from '@/types'

// Settings / JSON 編輯器預覽的按鈕標籤。spacer 是排版物、沒有可顯示的
// 標籤(caller 用 v-if 跳過渲染,這裡回空字串滿足型別完備)。
// 三個 preview(SettingsPopup ×2、ProfileJsonEditor)共用,新增 Button
// kind 或調整標籤推導只改這裡。
export function buttonPreviewLabel(b: Button): string {
  if (b.kind === 'spacer') return ''
  return b.label || (b.kind === 'tag' ? b.tags.join(', ') : b.url)
}
