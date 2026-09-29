import { ref } from 'vue'
import { cacheGet, cacheSet } from '@/services/gmStorage'
import {
  type SampleGallery,
  type SampleStore,
  type Verdict,
} from '@/services/mytags/mytagsSamples'

const GALLERIES_KEY = 'eqt_mytags_galleries'
const VERDICTS_KEY = 'eqt_mytags_verdicts'
const GALLERIES_SCHEMA = 1
const VERDICTS_SCHEMA = 1
export const sampleClearVersion = ref(0)
let galleriesWrite: Promise<void> = Promise.resolve()

export async function clearSamples(): Promise<void> {
  sampleClearVersion.value += 1
  await saveGalleries({})
}

function parseGalleries(raw: string | null): Record<string, SampleGallery> {
  if (!raw) return {}
  try {
    const saved = JSON.parse(raw) as {
      schema?: number
      galleries?: Record<string, SampleGallery>
    }
    if (saved.schema !== GALLERIES_SCHEMA) return {}
    const galleries: Record<string, SampleGallery> = {}
    for (const [key, value] of Object.entries(saved.galleries ?? {})) {
      if (value && Array.isArray(value.tags) && typeof value.thumb === 'string') {
        galleries[key] = value
      }
    }
    return galleries
  } catch {
    return {}
  }
}

function parseVerdicts(raw: string | null): Record<string, Verdict> {
  if (!raw) return {}
  try {
    const saved = JSON.parse(raw) as {
      schema?: number
      verdicts?: Record<string, Verdict>
    }
    if (saved.schema !== VERDICTS_SCHEMA) return {}
    const verdicts: Record<string, Verdict> = {}
    for (const [key, value] of Object.entries(saved.verdicts ?? {})) {
      if (value === 'block' || value === 'keep') verdicts[key] = value
    }
    return verdicts
  } catch {
    return {}
  }
}

export async function loadSamples(): Promise<SampleStore> {
  const [galleriesRaw, verdictsRaw] = await Promise.all([
    cacheGet(GALLERIES_KEY),
    cacheGet(VERDICTS_KEY),
  ])
  return {
    galleries: parseGalleries(galleriesRaw),
    verdicts: parseVerdicts(verdictsRaw),
  }
}

export async function saveGalleries(galleries: Record<string, SampleGallery>): Promise<void> {
  const value = JSON.stringify({ schema: GALLERIES_SCHEMA, galleries })
  galleriesWrite = galleriesWrite.catch(() => {}).then(() => cacheSet(GALLERIES_KEY, value))
  await galleriesWrite
}

export async function saveVerdicts(verdicts: Record<string, Verdict>): Promise<void> {
  await cacheSet(VERDICTS_KEY, JSON.stringify({ schema: VERDICTS_SCHEMA, verdicts }))
}
