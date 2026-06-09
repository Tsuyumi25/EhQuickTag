import { reactive, ref, watch, nextTick, type Ref } from 'vue'
import { cacheGet, cacheSet } from '@/services/gmStorage'
import type { Line, Button, ButtonLine, SeparatorLine, TagButton, UrlButton, TagMode } from '@/types'
import { DEFAULT_NS_ORDER, type TagDbMirror } from '@/services/tagDb'
import { locale, setLocale, detectLocale, isCJKLocale, t, type Locale } from '@/composables/useI18n'
import { PRESETS_BY_ID, type TagStylePresetId } from '@/composables/useTagStyle'

const KEYS = {
  profiles: 'eqt_profiles',
  corrupted: 'eqt_profiles_corrupted',  // 解析失敗時備份原始 JSON 列表（CorruptedProfile[]）
  settings: 'eqt_settings',
}

// 無法解析的舊版 profiles 原始資料，列在 SettingsPopup「損壞的資料」section
// 給使用者匯出 / 永久刪除。觸發場景：使用者更新插件後 schema 不相容導致 parse / migration 全部失敗。
export interface CorruptedProfile {
  raw: string         // 原始 JSON 字串（無法解析的整份 profiles 資料）
  savedAt: number     // 偵測到失敗的時間戳
  reason: string      // parse 失敗原因（譬如 JSON syntax error 或 'schema mismatch'）
}

export interface Profile {
  name: string
  lines: Line[]
  isDefault?: boolean
}

export type DblClickAction = 'search' | 'searchNewTab' | 'clearSearch' | 'none'

// --- enum-shape settings：id + i18n labelKey 物件陣列（跟 TAG_STYLE_PRESETS 同 pattern）---
// 一處定義同時餵 loadAllSettings 的 enum validator + SettingsPopup 的 v-for tristate UI，
// 加第 4 個 mode 只需要 append 一個物件、validation + UI 同步生效。
//
// 形式跟 inline pipe union（如 DblClickAction）的選擇：
//   - inline union → 純型別 / 沒 runtime iterate 需求
//   - 物件陣列 + 派生 type → runtime 需要 iterate id 集合 (validation, v-for)
//                            且每個 id 綁定固定 metadata (i18n key 等)

export const SEARCH_PANEL_LANG_MODES = [
  { id: 'auto',         labelKey: 'settings.searchPanelLangAuto' },
  { id: 'toggle',       labelKey: 'settings.searchPanelLangToggle' },
  { id: 'english-only', labelKey: 'settings.searchPanelLangEnglishOnly' },
] as const
export type SearchPanelLangMode = typeof SEARCH_PANEL_LANG_MODES[number]['id']

