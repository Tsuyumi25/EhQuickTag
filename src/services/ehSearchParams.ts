import { toAbsoluteUrl, isEhUrl, EH_ORIGIN } from '@/utils/ehUrl'

export const EH_CATEGORIES = [
  { bit: 2, key: 'doujinshi', nativeClass: 'ct2' },
  { bit: 4, key: 'manga', nativeClass: 'ct3' },
  { bit: 8, key: 'artistCg', nativeClass: 'ct4' },
  { bit: 16, key: 'gameCg', nativeClass: 'ct5' },
  { bit: 512, key: 'western', nativeClass: 'cta' },
  { bit: 256, key: 'nonH', nativeClass: 'ct9' },
  { bit: 32, key: 'imageSet', nativeClass: 'ct6' },
  { bit: 64, key: 'cosplay', nativeClass: 'ct7' },
  { bit: 128, key: 'asianPorn', nativeClass: 'ct8' },
  { bit: 1, key: 'misc', nativeClass: 'ct1' },
] as const

export type EhCategoryKey = typeof EH_CATEGORIES[number]['key']

export const ALL_CATEGORIES = EH_CATEGORIES.reduce((mask, c) => mask | c.bit, 0)

export function selectedFromFCats(fCats: number): Set<number> {
  const excluded = fCats & ALL_CATEGORIES
  return new Set(EH_CATEGORIES.map(c => c.bit).filter(bit => (excluded & bit) === 0))
}

export function fCatsFromSelected(selected: Iterable<number>): number {
  let mask = 0
  for (const bit of selected) mask |= bit
  return ALL_CATEGORIES & ~mask
}

const PARAM = {
  keywords: 'f_search',
  categories: 'f_cats',
  advanced: 'advsearch',
  browseExpunged: 'f_sh',
  requireTorrent: 'f_sto',
  pagesFrom: 'f_spf',
  pagesTo: 'f_spt',
  minRating: 'f_srdd',
  disableFilterLanguage: 'f_sfl',
  disableFilterUploader: 'f_sfu',
  disableFilterTags: 'f_sft',
} as const

export const MIN_RATINGS = ['0', '2', '3', '4', '5'] as const
export type MinRating = typeof MIN_RATINGS[number]

export interface EhAdvancedOptions {
  browseExpunged: boolean
  requireTorrent: boolean
  pagesFrom: string
  pagesTo: string
  minRating: MinRating
  disableFilterLanguage: boolean
  disableFilterUploader: boolean
  disableFilterTags: boolean
}

export interface EhSearchParams {
  keywords: string
  categories: Set<number>
  advanced: EhAdvancedOptions | null
}

export function emptyAdvancedOptions(): EhAdvancedOptions {
  return {
    browseExpunged: false,
    requireTorrent: false,
    pagesFrom: '',
    pagesTo: '',
    minRating: '0',
    disableFilterLanguage: false,
    disableFilterUploader: false,
    disableFilterTags: false,
  }
}

export function buildSearchUrl(p: EhSearchParams, origin: string = EH_ORIGIN): string {
  const base = toAbsoluteUrl(origin) ?? toAbsoluteUrl(EH_ORIGIN)!
  const url = new URL('/', base.origin)
  const q = url.searchParams

  if (p.keywords.trim()) q.set(PARAM.keywords, p.keywords.trim())

  const fCats = fCatsFromSelected(p.categories)
  if (fCats !== 0) q.set(PARAM.categories, String(fCats))

  const a = p.advanced
  if (a) {
    q.set(PARAM.advanced, '1')
    if (a.browseExpunged) q.set(PARAM.browseExpunged, 'on')
    if (a.requireTorrent) q.set(PARAM.requireTorrent, 'on')
    if (a.pagesFrom.trim()) q.set(PARAM.pagesFrom, a.pagesFrom.trim())
    if (a.pagesTo.trim()) q.set(PARAM.pagesTo, a.pagesTo.trim())
    if (a.minRating !== '0') q.set(PARAM.minRating, a.minRating)
    if (a.disableFilterLanguage) q.set(PARAM.disableFilterLanguage, 'on')
    if (a.disableFilterUploader) q.set(PARAM.disableFilterUploader, 'on')
    if (a.disableFilterTags) q.set(PARAM.disableFilterTags, 'on')
  }

  return url.href
}

export function parseSearchUrl(raw: string): EhSearchParams | null {
  const u = toAbsoluteUrl(raw)
  if (!u || !isEhUrl(u) || u.pathname !== '/') return null

  const q = u.searchParams
  const rawCats = Number(q.get(PARAM.categories))
  const fCats = Number.isFinite(rawCats) ? rawCats : 0

  return {
    keywords: q.get(PARAM.keywords) ?? '',
    categories: selectedFromFCats(fCats),
    advanced: q.get(PARAM.advanced) === '1' ? readAdvanced(q) : null,
  }
}

function readAdvanced(q: URLSearchParams): EhAdvancedOptions {
  const rating = q.get(PARAM.minRating) ?? '0'
  return {
    browseExpunged: q.has(PARAM.browseExpunged),
    requireTorrent: q.has(PARAM.requireTorrent),
    pagesFrom: q.get(PARAM.pagesFrom) ?? '',
    pagesTo: q.get(PARAM.pagesTo) ?? '',
    minRating: (MIN_RATINGS as readonly string[]).includes(rating) ? rating as MinRating : '0',
    disableFilterLanguage: q.has(PARAM.disableFilterLanguage),
    disableFilterUploader: q.has(PARAM.disableFilterUploader),
    disableFilterTags: q.has(PARAM.disableFilterTags),
  }
}
