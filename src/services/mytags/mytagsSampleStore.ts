import { ref } from 'vue'
import { cacheDelete, cacheGet, cacheKeys, cacheSet } from '@/services/gmStorage'
import { createItemStore } from '@/services/mytags/mytagsItemStore'
import {
  type SampleGallery,
  type SampleStore,
  type Verdict,
} from '@/services/mytags/mytagsSamples'

const GALLERY_PREFIX = 'eqt_mytags_gallery'
const VERDICT_PREFIX = 'eqt_mytags_verdict'
const GALLERIES_LEGACY_KEY = 'eqt_mytags_galleries'
const VERDICTS_LEGACY_KEY = 'eqt_mytags_verdicts'
/** 目前這一代樣本的代號。清空就換一個新的，沒有這個 key 代表還在第一代 */
const GENERATION_KEY = 'eqt_mytags_samples_generation'
const FIRST_GENERATION = '0'
const LEGACY_SCHEMA = 1

export const sampleClearVersion = ref(0)

async function galleryPrefix(): Promise<string> {
  return `${GALLERY_PREFIX}~${await cacheGet(GENERATION_KEY) ?? FIRST_GENERATION}`
}

function parseGallery(value: unknown): SampleGallery | null {
  const gallery = value as SampleGallery | null
  if (!gallery || !Array.isArray(gallery.tags) || typeof gallery.thumb !== 'string') return null
  return gallery
}

/**
 * 清掉所有樣本，留下人工判斷。
 *
 * 換一個沒人用過的代號，而不是刪掉現有的 key：別的分頁手上還沒寫完的樣本會落在舊
 * 代號底下，沒有人會再讀到。掃描該刪哪些 key 跟對方真正寫下去之間沒有交易可言，
 * 晚一步落地的那筆就復活了。
 */
export async function clearSamples(): Promise<void> {
  sampleClearVersion.value += 1
  const generation = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  const stale = await cacheKeys(`${GALLERY_PREFIX}~`)
  await cacheSet(GENERATION_KEY, generation)
  await cacheDelete(GALLERIES_LEGACY_KEY)
  await Promise.all(stale.map(cacheDelete))
}

export interface SampleStoreHandle {
  load: () => Promise<SampleStore>
  saveGalleries: (next: Record<string, SampleGallery>) => Promise<void>
  saveVerdicts: (next: Record<string, Verdict>) => Promise<void>
}

/** 一個面板 session 用一個：存檔只寫這個 instance 改過的那幾筆 */
export function createSampleStore(): SampleStoreHandle {
  const galleries = createItemStore<SampleGallery>({
    prefix: galleryPrefix,
    legacyKey: GALLERIES_LEGACY_KEY,
    legacyField: 'galleries',
    legacySchema: LEGACY_SCHEMA,
    legacyPrefix: `${GALLERY_PREFIX}~${FIRST_GENERATION}`,
    parse: parseGallery,
  })

  const verdicts = createItemStore<Verdict>({
    prefix: VERDICT_PREFIX,
    legacyKey: VERDICTS_LEGACY_KEY,
    legacyField: 'verdicts',
    legacySchema: LEGACY_SCHEMA,
    parse: (value) => (value === 'block' || value === 'keep' ? value : null),
  })

  return {
    async load(): Promise<SampleStore> {
      const [loadedGalleries, loadedVerdicts] = await Promise.all([
        galleries.load(),
        verdicts.load(),
      ])
      return { galleries: loadedGalleries, verdicts: loadedVerdicts }
    },
    saveGalleries: galleries.save,
    saveVerdicts: verdicts.save,
  }
}
