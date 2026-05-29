import { GM } from '$'
import { reactive, ref, watch, nextTick, type Ref } from 'vue'
import type { QuickTag, TagLine } from '@/types'
import { DEFAULT_NS_ORDER, type TagDbMirror } from '@/services/tagDb'
import { locale, setLocale, detectLocale, t, type Locale } from '@/composables/useI18n'
import { PRESETS_BY_ID, type TagStylePresetId } from '@/composables/useTagStyle'

const KEYS = {
  profiles: 'eqt_profiles',
  corrupted: 'eqt_profiles_corrupted',  // 解析失敗時備份原始 JSON 到此 key
  settings: 'eqt_settings',
}

export interface Profile {
  name: string
  tagLines: TagLine[]
  isDefault?: boolean
}

export type DblClickAction = 'search' | 'searchNewTab' | 'clearSearch' | 'none'

// --- settings: single source of truth ---
// 新增 setting 只要：① INITIAL_SETTINGS 加一欄 + ② 加一行 named export。
// load / save / watch 自動掃描 refs。locale 走獨立處理（從 useI18n import）。
const INITIAL_SETTINGS = {
  useNhWeight: true,
  nsOrder: [...DEFAULT_NS_ORDER] as string[],
  disabledNs: [] as string[],
  fontFamily: '',
  fontWeight: '',
  dblClickLeft: 'search' as DblClickAction,
  dblClickRight: 'searchNewTab' as DblClickAction,
  newTabActive: true,
  nsFormat: 'long' as 'long' | 'short',
  defaultExactMatch: true,
  tagDbMirror: 'jsdelivr' as TagDbMirror,
  tagDbTtlDays: 7,
  tagStylePreset: 'flat' as TagStylePresetId,
}

type Settings = typeof INITIAL_SETTINGS
type SettingKey = keyof Settings

const refs = Object.fromEntries(
  Object.entries(INITIAL_SETTINGS).map(([k, v]) => [k, ref(v)]),
) as { [K in SettingKey]: Ref<Settings[K]> }

export const useNhWeight       = refs.useNhWeight
export const nsOrder           = refs.nsOrder
export const disabledNs        = refs.disabledNs
export const fontFamily        = refs.fontFamily
export const fontWeight        = refs.fontWeight
export const dblClickLeft      = refs.dblClickLeft
export const dblClickRight     = refs.dblClickRight
export const newTabActive      = refs.newTabActive
export const nsFormat          = refs.nsFormat
export const defaultExactMatch = refs.defaultExactMatch
export const tagDbMirror       = refs.tagDbMirror
export const tagDbTtlDays      = refs.tagDbTtlDays
export const tagStylePreset    = refs.tagStylePreset

function loadAllSettings(persisted: Partial<Settings>): void {
  for (const key of Object.keys(INITIAL_SETTINGS) as SettingKey[]) {
    if (key in persisted) {
      (refs[key].value as Settings[typeof key]) = persisted[key]!
    }
  }
}

function serializeAllSettings(): Settings & { locale: Locale | '' } {
  const out = Object.fromEntries(
    Object.entries(refs).map(([k, r]) => [k, r.value]),
  ) as Settings
  return { ...out, locale: locale.value }
}

// Tag definitions without labels — labels are filled by getDefaultTagLines() based on locale
const DEFAULT_TAG_DEFS: { tag: string; url?: string; labelKey: string; disabledModes?: readonly ('or' | 'exclude')[] }[][] = [
  [
    { tag: 'language:chinese$', labelKey: 'default.chinese' },
    { tag: 'language:english$', labelKey: 'default.english' },
    { tag: 'language:korean$', labelKey: 'default.korean' },
    { tag: '-language:english$, -language:chinese$, -language:korean$', labelKey: 'default.japanese', disabledModes: ['or', 'exclude'] },
  ],
  [
    { tag: 'other:"full color$"', labelKey: 'default.fullColor' },
    { tag: 'other:uncensored$', labelKey: 'default.uncensored' },
    { tag: 'language:translated$', labelKey: 'default.translated' },
    { tag: 'language:speechless$', labelKey: 'default.speechless' },
    { tag: '-other:"ai generated$"', labelKey: 'default.excludeAI', disabledModes: ['or', 'exclude'] },
    { tag: '-other:"rough translation$"', labelKey: 'default.excludeRoughTL', disabledModes: ['or', 'exclude'] },
  ],
  [
    { tag: '', url: '?f_cats=0&f_search=other%3A%22how+to%24%22', labelKey: 'default.howto' },
    { tag: '', url: '?f_cats=0&f_search=o%3Aartbook%24', labelKey: 'default.artbook' },
    { tag: '', url: '?f_cats=991', labelKey: 'default.imageset' },
    { tag: '', url: '?f_cats=1019&f_search=o%3Atankoubon%24', labelKey: 'default.tankoubon' },
    { tag: '', url: '?f_cats=1019&f_search=o%3Aanthology%24', labelKey: 'default.anthology' },
  ],
  [],
]