export const CONVERT_TO_TRADITIONAL_MODES = [
  { id: 'auto', labelKey: 'settings.convertToTraditionalAuto' },
  { id: 'on',   labelKey: 'settings.convertToTraditionalOn' },
  { id: 'off',  labelKey: 'settings.convertToTraditionalOff' },
] as const
export type ConvertToTraditional = typeof CONVERT_TO_TRADITIONAL_MODES[number]['id']

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
  nsFormat: 'short' as 'long' | 'short',
  defaultExactMatch: true,
  tagDbMirror: 'jsdelivr' as TagDbMirror,
  tagDbTtlDays: 7,
  tagStylePreset: 'flat' as TagStylePresetId,
  // on: include 狀態用 status 綠色（忽略自定義 line-color）；off: 沿用 line-color（預設沿用既有行為）
  useAccentOnInclude: false,
  // SearchPanel chip 顯示語言（true = CJK 翻譯名稱、false = 原生英文 token literal）。
  // 預設跟著 browser locale 走，使用者用 controls-row 的「中文/EN」toggle 覆蓋。
  // 持久化：跨頁／重開瀏覽器後維持上次選擇，不再回退到 browser locale
  searchPanelShowCJK: isCJKLocale(),
  // 兩個顯示控制：對應 SettingsPopup 'searchBar' tab 的 checkbox。
  // 故意不做「整個 TagBar 隱藏」的 toggle——關掉就 lock out 自己（設定打不開）
  showNativeSearch: true,   // EH 原生 #f_search 輸入框
  showSearchPanel: true,    // SearchPanel 進階面板（legend-style 卡片）
  // SearchPanel chip 顯示語言模式：
  //   'auto'         → 跟著 UI locale 走（CJK → toggle、其他 → english-only）
  //   'toggle'       → 顯示中/EN 切換按鈕，使用者用 searchPanelShowCJK 控制當下選項
  //   'english-only' → 隱藏切換按鈕，chip 一律顯示英文 token literal
  // 預設 'auto'：使用者切 UI 語言時自動跟著變、不需要再去這邊手動調
  searchPanelLangMode: 'auto' as SearchPanelLangMode,
  // CJK 標籤名稱是否經 OpenCC 簡轉繁。EhTagTranslation DB 原文是簡體中文，繁體
  // 使用者讀起來有點怪——開啟後過 cjkDict.toTW 字面繁化（一對多取第一個、
  // 沒考慮地區慣用詞，譬如「软件」→「軟件」而非「軟體」）
  //   'auto' → zh-TW locale = on、其他 = off
  //   'on'   → 一律繁化
  //   'off'  → 一律 DB 原文（簡體）
  // 預設 'auto'，跟 searchPanelLangMode 同 pattern——locale 變動會自動跟上
  convertToTraditional: 'auto' as ConvertToTraditional,
  // SearchPanel 是否記錄 history（dismissTerms / clearSearch 推到 history 列表
  // 並持久化到 GM storage）。隱私考量可關。關掉後 history row 隱藏、不再 push，
  // 既有 storage 內容保留——再開啟時繼續長
  enableHistory: true,
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
export const useAccentOnInclude = refs.useAccentOnInclude
export const searchPanelShowCJK = refs.searchPanelShowCJK
export const showNativeSearch   = refs.showNativeSearch
export const showSearchPanel    = refs.showSearchPanel
export const searchPanelLangMode = refs.searchPanelLangMode
export const convertToTraditional = refs.convertToTraditional
export const enableHistory      = refs.enableHistory

// enum-shape setting 的合法 id 集合。壞值 silently fallback 到 INITIAL_SETTINGS 預設——
// 沒這層守門 GM storage 被竄改塞個壞字串會直接灌進 ref，UI 永久卡在「無 active button、
// 沒錯誤訊息」的灰態（三顆 tristate 按鈕沒一個 === 壞值 → 全部沒 highlight）。
// 加新 enum-shape setting 時順手在這註冊一條，validation 自動接管。
const SETTING_VALIDATORS: Partial<{ [K in SettingKey]: (v: unknown) => boolean }> = {
  searchPanelLangMode:  v => SEARCH_PANEL_LANG_MODES.some(m => m.id === v),
  convertToTraditional: v => CONVERT_TO_TRADITIONAL_MODES.some(m => m.id === v),
}

function loadAllSettings(persisted: Partial<Settings>): void {
  for (const key of Object.keys(INITIAL_SETTINGS) as SettingKey[]) {
    if (!(key in persisted)) continue
    const value = persisted[key]
    const validator = SETTING_VALIDATORS[key]
    if (validator && !validator(value)) continue
    (refs[key].value as Settings[typeof key]) = value!
  }
}

function serializeAllSettings(): Settings & { locale: Locale | '' } {
  const out = Object.fromEntries(
    Object.entries(refs).map(([k, r]) => [k, r.value]),
  ) as Settings
  return { ...out, locale: locale.value }
}

// Line definitions without labels — labels are filled by getDefaultLines() based on locale
type DefaultButtonDef =
  | { kind: 'tag'; tags: string[]; labelKey: string; disabledModes?: readonly TagMode[] }
  | { kind: 'url'; url: string; labelKey: string }

type DefaultLineDef =
  | { kind: 'separator'; labelKey?: string; style?: SeparatorLine['style'] }
  | { kind: 'buttons'; buttons: DefaultButtonDef[] }

