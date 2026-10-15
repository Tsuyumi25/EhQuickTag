// 圖庫分類：E 站固定的十種，每個圖庫只屬於其中一種。

/** 也是素材清單裡分類產生器的順序，照 E 站搜尋頁分類按鈕的排法 */
export const GALLERY_CATEGORIES = [
  'doujinshi', 'manga', 'artistcg', 'gamecg', 'western', 'non-h', 'imageset', 'cosplay', 'asianporn', 'misc',
] as const

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number]

/** E 站各語言介面都寫英文，跟 AND／OR 一樣當成名稱，不翻譯 */
export const CATEGORY_LABELS: Record<GalleryCategory, string> = {
  'doujinshi': 'Doujinshi',
  'manga': 'Manga',
  'artistcg': 'Artist CG',
  'gamecg': 'Game CG',
  'western': 'Western',
  'non-h': 'Non-H',
  'imageset': 'Image Set',
  'cosplay': 'Cosplay',
  'asianporn': 'Asian Porn',
  'misc': 'Misc',
}

// 列表上的分類標籤（.cs／.cn，依版面而定）用 ct1～cta 這個 class 決定顏色，每種分類一個。
// 分類的字會被翻譯腳本換掉，class 不會
const CLASS_CATEGORIES: Record<string, GalleryCategory> = {
  ct1: 'misc',
  ct2: 'doujinshi',
  ct3: 'manga',
  ct4: 'artistcg',
  ct5: 'gamecg',
  ct6: 'imageset',
  ct7: 'cosplay',
  ct8: 'asianporn',
  ct9: 'non-h',
  cta: 'western',
}

export function categoryFromClassList(classes: Iterable<string>): GalleryCategory | null {
  for (const name of classes) {
    const category = CLASS_CATEGORIES[name]
    if (category) return category
  }
  return null
}

export function isGalleryCategory(value: unknown): value is GalleryCategory {
  return (GALLERY_CATEGORIES as readonly unknown[]).includes(value)
}
