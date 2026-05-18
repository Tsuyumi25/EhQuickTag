import { GM } from '$'
import { reactive, ref, watch } from 'vue'
import type { QuickTag } from '@/types'
import { DEFAULT_NS_ORDER } from '@/services/tagDb'

const KEYS = {
  profiles: 'eqt_profiles',
  tags: 'eqt_tags',        // legacy, for migration
  settings: 'eqt_settings',
}

export interface Profile {
  name: string
  tagLines: QuickTag[][]
}

interface PersistedSettings {
  useNhWeight: boolean
  nsOrder: string[]
  disabledNs: string[]
  fontFamily: string
  fontWeight: string
}

export const DEFAULT_TAG_LINES: QuickTag[][] = [
  [
    { tag: 'language:"chinese"$', label: '中文' },
    { tag: 'language:"english"$', label: '英語' },
    { tag: 'language:"korean"$', label: '韓語' },
    { tag: '-language:"english"$, -language:"chinese"$, -language:"korean"$', label: '日語', disabledModes: ['or', 'exclude'] },
  ],
  [
    { tag: 'other:"full color"$', label: '全彩' },
    { tag: 'other:"uncensored"$', label: '無修正' },
    { tag: 'language:"translated"$', label: '已翻譯' },
    { tag: 'language:"speechless"$', label: '無對話' },
    { tag: '-other:"ai generated"$', label: '排除AI', disabledModes: ['or', 'exclude'] },
    { tag: '-other:"rough translation"$', label: '排除機翻', disabledModes: ['or', 'exclude'] },
  ],
  [
    { tag: '', url: '?f_cats=0&f_search=other%3A%22how+to%24%22', label: '教學' },
    { tag: '', url: '?f_cats=0&f_search=o%3Aartbook%24', label: '畫集' },
    { tag: '', url: '?f_cats=991', label: '圖集' },
    { tag: '', url: '?f_cats=1019&f_search=o%3Atankoubon%24', label: '單行本' },
    { tag: '', url: '?f_cats=1019&f_search=o%3Aanthology%24', label: '選集' },
  ],
  [],
]

const DEFAULT_SETTINGS: PersistedSettings = {
  useNhWeight: true,
  nsOrder: DEFAULT_NS_ORDER,
  disabledNs: [],
  fontFamily: '',
  fontWeight: '',
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
    if (savedTags) {
      const parsed = JSON.parse(savedTags)
      lines = (parsed.length === 0 || Array.isArray(parsed[0])) ? parsed : [parsed]
    } else {
      lines = DEFAULT_TAG_LINES
    }
    profiles.splice(0, profiles.length, { name: '預設標籤組', tagLines: lines })
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
}

// --- profile switching ---

function syncTagLinesToActiveProfile() {
  profiles[activeProfileIdx.value].tagLines = JSON.parse(JSON.stringify(tagLines))
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
    profiles: profiles.map(p => ({ name: p.name, tagLines: p.tagLines })),
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
  }
  GM.setValue(KEYS.settings, JSON.stringify(data))
}

export function startAutoSave(): void {
  watch([tagLines, deletedProfiles], saveProfiles)
  watch([useNhWeight, nsOrder, disabledNs, fontFamily, fontWeight], saveSettings, { deep: true })
}