const DEFAULT_LINE_DEFS: DefaultLineDef[] = [
  { kind: 'separator', labelKey: 'default.general', style: { textAlign: 'left' } },
  { kind: 'buttons', buttons: [
    { kind: 'tag', tags: ['l:chinese$'], labelKey: 'default.chinese' },
    { kind: 'tag', tags: ['l:english$'], labelKey: 'default.english' },
    { kind: 'tag', tags: ['l:japanese$'], labelKey: 'default.japanese' },
    { kind: 'tag', tags: ['l:korean$'], labelKey: 'default.korean' },
    { kind: 'tag', tags: [
      '-l:chinese$',
      '-l:english$',
      '-l:japanese$',
      '-l:korean$',
      '-l:speechless$',
      '-l:"text cleaned$"',
    ], labelKey: 'default.japaneseOnly', disabledModes: ['or', 'exclude'] },
    { kind: 'tag', tags: ['l:speechless$'], labelKey: 'default.speechless' },
    { kind: 'tag', tags: ['l:"text cleaned$"'], labelKey: 'default.textCleaned' },
    { kind: 'tag', tags: ['l:translated$'], labelKey: 'default.translated' },
  ] },
  { kind: 'buttons', buttons: [
    { kind: 'tag', tags: ['o:"full color$"'], labelKey: 'default.fullColor' },
    { kind: 'tag', tags: ['o:uncensored$'], labelKey: 'default.uncensored' },
    { kind: 'tag', tags: ['-o:"ai generated$"'], labelKey: 'default.excludeAI', disabledModes: ['or', 'exclude'] },
    { kind: 'tag', tags: ['-o:"rough translation$"'], labelKey: 'default.excludeRoughTL', disabledModes: ['or', 'exclude'] },
  ] },
  { kind: 'buttons', buttons: [
    { kind: 'url', url: '?f_cats=0&f_search=o%3A%22how+to%24%22', labelKey: 'default.howto' },
    { kind: 'url', url: '?f_cats=0&f_search=o%3Aartbook%24', labelKey: 'default.artbook' },
    { kind: 'url', url: '?f_cats=991', labelKey: 'default.imageset' },
    { kind: 'url', url: '?f_cats=1019&f_search=o%3Atankoubon%24', labelKey: 'default.tankoubon' },
    { kind: 'url', url: '?f_cats=1019&f_search=o%3Aanthology%24', labelKey: 'default.anthology' },
  ] },
  { kind: 'separator', style: { textAlign: 'left' } },
  { kind: 'buttons', buttons: [] },
]

export function getDefaultLines(): Line[] {
  return DEFAULT_LINE_DEFS.map<Line>(def => {
    if (def.kind === 'separator') {
      return {
        kind: 'separator',
        ...(def.labelKey ? { label: t(def.labelKey) } : {}),
        ...(def.style ? { style: def.style } : {}),
      }
    }
    return {
      kind: 'buttons',
      buttons: def.buttons.map<Button>(b => b.kind === 'tag'
        ? { kind: 'tag', tags: b.tags, label: t(b.labelKey), ...(b.disabledModes ? { disabledModes: b.disabledModes } : {}) }
        : { kind: 'url', url: b.url, label: t(b.labelKey) },
      ),
    }
  })
}

// --- legacy migration ---
// 一次性 read-time adapter：把舊版 { tags: QuickTag[], color?, separator? } 結構
// 轉成新版 Line union。load 後寫回 storage 就是純新格式，下次 load 直接走 fast path。
// 既有欄位永不改名/改型別/改語意（strict additive）；未來新增功能用 union variant 或
// optional 欄位處理，不再需要 migration。

function splitMultiTagLegacy(tag: string): string[] {
  return tag.split(',').map(s => s.trim()).filter(Boolean)
}

