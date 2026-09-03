// 問卷樣本的持久化。跟 mytagsSamples 的純邏輯分開，因為 gmStorage 會拉進
// userscript runtime，混在一起會讓整個模組在 node 底下沒辦法測。

import { cacheGet, cacheSet } from '@/services/gmStorage'
import { emptyStore, type SampleStore, type Verdict } from '@/services/mytagsSamples'

const KEY = 'eqt_mytags_samples'
/** 畫廊快取的 schema 版本。加欄位就 +1——舊資料丟掉重抓很便宜，判斷才是要保住的 */
const SCHEMA = 2

export async function loadSamples(): Promise<SampleStore> {
  const raw = await cacheGet(KEY)
  if (!raw) return emptyStore()
  try {
    const p = JSON.parse(raw) as Partial<SampleStore> & { schema?: number }
    const out = emptyStore()
    // 判斷跨版本一定保留：它是使用者花時間給的，畫廊重抓一下就有
    if (p.schema === SCHEMA) {
      for (const [k, v] of Object.entries(p.galleries ?? {})) {
        if (v && Array.isArray(v.tags) && typeof v.thumb === 'string') out.galleries[k] = v
      }
    }
    for (const [k, v] of Object.entries(p.verdicts ?? {})) {
      if (v === 'block' || v === 'keep') out.verdicts[k] = v as Verdict
    }
    return out
  } catch { return emptyStore() }
}

export async function saveSamples(store: SampleStore): Promise<void> {
  await cacheSet(KEY, JSON.stringify({ ...store, schema: SCHEMA }))
}
