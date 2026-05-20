import { GM } from '$'
import { reactive, ref, watch, nextTick } from 'vue'
import type { QuickTag } from '@/types'
import { DEFAULT_NS_ORDER } from '@/services/tagDb'
import { locale, setLocale, detectLocale, t, type Locale } from '@/composables/useI18n'

const KEYS = {
  profiles: 'eqt_profiles',
  tags: 'eqt_tags',        // legacy, for migration
  settings: 'eqt_settings',
}

export interface Profile {
  name: string
  tagLines: QuickTag[][]
  isDefault?: boolean
}

export type DblClickAction = 'search' | 'searchNewTab' | 'clearSearch'

interface PersistedSettings {
  useNhWeight: boolean
  nsOrder: string[]
  disabledNs: string[]
  fontFamily: string
  fontWeight: string
  dblClickLeft: DblClickAction
  dblClickRight: DblClickAction
  newTabActive: boolean
  locale: Locale | ''
  nsFormat: 'long' | 'short'
  defaultExactMatch: boolean
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

export function getDefaultTagLines(): QuickTag[][] {
  return DEFAULT_TAG_DEFS.map(line =>
    line.map(({ tag, url, labelKey, disabledModes }) => ({
      tag,
      ...(url ? { url } : {}),
      label: t(labelKey),
      ...(disabledModes ? { disabledModes } : {}),
    })),
  )
}


const DEFAULT_SETTINGS: PersistedSettings = {
  useNhWeight: true,
  nsOrder: DEFAULT_NS_ORDER,
  disabledNs: [],
  fontFamily: '',
  fontWeight: '',
  dblClickLeft: 'search',
  dblClickRight: 'searchNewTab',
  newTabActive: true,
  locale: '',
  nsFormat: 'long',
  defaultExactMatch: true,
}

// --- reactive state ---

export const profiles = reactive<Profile[]>([])
export const deletedProfiles = reactive<Profile[]>([])
export const activeProfileIdx = ref(0)
export const tagLines = reactive<QuickTag[][]>([])
export const useNhWeight = ref(true)
export const nsOrder = ref<string[]>([...DEFAULT_NS_ORDER])
export const disabledNs = ref(new Set<string>())
export const fontFamily = ref('')
export const fontWeight = ref('')
export const dblClickLeft = ref<DblClickAction>('search')
export const dblClickRight = ref<DblClickAction>('searchNewTab')
export const newTabActive = ref(true)
export const nsFormat = ref<'long' | 'short'>('long')
export const defaultExactMatch = ref(true)

// --- load from GM ---

export async function loadStore(): Promise<void> {
  const [savedProfiles, savedTags, savedSettings] = await Promise.all([
    GM.getValue<string>(KEYS.profiles, ''),
    GM.getValue<string>(KEYS.tags, ''),
    GM.getValue<string>(KEYS.settings, ''),
  ])

  // profiles — migrate from legacy eqt_tags if needed
  if (savedProfiles) {
    const data = JSON.parse(savedProfiles) as { active: number; profiles: Profile[]; deleted?: Profile[] }
    profiles.splice(0, profiles.length, ...data.profiles)
    deletedProfiles.splice(0, deletedProfiles.length, ...(data.deleted ?? []))
    activeProfileIdx.value = Math.min(Math.max(data.active, 0), profiles.length - 1)
  } else {
    let lines: QuickTag[][]
    let isDefault = false
    if (savedTags) {
      const parsed = JSON.parse(savedTags)
      lines = (parsed.length === 0 || Array.isArray(parsed[0])) ? parsed : [parsed]
    } else {
      lines = getDefaultTagLines()
      isDefault = true
    }
    profiles.splice(0, profiles.length, { name: t('default.profileName'), tagLines: lines, isDefault })
    activeProfileIdx.value = 0
  }

  tagLines.splice(0, tagLines.length, ...profiles[activeProfileIdx.value].tagLines)

  // settings
  const s: PersistedSettings = savedSettings
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }
    : DEFAULT_SETTINGS
  useNhWeight.value = s.useNhWeight
  nsOrder.value = s.nsOrder
  disabledNs.value = new Set(s.disabledNs)
  fontFamily.value = s.fontFamily
  fontWeight.value = s.fontWeight
  dblClickLeft.value = s.dblClickLeft
  dblClickRight.value = s.dblClickRight
  newTabActive.value = s.newTabActive
  nsFormat.value = s.nsFormat
  defaultExactMatch.value = s.defaultExactMatch
  setLocale(s.locale ? s.locale as Locale : detectLocale())
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
  profiles.push({ name, tagLines: Array.from({ length: lineCount }, () => []) })
  activeProfileIdx.value = profiles.length - 1
  tagLines.splice(0, tagLines.length, ...Array.from({ length: lineCount }, () => []))
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

export function updateProfileTagLines(idx: number, newTagLines: QuickTag[][]): void {
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
  const data: PersistedSettings = {
    useNhWeight: useNhWeight.value,
    nsOrder: nsOrder.value,
    disabledNs: [...disabledNs.value],
    fontFamily: fontFamily.value,
    fontWeight: fontWeight.value,
    dblClickLeft: dblClickLeft.value,
    dblClickRight: dblClickRight.value,
    newTabActive: newTabActive.value,
    locale: locale.value,
    nsFormat: nsFormat.value,
    defaultExactMatch: defaultExactMatch.value,
  }
  GM.setValue(KEYS.settings, JSON.stringify(data))
}

export function startAutoSave(): void {
  watch([tagLines, deletedProfiles], saveProfiles)
  watch([useNhWeight, nsOrder, disabledNs, fontFamily, fontWeight, dblClickLeft, dblClickRight, newTabActive, locale, nsFormat, defaultExactMatch], saveSettings, { deep: true })

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