function migrateLegacyButton(x: unknown): Button | null {
  if (!x || typeof x !== 'object') return null
  const o = x as any
  // 已是新格式
  if (o.kind === 'tag' || o.kind === 'url') return o as Button
  // 舊 QuickTag：tag='' + url 非空 = URL entry；否則 tag entry
  if (typeof o.url === 'string' && o.url !== '') {
    return { kind: 'url', url: o.url, ...(o.label ? { label: o.label } : {}), ...(o.color ? { color: o.color } : {}) }
  }
  if (typeof o.tag === 'string' && o.tag !== '') {
    return {
      kind: 'tag',
      tags: splitMultiTagLegacy(o.tag),
      ...(o.label ? { label: o.label } : {}),
      ...(o.color ? { color: o.color } : {}),
      ...(o.disabledModes ? { disabledModes: o.disabledModes } : {}),
    }
  }
  return null
}

function migrateLegacyLine(x: unknown): Line | null {
  if (!x || typeof x !== 'object') return null
  const o = x as any
  // 已是新格式
  if (o.kind === 'buttons' || o.kind === 'separator') return o as Line
  // 舊 TagLine：有 separator 欄位 → SeparatorLine；否則 ButtonLine
  if (o.separator && typeof o.separator === 'object') {
    const sep = o.separator
    const style: SeparatorLine['style'] = {}
    if (typeof sep.style === 'string') style.line = sep.style
    if (typeof sep.textAlign === 'string') style.textAlign = sep.textAlign
    if (typeof sep.textSize === 'number') style.textSize = sep.textSize
    if (typeof sep.lineThickness === 'number') style.lineThickness = sep.lineThickness
    // 舊 preset → linePosition：header 樣式（label 上、線下）= bottom；
    // divider 樣式（label 中、線兩邊）= middle（也是新預設，省略不寫）
    if (sep.preset === 'header') style.linePosition = 'bottom'
    return {
      kind: 'separator',
      ...(sep.label ? { label: sep.label } : {}),
      ...(Object.keys(style).length ? { style } : {}),
      ...(o.color ? { color: o.color } : {}),
    }
  }
  if (Array.isArray(o.tags)) {
    const buttons = o.tags.map(migrateLegacyButton).filter((b: Button | null): b is Button => b !== null)
    return { kind: 'buttons', buttons, ...(o.color ? { color: o.color } : {}) }
  }
  return null
}

// --- type guards ---
// strict additive 策略：只驗 discriminant + required 欄位。未知欄位由 JS 物件天然 tolerate。
// 未來新增功能用 optional 欄位 / 新 union variant，這些 guard 不需要改動。

function isValidButton(x: unknown): x is Button {
  if (!x || typeof x !== 'object') return false
  const o = x as any
  if (o.kind === 'tag') return Array.isArray(o.tags) && o.tags.every((t: unknown) => typeof t === 'string' && t !== '')
  if (o.kind === 'url') return typeof o.url === 'string' && o.url !== ''
  return false
}

export function isValidLine(x: unknown): x is Line {
  if (!x || typeof x !== 'object') return false
  const o = x as any
  if (o.kind === 'buttons') return Array.isArray(o.buttons) && o.buttons.every(isValidButton)
  if (o.kind === 'separator') return true
  return false
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
    && Array.isArray(o.lines)
    && o.lines.every(isValidLine)
}

function isValidProfilesData(x: unknown): x is ProfilesData {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.active === 'number'
    && Array.isArray(o.profiles) && o.profiles.every(isValidProfile)
    && (o.deleted === undefined || (Array.isArray(o.deleted) && o.deleted.every(isValidProfile)))
}

// load 時對每個 line 跑 migration。已是新格式直接 return；舊格式轉換後 isValidLine
// 會接住。drop 掉的 line 是 corrupted/empty/不認識的 entry。
// 舊版欄位叫 `tagLines`（已 rename 為 `lines`），這裡同時接受兩個 key。
function migrateProfile(p: any): Profile | null {
  if (!p || typeof p !== 'object' || typeof p.name !== 'string') return null
  const rawLines = Array.isArray(p.lines) ? p.lines : Array.isArray(p.tagLines) ? p.tagLines : null
  if (!rawLines) return null
  const lines = rawLines.map(migrateLegacyLine).filter((l: Line | null): l is Line => l !== null && isValidLine(l))
  return { name: p.name, lines, ...(p.isDefault ? { isDefault: true } : {}) }
}