export function getDefaultTagLines(): TagLine[] {
  return DEFAULT_TAG_DEFS.map(line => ({
    tags: line.map(({ tag, url, labelKey, disabledModes }) => ({
      tag,
      ...(url ? { url } : {}),
      label: t(labelKey),
      ...(disabledModes ? { disabledModes } : {}),
    })),
  }))
}

// Type guards — strict additive 策略下，只驗證 required 欄位存在且型別正確，
// 未知欄位由 JS 物件天然 tolerate（不刪不報錯），forward-compatible。
// 任何未來新增欄位都應為 optional，這些 guard 不需要改動。

function isValidQuickTag(x: unknown): x is QuickTag {
  if (!x || typeof x !== 'object') return false
  const o = x as QuickTag
  if (typeof o.tag !== 'string') return false
  // QuickTag 的 discriminant：至少要有 non-empty tag 或 non-empty url
  // （tag 為空字串 + url 是 URL entry 的形式）
  const hasTag = o.tag !== ''
  const hasUrl = typeof o.url === 'string' && o.url !== ''
  return hasTag || hasUrl
}

export function isValidTagLine(x: unknown): x is TagLine {
  if (!x || typeof x !== 'object') return false
  const tags = (x as TagLine).tags
  return Array.isArray(tags) && tags.every(isValidQuickTag)
}

interface ProfilesData {
  active: number
  profiles: Profile[]
  deleted?: Profile[]
}

function isValidProfile(x: unknown): x is Profile {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.name === 'string'
    && Array.isArray(o.tagLines)
    && o.tagLines.every(isValidTagLine)
}

function isValidProfilesData(x: unknown): x is ProfilesData {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.active === 'number'
    && Array.isArray(o.profiles) && o.profiles.every(isValidProfile)
    && (o.deleted === undefined || (Array.isArray(o.deleted) && o.deleted.every(isValidProfile)))
}

// 解析失敗時備份原始 JSON 到獨立 key，避免靜默丟失用戶資料。
// 之後可透過 GM 工具或 browser console 從 KEYS.corrupted 手動恢復。
async function backupCorrupted(raw: string, reason: string) {
  await GM.setValue(KEYS.corrupted, raw)
  console.error(`[eqt] profiles parse failed (${reason}). Original data preserved at GM storage key: ${KEYS.corrupted}`)
}

// --- reactive state (profiles) ---

export const profiles = reactive<Profile[]>([])
export const deletedProfiles = reactive<Profile[]>([])
export const activeProfileIdx = ref(0)
export const tagLines = reactive<TagLine[]>([])

// --- load from GM ---

export async function loadStore(): Promise<void> {
  const [savedProfiles, savedSettings] = await Promise.all([
    GM.getValue<string>(KEYS.profiles, ''),
    GM.getValue<string>(KEYS.settings, ''),
  ])

  // profiles — strict additive 策略：不做 migration。
  // 解析失敗（JSON syntax / schema mismatch）就備份原始資料 + 載入 default。
  let loaded = false
  if (savedProfiles) {
    try {
      const data: unknown = JSON.parse(savedProfiles)
      if (!isValidProfilesData(data)) throw new Error('schema mismatch')
      profiles.splice(0, profiles.length, ...data.profiles)
      deletedProfiles.splice(0, deletedProfiles.length, ...(data.deleted ?? []))
      activeProfileIdx.value = Math.min(Math.max(data.active, 0), profiles.length - 1)
      loaded = true
    } catch (err) {
      await backupCorrupted(savedProfiles, (err as Error).message)
    }
  }
  if (!loaded) {
    profiles.splice(0, profiles.length, { name: t('default.profileName'), tagLines: getDefaultTagLines(), isDefault: true })
    activeProfileIdx.value = 0
  }

  tagLines.splice(0, tagLines.length, ...profiles[activeProfileIdx.value].tagLines)

  // settings
  const parsed = savedSettings ? JSON.parse(savedSettings) as Partial<Settings & { locale?: Locale | '' }> : {}
  loadAllSettings(parsed)
  // tagStylePreset 需要對「不認得的 preset id」做 fallback（其他 setting 走 strict additive）
  if (!PRESETS_BY_ID.has(tagStylePreset.value)) tagStylePreset.value = 'flat'
  setLocale(parsed.locale ? parsed.locale as Locale : detectLocale())
}

