import type { MyTagRow, NewTagInput, TagSetRef } from '@/composables/useEhMyTagsHost'
import type { TagState } from '@/services/mytags/mytagsEdits'

export type NewTagSubmission = NewTagInput & { tagSet: string }

export type MyTagsEditorHostStatus = 'loading' | 'ready' | 'signed-out' | 'failed'

/**
 * 編輯單元看到的 EH 現況與寫回去的路。單元自己只管「這一顆想變成怎樣」；
 * 寫進 EH 之後現況怎麼更新，由提供現況的那一頁決定。
 */
export interface MyTagsEditorHost {
  readonly status: MyTagsEditorHostStatus
  /** 這一頁另外有寫入在跑，單元不能同時送 */
  readonly busy: boolean
  readonly sets: TagSetRef[]
  readonly setColors: Record<string, string>
  readonly defaultSet: string
  readonly colorRows: readonly { full: string; color: string }[]
  rowOf(full: string): MyTagRow | null
  load(): void
  save(row: MyTagRow, state: TagState): Promise<boolean>
  /** 回傳 EH 收下的那一列；EH 可能把名稱正規化，所以名字以它為準 */
  create(submission: NewTagSubmission): Promise<MyTagRow | null>
  move(row: MyTagRow, target: string): Promise<void>
  remove(row: MyTagRow): Promise<void>
}

/** 單元手上那一顆還沒寫回去的樣子；預覽先看它，再看清單的待套用，最後才看現況 */
export interface MyTagsWish {
  full: string
  tagSet: string
  state: TagState
}

/** 送出前後同一組的列相比，多出來的那列就是 EH 剛收下的 */
export function addedRow(before: readonly MyTagRow[], after: readonly MyTagRow[]): MyTagRow | null {
  const known = new Set(before.map((row) => row.id))
  return after.find((row) => !known.has(row.id)) ?? null
}