function migrateProfilesData(data: any): ProfilesData | null {
  if (!data || typeof data !== 'object' || typeof data.active !== 'number' || !Array.isArray(data.profiles)) return null
  const profiles = data.profiles.map(migrateProfile).filter((p: Profile | null): p is Profile => p !== null)
  if (!profiles.length) return null
  const deleted = Array.isArray(data.deleted) ? data.deleted.map(migrateProfile).filter((p: Profile | null): p is Profile => p !== null) : undefined
  return { active: data.active, profiles, ...(deleted ? { deleted } : {}) }
}

// 解析失敗時備份原始 JSON 到 corruptedProfiles reactive list。
// 透過 startAutoSave 的 watcher 持久化到 KEYS.corrupted（陣列格式）。
// 使用者可在 SettingsPopup「損壞的資料」section 查看 / 匯出 / 永久刪除。
function backupCorrupted(raw: string, reason: string) {
  corruptedProfiles.push({ raw, savedAt: Date.now(), reason })
  console.error(`[eqt] profiles parse failed (${reason}). Preserved in corrupted list (see SettingsPopup → 損壞的資料).`)
}

// --- reactive state (profiles) ---

export const profiles = reactive<Profile[]>([])
export const deletedProfiles = reactive<Profile[]>([])
export const corruptedProfiles = reactive<CorruptedProfile[]>([])
export const activeProfileIdx = ref(0)
export const lines = reactive<Line[]>([])

// --- load from GM ---

export async function loadStore(): Promise<void> {
  const [savedProfiles, savedSettings, savedCorrupted] = await Promise.all([
    cacheGet(KEYS.profiles),
    cacheGet(KEYS.settings),
    cacheGet(KEYS.corrupted),
  ])

  // corrupted list — 先載入既有列表，這樣 backupCorrupted 在 parse profiles 失敗時可以 append
  if (savedCorrupted) {
    try {
      const arr: unknown = JSON.parse(savedCorrupted)
      if (Array.isArray(arr)) {
        const valid = arr.filter((c): c is CorruptedProfile =>
          !!c && typeof c === 'object'
            && typeof (c as any).raw === 'string'
            && typeof (c as any).savedAt === 'number'
            && typeof (c as any).reason === 'string'
        )
        corruptedProfiles.splice(0, corruptedProfiles.length, ...valid)
      }
      // 舊版單一 raw string 格式不 migrate（不是 JSON array），忽略
    } catch { /* parse 失敗忽略（譬如舊單 string 格式） */ }
  }

  // profiles — 先試 strict 驗證，失敗就跑一次 legacy migration。兩者都失敗才備份 + 用 default。
  let loaded = false
  if (savedProfiles) {
    try {
      const raw: unknown = JSON.parse(savedProfiles)
      const data = isValidProfilesData(raw) ? raw : migrateProfilesData(raw)
      if (!data) throw new Error('schema mismatch')
      profiles.splice(0, profiles.length, ...data.profiles)
      deletedProfiles.splice(0, deletedProfiles.length, ...(data.deleted ?? []))
      activeProfileIdx.value = Math.min(Math.max(data.active, 0), profiles.length - 1)
      loaded = true
    } catch (err) {
      backupCorrupted(savedProfiles, (err as Error).message)
    }
  }
  if (!loaded) {
    profiles.splice(0, profiles.length, { name: t('default.profileName'), lines: getDefaultLines(), isDefault: true })
    activeProfileIdx.value = 0
  }

  lines.splice(0, lines.length, ...profiles[activeProfileIdx.value].lines)

  // settings
  const parsed = savedSettings ? JSON.parse(savedSettings) as Partial<Settings & { locale?: Locale | '' }> : {}
  loadAllSettings(parsed)
  // tagStylePreset 需要對「不認得的 preset id」做 fallback（其他 setting 走 strict additive）
  if (!PRESETS_BY_ID.has(tagStylePreset.value)) tagStylePreset.value = 'flat'
  setLocale(parsed.locale ? parsed.locale as Locale : detectLocale())
}

