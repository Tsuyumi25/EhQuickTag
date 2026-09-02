import {
  EH_CATEGORIES,
  MIN_RATINGS,
  emptyAdvancedOptions,
  type EhAdvancedOptions,
  type EhSearchParams,
  type MinRating,
} from '@/services/ehSearchParams'

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name)
  if (el instanceof HTMLInputElement) return el.type === 'checkbox' ? (el.checked ? 'on' : '') : el.value
  if (el instanceof HTMLSelectElement) return el.value
  return ''
}

function readCategories(): Set<number> {
  const selected = new Set<number>()
  let anyFound = false
  for (const c of EH_CATEGORIES) {
    const el = document.getElementById(`cat_${c.bit}`)
    if (!el) continue
    anyFound = true
    if (!el.hasAttribute('data-disabled')) selected.add(c.bit)
  }
  if (!anyFound) for (const c of EH_CATEGORIES) selected.add(c.bit)
  return selected
}

function readAdvanced(form: HTMLFormElement): EhAdvancedOptions | null {
  if (!form.elements.namedItem('advsearch')) return null

  const a = emptyAdvancedOptions()
  a.browseExpunged = fieldValue(form, 'f_sh') === 'on'
  a.requireTorrent = fieldValue(form, 'f_sto') === 'on'
  a.pagesFrom = fieldValue(form, 'f_spf')
  a.pagesTo = fieldValue(form, 'f_spt')
  a.disableFilterLanguage = fieldValue(form, 'f_sfl') === 'on'
  a.disableFilterUploader = fieldValue(form, 'f_sfu') === 'on'
  a.disableFilterTags = fieldValue(form, 'f_sft') === 'on'

  const rating = fieldValue(form, 'f_srdd')
  if ((MIN_RATINGS as readonly string[]).includes(rating)) a.minRating = rating as MinRating

  return a
}

export function readEhSearchSnapshot(): EhSearchParams | null {
  const input = document.querySelector<HTMLInputElement>('#f_search')
  const form = input?.form
  if (!input || !form) return null

  return {
    keywords: input.value,
    categories: readCategories(),
    advanced: readAdvanced(form),
  }
}
