import { cacheGet, cacheSet } from '@/services/gmStorage'
import { tagColors, type TagColors } from '@/services/mytags/mytagsColors'
import {
  fetchTagSet, fetchTagSetIndex,
  type MyTagRow, type TagSetSnapshot,
} from '@/composables/useEhMyTagsHost'
import type { ApiCredentials } from '@/services/mytags/mytagsApi'
import { pageWindow } from '@/utils/pageWindow'

type MyTagsPaletteEntry = TagColors & Pick<MyTagRow, 'weight' | 'hidden' | 'watch'>
export type MyTagsPalette = Record<string, MyTagsPaletteEntry>

const KEY = 'eqt_mytags_palette'
const SCHEMA = 3

// 固定採用選單順序，避免切換目前標籤集就改變 Gallery 的重複標籤配色。
export function buildMyTagsPalette(sets: TagSetSnapshot[]): MyTagsPalette {
  const colors = new Map<string, MyTagsPaletteEntry>()
  for (const set of sets) {
    if (!set.enabled) continue
    for (const row of set.rows) {
      if (colors.has(row.full)) continue
      colors.set(row.full, {
        ...tagColors({
          color: row.color,
          setColor: set.defaultColor,
          weight: row.weight,
          hidden: row.hidden,
        }),
        weight: row.weight,
        hidden: row.hidden,
        watch: row.watch,
      })
    }
  }
  return Object.fromEntries(colors)
}

function isPaletteEntry(value: unknown): value is MyTagsPaletteEntry {
  if (!value || typeof value !== 'object') return false
  const { text, face, edge, weight, hidden, watch } = value as Partial<MyTagsPaletteEntry>
  return typeof text === 'string' && typeof face === 'string' && typeof edge === 'string'
    && typeof weight === 'number' && Number.isFinite(weight) && typeof hidden === 'boolean'
    && typeof watch === 'boolean'
}

function parsePalette(raw: string | null): MyTagsPalette | null {
  if (!raw) return null
  try {
    const saved = JSON.parse(raw) as { schema?: number; tags?: Record<string, unknown> }
    if (saved.schema !== SCHEMA || !saved.tags || typeof saved.tags !== 'object' || Array.isArray(saved.tags)) return null
    const out: MyTagsPalette = {}
    for (const [full, colors] of Object.entries(saved.tags)) {
      if (!isPaletteEntry(colors)) return null
      out[full] = colors
    }
    return out
  } catch { return null }
}

export async function saveMyTagsPalette(palette: MyTagsPalette): Promise<void> {
  await cacheSet(KEY, JSON.stringify({ schema: SCHEMA, tags: palette }))
}

export interface MyTagsSnapshot {
  /** 選單順序 */
  sets: TagSetSnapshot[]
  /** /mytags 預設打開的那一組 */
  current: string
  /** 任何一份 /mytags 的新增表單都送得到任何一組，見 submitNewTag */
  form: HTMLFormElement
  /** 那份 /mytags 裡的 API 憑證，見 parseCredentials */
  credentials: ApiCredentials | null
}

/** null 代表未登入；抓不到或少抓到一組就 reject，不拿缺一組的資料當完整的 */
export async function fetchAllTagSets(): Promise<MyTagsSnapshot | null> {
  const index = await fetchTagSetIndex()
  if (index === 'signed-out') return null
  if (!index) throw new Error('mytags-unreachable')
  const rest = await Promise.all(index.order
    .filter((value) => value !== index.current.value)
    .map((value) => fetchTagSet(value)))
  if (rest.some((set) => !set)) throw new Error('mytags-incomplete')

  const byValue = new Map<string, TagSetSnapshot>([[index.current.value, index.current]])
  for (const set of rest) if (set) byValue.set(set.value, set)
  return {
    sets: index.order.flatMap((value) => byValue.get(value) ?? []),
    current: index.current.value,
    form: index.form,
    credentials: index.credentials,
  }
}

/** null 代表未登入：沒有 My Tags 可抓，也不算失敗 */
export async function refreshMyTagsPalette(): Promise<MyTagsPalette | null> {
  const snapshot = await fetchAllTagSets()
  if (!snapshot) return null
  const palette = buildMyTagsPalette(snapshot.sets)
  await saveMyTagsPalette(palette)
  return palette
}

/** null 代表未登入，chip 照一般配色；只有真的抓不到才 reject */
export async function loadMyTagsPalette(): Promise<MyTagsPalette | null> {
  // gallery 頁以 apiuid = -1 標示未登入，不必打 /mytags 也不該拿上一位登入者的快取。
  // 列表頁不論登入與否都沒有 apiuid，只能交給 /mytags 的轉址判斷
  if (pageWindow<{ apiuid?: number }>().apiuid === -1) return null
  const cached = parsePalette(await cacheGet(KEY))
  return cached ?? await refreshMyTagsPalette()
}