// --- profile switching ---

let localeChanging = false

function syncLinesToActiveProfile() {
  const p = profiles[activeProfileIdx.value]
  p.lines = JSON.parse(JSON.stringify(lines))
  if (p.isDefault && !localeChanging) p.isDefault = false
}

export function switchProfile(idx: number): void {
  if (idx < 0 || idx >= profiles.length || idx === activeProfileIdx.value) return
  syncLinesToActiveProfile()
  activeProfileIdx.value = idx
  lines.splice(0, lines.length, ...profiles[idx].lines)
}

export function renameProfile(idx: number, name: string): void {
  profiles[idx].name = name
  saveProfiles()
}

export function createProfile(name: string): void {
  syncLinesToActiveProfile()
  const lineCount = lines.length
  const emptyLines = (): Line[] => Array.from({ length: lineCount }, () => ({ kind: 'buttons', buttons: [] }))
  profiles.push({ name, lines: emptyLines() })
  activeProfileIdx.value = profiles.length - 1
  lines.splice(0, lines.length, ...emptyLines())
}

export function deleteProfile(idx: number): void {
  if (profiles.length <= 1) return
  syncLinesToActiveProfile()
  const [removed] = profiles.splice(idx, 1)
  deletedProfiles.push(removed)
  const active = activeProfileIdx.value
  const newIdx = idx < active ? active - 1 : Math.min(idx, profiles.length - 1)
  activeProfileIdx.value = newIdx
  lines.splice(0, lines.length, ...profiles[newIdx].lines)
}

export function restoreProfile(idx: number): void {
  const [restored] = deletedProfiles.splice(idx, 1)
  profiles.push(restored)
}

export function purgeProfile(idx: number): void {
  deletedProfiles.splice(idx, 1)
}

export function purgeCorrupted(idx: number): void {
  corruptedProfiles.splice(idx, 1)
}

export function reorderProfiles(fromIdx: number, toIdx: number): void {
  if (fromIdx === toIdx) return
  syncLinesToActiveProfile()
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

export function updateProfileLines(idx: number, newLines: Line[]): void {
  profiles[idx].lines = newLines
  if (profiles[idx].isDefault) profiles[idx].isDefault = false
  if (idx === activeProfileIdx.value) {
    lines.splice(0, lines.length, ...newLines)
    // watcher on `lines` will call saveProfiles()
  } else {
    saveProfiles()
  }
}

// --- auto-save on change ---

function saveProfiles() {
  syncLinesToActiveProfile()
  cacheSet(KEYS.profiles, JSON.stringify({
    active: activeProfileIdx.value,
    profiles: profiles.map(p => ({ name: p.name, lines: p.lines, ...(p.isDefault ? { isDefault: true } : {}) })),
    deleted: deletedProfiles.map(p => ({ name: p.name, lines: p.lines })),
  }))
}

function saveSettings() {
  cacheSet(KEYS.settings, JSON.stringify(serializeAllSettings()))
}

function saveCorrupted() {
  cacheSet(KEYS.corrupted, JSON.stringify(corruptedProfiles))
}

export function startAutoSave(): void {
  watch([lines, deletedProfiles], saveProfiles)
  watch(corruptedProfiles, saveCorrupted, { deep: true })
  // locale 是從 useI18n import 的獨立 ref，不在 refs 物件裡——明確加進 watch list
  watch([...Object.values(refs), locale], saveSettings, { deep: true })

  // When locale changes, update default profiles' labels
  watch(locale, async () => {
    localeChanging = true
    for (const p of profiles) {
      if (!p.isDefault) continue
      p.name = t('default.profileName')
      p.lines = getDefaultLines()
      if (activeProfileIdx.value === profiles.indexOf(p)) {
        lines.splice(0, lines.length, ...p.lines)
      }
    }
    await nextTick()
    localeChanging = false
  })
}
