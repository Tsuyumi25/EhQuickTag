import type { LineTextAlign } from '@/types'

// preview 用：把行的 textAlign（含全域 fallback 後的值）換算成 flex 的
// justifyContent。TagBar 本體走 --buttons-align-* CSS class，preview
// 元素走 inline style，換算邏輯集中在這裡避免各處複製後 drift。
export function textAlignToJustify(align: LineTextAlign): 'flex-start' | 'center' | 'flex-end' {
  return align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
}
