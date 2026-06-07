import bundledData from '@/data/nh-popularity.json'

// nh tag 上傳量資料只覆蓋這幾個 namespace（male/female/mixed/other 是 nh
// 那邊有對應分類的）。其他 namespace（artist / language / parody 等）即使
// 名字撞到也不算 nh 人氣，避免錯誤加權。
const NH_NAMESPACES = new Set(['female', 'male', 'mixed', 'other'])

function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_ ]/g, '')
}

const popularityMap = new Map(Object.entries(bundledData as Record<string, number>))

function getNhCount(tagRaw: string): number | undefined {
  return popularityMap.get(normalize(tagRaw))
}

/**
 * 以 (namespace, tag raw) 查 nh 人氣權重。唯一對外公開的 API——把「nh 資料沒
 * namespace → 必須先比對 e站 ns 才能用」這個流程的核心邏輯封裝起來，避免 caller
 * 繞過 NH_NAMESPACES guard 直接讀 popularityMap。
 *
 * - namespace 不在 NH_NAMESPACES → undefined（不該被當作 nh 加權對象）
 * - namespace 對得上但 nh 資料沒這個 tag → undefined
 * - 兩者皆有 → 該 tag 的 nh 上傳量
 *
 * 兩個 caller：searchTags 做排序權重；getNhRankedEntries 取「top N nh tags
 * 經 e站對齊後」的清單給 AddTagPopup。
 */
export function getNhWeight(ns: string, raw: string): number | undefined {
  if (!NH_NAMESPACES.has(ns)) return undefined
  return getNhCount(raw)
}
