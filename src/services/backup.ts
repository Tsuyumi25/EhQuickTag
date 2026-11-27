import { cacheDelete, cacheGet, cacheKeys, cacheSet } from '@/services/gmStorage'
import { KEYS as STORE_KEYS } from '@/services/store'
import { STORAGE_KEY as GALLERY_RULES_KEY } from '@/composables/useGalleryRuleStore'
import { HISTORY_KEY } from '@/services/search/searchSession'
import { EDIT_PREFIX, LEGACY_KEY as EDITS_LEGACY_KEY } from '@/services/mytags/mytagsEditStore'
import {
  GALLERY_PREFIX, VERDICT_PREFIX, GALLERIES_LEGACY_KEY, VERDICTS_LEGACY_KEY,
  GENERATION_KEY as SAMPLE_GENERATION_KEY,
} from '@/services/mytags/mytagsSampleStore'
import { itemNamespace } from '@/services/mytags/mytagsItemStore'

const BACKUP_FORMAT = 'eh-quick-tag-backup'
const BACKUP_VERSION = 1

// 只收使用者自己產生、重抓不回來的資料。下載的標籤字典／計數／wiki、從 EH 重抓的
// My Tags 色票、跨頁暫存的選取（eqt_pick:）都不收。新增一種使用者資料時要登記在這裡，
// 否則匯出漏掉、匯入也不會清掉舊值
const BACKUP_KEYS: readonly string[] = [
  ...Object.values(STORE_KEYS),
  GALLERY_RULES_KEY,
  HISTORY_KEY,
  EDITS_LEGACY_KEY,
  GALLERIES_LEGACY_KEY,
  VERDICTS_LEGACY_KEY,
  SAMPLE_GENERATION_KEY,
]

const BACKUP_PREFIXES: readonly string[] = [
  ...Object.values(itemNamespace(EDIT_PREFIX)),
  ...Object.values(itemNamespace(VERDICT_PREFIX)),
  // 樣本的命名空間帶著世代代號（`~<generation>:`），live 與 `_base:` 都在這個前綴底下
  `${GALLERY_PREFIX}~`,
]

export function isBackupKey(key: string): boolean {
  return BACKUP_KEYS.includes(key) || BACKUP_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export type BackupErrorReason = 'invalid' | 'newer'

export class BackupError extends Error {
  constructor(readonly reason: BackupErrorReason, detail: string) {
    super(detail)
  }
}

export interface Backup {
  exportedAt: string
  entries: Map<string, string>
}

interface BackupFile {
  format: string
  version: number
  exportedAt: string
  data: Record<string, unknown>
}

// 檔案裡的值盡量展開成 JSON，備份檔讀得懂也能 diff。只有重新序列化會得到同一個
// 字串時才展開，其餘原字串照存：樣本世代代號之類的純字串，看起來像數字（`1e5`）也不能
// 被正規化成別的寫法，否則以它為前綴的 key 全部對不上。匯入時字串一律原樣寫回
function encodeValue(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed !== 'string' && JSON.stringify(parsed) === raw ? parsed : raw
  } catch {
    return raw
  }
}

export function encodeBackup(entries: Iterable<readonly [string, string]>, exportedAt: Date): string {
  const data: Record<string, unknown> = {}
  for (const [key, raw] of [...entries].sort(([a], [b]) => a.localeCompare(b))) data[key] = encodeValue(raw)
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    data,
  }, null, 2)
}

export function decodeBackup(text: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new BackupError('invalid', (e as Error).message)
  }
  const file = parsed as Partial<BackupFile> | null
  if (typeof file !== 'object' || file === null || file.format !== BACKUP_FORMAT) throw new BackupError('invalid', 'not a backup file')
  if (typeof file.version !== 'number' || !Number.isInteger(file.version)) throw new BackupError('invalid', 'missing version')
  if (file.version > BACKUP_VERSION) throw new BackupError('newer', `version ${file.version}`)
  if (file.version !== BACKUP_VERSION) throw new BackupError('invalid', `version ${file.version}`)
  if (typeof file.exportedAt !== 'string' || typeof file.data !== 'object' || file.data === null || Array.isArray(file.data)) {
    throw new BackupError('invalid', 'malformed envelope')
  }

  const entries = new Map<string, string>()
  for (const [key, value] of Object.entries(file.data)) {
    // 不認得的 key 不寫進 storage：寫進去也沒有程式會讀，只會留著當垃圾
    if (!isBackupKey(key)) throw new BackupError('invalid', `unknown key ${key}`)
    entries.set(key, typeof value === 'string' ? value : JSON.stringify(value))
  }
  return { exportedAt: file.exportedAt, entries }
}

export async function exportBackup(now = new Date()): Promise<string> {
  const keys = (await cacheKeys('')).filter(isBackupKey)
  const values = await Promise.all(keys.map(async (key) => [key, await cacheGet(key)] as const))
  return encodeBackup(values.filter((entry): entry is [string, string] => entry[1] !== null), now)
}

/**
 * 以備份取代目前的使用者資料。各模組在記憶體裡還留著舊狀態、下次存檔會蓋回去，
 * 呼叫端寫完必須立刻重新整理頁面，讓每個模組從 storage 重新載入並跑自己的驗證／遷移
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  // 先寫新值再刪多餘的：中途失敗時，至少備份裡有的資料都已經寫進去
  for (const [key, raw] of backup.entries) await cacheSet(key, raw)
  const stale = (await cacheKeys('')).filter((key) => isBackupKey(key) && !backup.entries.has(key))
  for (const key of stale) await cacheDelete(key)
}
