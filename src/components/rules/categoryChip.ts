import type { CSSProperties } from 'vue'
import type { GalleryCategory } from '@/services/listing/galleryCategory'

// 分類 chip 借用 TagChip 的 My Tags 配色：整顆鋪滿分類色、白字，跟列表上 E 站的分類標籤同一種讀法
export function categoryChipStyle(category: GalleryCategory): CSSProperties {
  const color = `var(--eqt-category-${category})`
  return { '--eqt-mytags-background': color, '--eqt-mytags-border': color, '--eqt-mytags-text': 'var(--eqt-text-on-color)' }
}
