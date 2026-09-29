import createDOMPurify from 'dompurify'

const purifier = createDOMPurify(window)
const styleParser = document.implementation.createHTMLDocument('').createElement('span').style
const allowedStyles = new Set([
  'color',
  'border-top-width', 'border-top-style', 'border-top-color',
  'border-right-width', 'border-right-style', 'border-right-color',
  'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
  'border-left-width', 'border-left-style', 'border-left-color',
])

function sanitizeStyle(value: string): string {
  styleParser.cssText = value
  const declarations: string[] = []
  for (let i = 0; i < styleParser.length; i++) {
    const property = styleParser.item(i)
    if (!allowedStyles.has(property)) continue
    const value = styleParser.getPropertyValue(property)
    if (/[\\]|(?:url|var|env|attr|expression)\s*\(/i.test(value)) continue
    declarations.push(`${property}: ${value}`)
  }
  return declarations.join('; ')
}

export function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value, document.baseURI)
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null
  } catch {
    return null
  }
}

purifier.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style') {
    data.attrValue = sanitizeStyle(data.attrValue)
    data.keepAttr = !!data.attrValue
  } else if (data.attrName === 'src') {
    data.keepAttr = sanitizeImageUrl(data.attrValue) !== null
  } else if (data.attrName === 'srcset') {
    data.keepAttr = data.attrValue.split(',').every((candidate) => {
      const url = candidate.trim().split(/\s+/, 1)[0]
      return sanitizeImageUrl(url) !== null
    })
  }
})

export function sanitizeIntroHtml(html: string): string {
  if (!purifier.isSupported) return ''
  return purifier.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'template'],
    FORBID_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_NAMED_PROPS: true,
  })
}
