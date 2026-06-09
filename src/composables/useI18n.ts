import { ref } from 'vue'
import zhTW from '@/locales/zh-TW'
import zhCN from '@/locales/zh-CN'
import en from '@/locales/en'
import ja from '@/locales/ja'

export type Locale = 'zh-TW' | 'zh-CN' | 'en' | 'ja'

const MESSAGES: Record<Locale, Record<string, string>> = {
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  'en': en,
  'ja': ja,
}

const LOCALE_MATCH: Record<string, Locale> = {
  'zh-TW': 'zh-TW', 'zh-Hant': 'zh-TW', 'zh-HK': 'zh-TW',
  'zh-CN': 'zh-CN', 'zh-Hans': 'zh-CN', 'zh-SG': 'zh-CN', 'zh': 'zh-CN',
  'ja': 'ja',
  'en': 'en',
}

export function detectLocale(): Locale {
  for (const lang of navigator.languages) {
    const exact = MESSAGES[lang as Locale] ? (lang as Locale) : undefined
    if (exact) return exact
    const mapped = LOCALE_MATCH[lang]
    if (mapped) return mapped
    const prefix = lang.split('-')[0]
    const prefixMapped = LOCALE_MATCH[prefix]
    if (prefixMapped) return prefixMapped
  }
  return 'en'
}

export const locale = ref<Locale>(detectLocale())

export function setLocale(l: Locale): void {
  locale.value = l
}

export function t(key: string, params?: Record<string, string | number>): string {
  const msg = MESSAGES[locale.value]?.[key] ?? MESSAGES['en']?.[key] ?? key
  if (!params) return msg
  return msg.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
}

export function isCJKLocale(): boolean {
  return locale.value === 'zh-TW' || locale.value === 'zh-CN'
}

export function isTWLocale(): boolean {
  return locale.value === 'zh-TW'
}
