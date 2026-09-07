export function parseColorInput(raw: string, alpha: boolean): string | null {
  const value = raw.trim()
  const hex = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value)
  if (hex) {
    const h = hex[1].toLowerCase()
    const rgb = h.length <= 4
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      : h.slice(0, 6)
    if (!alpha) return `#${rgb}`

    const a = h.length === 4
      ? h[3] + h[3]
      : h.length === 8 ? h.slice(6) : 'ff'
    return `#${rgb}${a}`
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value)
  if (!rgb) return null

  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  const color = toHex(+rgb[1]) + toHex(+rgb[2]) + toHex(+rgb[3])
  if (!alpha) return `#${color}`

  const opacity = rgb[4] === undefined
    ? 255
    : Math.round(Math.max(0, Math.min(1, +rgb[4])) * 255)
  return `#${color}${toHex(opacity)}`
}

export function formatRgbInput(value: string | undefined, alpha: boolean): string {
  if (!value) return ''
  const normalized = parseColorInput(value, alpha)
  if (!normalized) return ''

  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  if (!alpha) return `rgb(${r}, ${g}, ${b})`

  const opacity = parseInt(normalized.slice(7, 9), 16) / 255
  return opacity === 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${+opacity.toFixed(2)})`
}
