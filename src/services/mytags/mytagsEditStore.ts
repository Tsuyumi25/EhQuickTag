// 還沒送出的編輯要能撐過整頁刷新，一個標籤一個 key。

import { createItemStore } from '@/services/mytags/mytagsItemStore'
import type { EditMap, PendingEdit } from '@/services/mytags/mytagsEdits'

const EDIT_PREFIX = 'eqt_mytags_edit'
const LEGACY_KEY = 'eqt_mytags_edits'
const LEGACY_SCHEMA = 1

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

function isPatch(value: unknown): value is PendingEdit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (!entries.length) return false
  return entries.every(([key, field]) => {
    if (key === 'weight') return typeof field === 'number'
    if (key === 'hidden' || key === 'watch') return typeof field === 'boolean'
    if (key === 'color') return typeof field === 'string'
    if (key === 'destination') {
      return !!field && typeof field === 'object' && !Array.isArray(field)
        && typeof field.full === 'string' && !!field.full
        && typeof field.tagSet === 'string' && !!field.tagSet
    }
    return false
  })
}

export interface EditStore {
  load: () => Promise<EditMap>
  save: (next: EditMap) => Promise<void>
}

/** 一個面板 session 用一個：存檔只寫這個 instance 改過的那幾個標籤 */
export function createEditStore(): EditStore {
  const items = createItemStore<PendingEdit>({
    prefix: EDIT_PREFIX,
    legacyKey: LEGACY_KEY,
    legacyField: 'edits',
    legacySchema: LEGACY_SCHEMA,
    parse: (value) => (isPatch(value) ? value : null),
  })

  return {
    async load(): Promise<EditMap> {
      const stored = await items.load()
      const out: EditMap = {}
      for (const [key, patch] of Object.entries(stored)) {
        const id = Number(key)
        if (Number.isInteger(id)) out[id] = patch
      }
      return out
    },
    save: items.save,
  }
}
