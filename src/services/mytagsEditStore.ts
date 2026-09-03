// 還沒送出的編輯要能撐過整頁刷新。
//
// ⭐ 新增和標籤集操作仍然會刷新，而那些正是編到一半最可能做的事。存不住的話
// 「延後送出」這個設計就不成立。

import { cacheGet, cacheSet } from '@/services/gmStorage'
import type { EditMap, TagState } from '@/services/mytagsEdits'

const EDITS_KEY = 'eqt_mytags_edits'
const SCHEMA = 1

/** 清單的篩選條件。標籤集是主要的那一個，狀態是次要的 */
export interface TagFilter {
  set: string
  status: 'all' | 'watch' | 'hidden' | 'weighted' | 'pending'
}

export function emptyFilter(): TagFilter {
  return { set: 'all', status: 'all' }
}

function isState(v: unknown): v is TagState {
  const s = v as TagState
  return !!s && typeof s.weight === 'number' && typeof s.hidden === 'boolean'
    && typeof s.watch === 'boolean' && typeof s.color === 'string'
}

export async function loadEdits(): Promise<EditMap> {
  const raw = await cacheGet(EDITS_KEY)
  if (!raw) return {}
  try {
    const p = JSON.parse(raw) as { schema?: number; edits?: Record<string, unknown> }
    if (p.schema !== SCHEMA) return {}
    const out: EditMap = {}
    for (const [k, v] of Object.entries(p.edits ?? {})) {
      const e = v as { want?: unknown; basedOn?: unknown }
      if (isState(e?.want) && isState(e?.basedOn)) out[Number(k)] = { want: e.want, basedOn: e.basedOn }
    }
    return out
  } catch { return {} }
}

export async function saveEdits(edits: EditMap): Promise<void> {
  await cacheSet(EDITS_KEY, JSON.stringify({ schema: SCHEMA, edits }))
}

