import { GM } from '$'
import { reactive, ref, watch } from 'vue'
import type { QuickTag } from '@/types'
import { DEFAULT_NS_ORDER } from '@/services/tagDb'

const KEYS = {
  tags: 'eqt_tags',
  settings: 'eqt_settings',
}

interface PersistedSettings {
  useNhWeight: boolean
  nsOrder: string[]
  disabledNs: string[]
}

const DEFAULT_TAG_LINES: QuickTag[][] = [
  [
    { tag: 'language:"chinese"$', label: 'Chinese' },
    { tag: 'language:"japanese"$', label: 'Japanese' },
    { tag: 'language:"english"$', label: 'English' },
  ],
]

const DEFAULT_SETTINGS: PersistedSettings = {
  useNhWeight: true,
  nsOrder: DEFAULT_NS_ORDER,
  disabledNs: [],
}

// --- reactive state ---

export const tagLines = reactive<QuickTag[][]>([])
export const useNhWeight = ref(true)
export const nsOrder = ref<string[]>([...DEFAULT_NS_ORDER])
export const disabledNs = ref(new Set<string>())

// --- load from GM ---

export async function loadStore(): Promise<void> {
  const [savedTags, savedSettings] = await Promise.all([
    GM.getValue<string>(KEYS.tags, ''),
    GM.getValue<string>(KEYS.settings, ''),
  ])

  // tags — migrate from flat QuickTag[] to QuickTag[][]
  if (savedTags) {
    const parsed = JSON.parse(savedTags)
    const isNewFormat = parsed.length === 0 || Array.isArray(parsed[0])
    const lines: QuickTag[][] = isNewFormat ? parsed : [parsed]
    tagLines.splice(0, tagLines.length, ...lines)
  } else {
    tagLines.splice(0, tagLines.length, ...DEFAULT_TAG_LINES)
  }

  // settings
  const s: PersistedSettings = savedSettings
    ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }
    : DEFAULT_SETTINGS
  useNhWeight.value = s.useNhWeight
  nsOrder.value = s.nsOrder
  disabledNs.value = new Set(s.disabledNs)
}

// --- auto-save on change ---

function saveTags() {
  GM.setValue(KEYS.tags, JSON.stringify(tagLines))
}

function saveSettings() {
  const data: PersistedSettings = {
    useNhWeight: useNhWeight.value,
    nsOrder: nsOrder.value,
    disabledNs: [...disabledNs.value],
  }
  GM.setValue(KEYS.settings, JSON.stringify(data))
}

export function startAutoSave(): void {
  watch(tagLines, saveTags)
  watch([useNhWeight, nsOrder, disabledNs], saveSettings, { deep: true })
}
