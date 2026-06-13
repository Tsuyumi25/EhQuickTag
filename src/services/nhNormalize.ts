/**
 * nh tag name 正規化：lowercase + 去 - _ space。
 *
 * runtime (`nhPopularity.ts`) 跟 build-time gen script (`scripts/gen-nh-popularity.ts`)
 * 共用同一個函式——兩邊用來算 key 必須完全一致，否則 script 寫進 JSON 的 key
 * runtime 永遠查不到，nh 權重靜默歸零。
 */
export function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_ ]/g, '')
}
