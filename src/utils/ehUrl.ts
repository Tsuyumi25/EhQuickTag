export const EH_DOMAINS = ['e-hentai.org', 'exhentai.org']

export const EH_ORIGIN = 'https://e-hentai.org'

export function isEhUrl(u: URL): boolean {
  return EH_DOMAINS.includes(u.hostname)
}

export function toAbsoluteUrl(raw: string): URL | null {
  try {
    return new URL(raw, EH_ORIGIN)
  } catch {
    return null
  }
}

export function resolveButtonUrl(raw: string, follow: boolean, currentOrigin: string): string {
  const u = toAbsoluteUrl(raw)
  if (!u) return raw
  if (follow && isEhUrl(u)) {
    const origin = toAbsoluteUrl(currentOrigin)
    if (origin && isEhUrl(origin)) {
      u.protocol = origin.protocol
      u.host = origin.host
    }
  }
  return u.href
}
