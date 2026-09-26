import { cacheGet, cacheSet } from '@/services/gmStorage'
import { tagColors, type TagColors } from '@/services/mytags/mytagsColors'
import {
  fetchTagSet, fetchTagSetIndex,
  type MyTagRow, type TagSetSnapshot,
} from '@/composables/useEhMyTagsHost'

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

async function fetchAllTagSets(): Promise<TagSetSnapshot[]> {
  const index = await fetchTagSetIndex()
  if (!index) throw new Error('mytags-unreachable')
  const rest = await Promise.all(index.order
    .filter((value) => value !== index.current.value)
    .map((value) => fetchTagSet(value)))
  if (rest.some((set) => !set)) throw new Error('mytags-incomplete')

  const byValue = new Map<string, TagSetSnapshot>([[index.current.value, index.current]])
  for (const set of rest) if (set) byValue.set(set.value, set)
  return index.order.flatMap((value) => byValue.get(value) ?? [])
}

export async function refreshMyTagsPalette(): Promise<MyTagsPalette> {
  const palette = buildMyTagsPalette(await fetchAllTagSets())
  await saveMyTagsPalette(palette)
  return palette
}

export async function loadMyTagsPalette(): Promise<MyTagsPalette> {
  const cached = parsePalette(await cacheGet(KEY))
  return cached ?? await refreshMyTagsPalette()
}
