// 還沒送出的編輯要能撐過整頁刷新。
//
// ⭐ 新增和標籤集操作仍然會刷新，而那些正是編到一半最可能做的事。存不住的話
// 「延後送出」這個設計就不成立。

import { cacheGet, cacheSet } from '@/services/gmStorage'
import type { EditMap, TagPatch } from '@/services/mytagsEdits'

const EDITS_KEY = 'eqt_mytags_edits'
const SCHEMA = 1

/** 清單的篩選與排序條件。旗標篩選同時啟用時取聯集。 */
export interface TagFilter {
  set: string
  watch: boolean
  hidden: boolean
  sort: 'negative' | 'positive' | 'color'
  status: 'all' | 'weighted' | 'pending'
}

export function emptyFilter(): TagFilter {
  return { set: 'all', watch: false, hidden: false, sort: 'negative', status: 'all' }
}

function isPatch(value: unknown): value is TagPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (!entries.length) return false
  return entries.every(([key, field]) => {
    if (key === 'weight') return typeof field === 'number'
    if (key === 'hidden' || key === 'watch') return typeof field === 'boolean'
    if (key === 'color') return typeof field === 'string'
    return false
  })
}

export async function loadEdits(): Promise<EditMap> {
  const raw = await cacheGet(EDITS_KEY)
  if (!raw) return {}
  try {
    const p = JSON.parse(raw) as { schema?: number; edits?: Record<string, unknown> }
    if (p.schema !== SCHEMA) return {}
    const out: EditMap = {}
    for (const [key, value] of Object.entries(p.edits ?? {})) {
      if (isPatch(value)) out[Number(key)] = value
    }
    return out
  } catch { return {} }
}

export async function saveEdits(edits: EditMap): Promise<void> {
  await cacheSet(EDITS_KEY, JSON.stringify({ schema: SCHEMA, edits }))
}

