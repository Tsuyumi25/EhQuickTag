import { GM, GM_xmlhttpRequest } from '$'

export const hasGM = typeof GM?.getValue === 'function'
export const hasGMXHR = typeof GM_xmlhttpRequest === 'function'

export async function cacheGet(key: string): Promise<string | null> {
  if (hasGM) return (await GM.getValue<string>(key, '')) || null
  return localStorage.getItem(key)
}

export async function cacheSet(key: string, value: string): Promise<void> {
  if (hasGM) { await GM.setValue(key, value); return }
  try { localStorage.setItem(key, value) } catch { /* quota exceeded */ }
}