// --- profile switching ---

let localeChanging = false

function syncTagLinesToActiveProfile() {
  const p = profiles[activeProfileIdx.value]
  p.tagLines = JSON.parse(JSON.stringify(tagLines))
  if (p.isDefault && !localeChanging) p.isDefault = false
}

export function switchProfile(idx: number): void {
  if (idx < 0 || idx >= profiles.length || idx === activeProfileIdx.value) return
  syncTagLinesToActiveProfile()
  activeProfileIdx.value = idx
  tagLines.splice(0, tagLines.length, ...profiles[idx].tagLines)
}

export function renameProfile(idx: number, name: string): void {
  profiles[idx].name = name
  saveProfiles()
}

export function createProfile(name: string): void {
  syncTagLinesToActiveProfile()
  const lineCount = tagLines.length
  profiles.push({ name, tagLines: Array.from({ length: lineCount }, () => ({ tags: [] })) })
  activeProfileIdx.value = profiles.length - 1
  tagLines.splice(0, tagLines.length, ...Array.from({ length: lineCount }, () => ({ tags: [] })))
}

export function deleteProfile(idx: number): void {
  if (profiles.length <= 1) return
  syncTagLinesToActiveProfile()
  const [removed] = profiles.splice(idx, 1)
  deletedProfiles.push(removed)
  const active = activeProfileIdx.value
  const newIdx = idx < active ? active - 1 : Math.min(idx, profiles.length - 1)
  activeProfileIdx.value = newIdx
  tagLines.splice(0, tagLines.length, ...profiles[newIdx].tagLines)
}

export function restoreProfile(idx: number): void {
  const [restored] = deletedProfiles.splice(idx, 1)
  profiles.push(restored)
}

export function purgeProfile(idx: number): void {
  deletedProfiles.splice(idx, 1)
}

export function reorderProfiles(fromIdx: number, toIdx: number): void {
  if (fromIdx === toIdx) return
  syncTagLinesToActiveProfile()
  const [moved] = profiles.splice(fromIdx, 1)
  profiles.splice(toIdx, 0, moved)
  // update activeProfileIdx to follow the active profile
  const active = activeProfileIdx.value
  if (active === fromIdx) {
    activeProfileIdx.value = toIdx
  } else if (fromIdx < active && toIdx >= active) {
    activeProfileIdx.value = active - 1
  } else if (fromIdx > active && toIdx <= active) {
    activeProfileIdx.value = active + 1
  }
  saveProfiles()
}

export function updateProfileTagLines(idx: number, newTagLines: TagLine[]): void {
  profiles[idx].tagLines = newTagLines
  if (profiles[idx].isDefault) profiles[idx].isDefault = false
  if (idx === activeProfileIdx.value) {
    tagLines.splice(0, tagLines.length, ...newTagLines)
    // watcher on tagLines will call saveProfiles()
  } else {
    saveProfiles()
  }
}

// --- auto-save on change ---

function saveProfiles() {
  syncTagLinesToActiveProfile()
  GM.setValue(KEYS.profiles, JSON.stringify({
    active: activeProfileIdx.value,
    profiles: profiles.map(p => ({ name: p.name, tagLines: p.tagLines, ...(p.isDefault ? { isDefault: true } : {}) })),
    deleted: deletedProfiles.map(p => ({ name: p.name, tagLines: p.tagLines })),
  }))
}

function saveSettings() {
  GM.setValue(KEYS.settings, JSON.stringify(serializeAllSettings()))
}

export function startAutoSave(): void {
  watch([tagLines, deletedProfiles], saveProfiles)
  // locale 是從 useI18n import 的獨立 ref，不在 refs 物件裡——明確加進 watch list
  watch([...Object.values(refs), locale], saveSettings, { deep: true })

  // When locale changes, update default profiles' labels
  watch(locale, async () => {
    localeChanging = true
    for (const p of profiles) {
      if (!p.isDefault) continue
      p.name = t('default.profileName')
      p.tagLines = getDefaultTagLines()
      if (activeProfileIdx.value === profiles.indexOf(p)) {
        tagLines.splice(0, tagLines.length, ...p.tagLines)
      }
    }
    await nextTick()
    localeChanging = false
  })
}
