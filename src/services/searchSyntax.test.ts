import { describe, it, expect } from 'vitest'
import {
  parseTerm,
  serializeTerm,
  parseQuery,
  serializeQuery,
  type SearchTerm,
} from './searchSyntax'

// ============================================================
// parseTerm — bare words
// ============================================================

describe('parseTerm (bare word)', () => {
  it('plain word', () => {
    const t = parseTerm('lolicon')
    expect(t.prefix).toBeNull()
    expect(t.qualifier).toBeNull()
    expect(t.namespace).toBeNull()
    expect(t.tag).toBe('lolicon')
    expect(t.quoted).toBe(false)
    expect(t.suffix).toBeNull()
  })

  it('with $ suffix', () => {
    const t = parseTerm('lolicon$')
    expect(t.tag).toBe('lolicon')
    expect(t.suffix).toBe('$')
  })

  it('with * wildcard', () => {
    const t = parseTerm('loli*')
    expect(t.tag).toBe('loli')
    expect(t.suffix).toBe('*')
  })

  it('with % wildcard', () => {
    const t = parseTerm('loli%')
    expect(t.tag).toBe('loli')
    expect(t.suffix).toBe('%')
  })
})

// ============================================================
// parseTerm — with namespace
// ============================================================

describe('parseTerm (namespace)', () => {
  it('full namespace, quoted tag, exact', () => {
    const t = parseTerm('female:"big breasts"$')
    expect(t.namespace).toBe('female')
    expect(t.namespaceRaw).toBe('female')
    expect(t.tag).toBe('big breasts')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
    expect(t.qualifier).toBeNull()
  })

  it('short alias resolved', () => {
    const t = parseTerm('f:"big breasts"$')
    expect(t.namespace).toBe('female')
    expect(t.namespaceRaw).toBe('f')
    expect(t.tag).toBe('big breasts')
    expect(t.suffix).toBe('$')
  })

  it('unquoted tag with namespace', () => {
    const t = parseTerm('l:chinese$')
    expect(t.namespace).toBe('language')
    expect(t.namespaceRaw).toBe('l')
    expect(t.tag).toBe('chinese')
    expect(t.suffix).toBe('$')
    expect(t.quoted).toBe(false)
  })

  it('all namespace aliases resolve correctly', () => {
    const cases: [string, string][] = [
      ['f:', 'female'], ['m:', 'male'], ['a:', 'artist'],
      ['g:', 'group'], ['p:', 'parody'], ['c:', 'character'],
      ['l:', 'language'], ['o:', 'other'], ['x:', 'mixed'],
      ['r:', 'reclass'], ['cos:', 'cosplayer'], ['loc:', 'location'],
      ['char:', 'character'], ['circle:', 'group'],
      ['lang:', 'language'], ['series:', 'parody'],
    ]
    for (const [alias, expected] of cases) {
      const t = parseTerm(`${alias}test$`)
      expect(t.namespace).toBe(expected)
    }
  })

  it('full namespace names work directly', () => {
    for (const ns of ['female', 'male', 'artist', 'character', 'parody', 'language', 'other', 'mixed', 'reclass', 'cosplayer', 'group', 'location', 'temp']) {
      const t = parseTerm(`${ns}:test$`)
      expect(t.namespace).toBe(ns)
      expect(t.namespaceRaw).toBe(ns)
    }
  })

  it('namespace without suffix', () => {
    const t = parseTerm('female:lolicon')
    expect(t.namespace).toBe('female')
    expect(t.tag).toBe('lolicon')
    expect(t.suffix).toBeNull()
  })
})

// ============================================================
// parseTerm — with qualifier
// ============================================================

describe('parseTerm (qualifier)', () => {
  it('tag: qualifier', () => {
    const t = parseTerm('tag:rimjob$')
    expect(t.qualifier).toBe('tag')
    expect(t.namespace).toBeNull()
    expect(t.tag).toBe('rimjob')
    expect(t.suffix).toBe('$')
  })

  it('title: qualifier with quoted', () => {
    const t = parseTerm('title:"comic aun"')
    expect(t.qualifier).toBe('title')
    expect(t.tag).toBe('comic aun')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBeNull()
  })

  it('uploader: qualifier', () => {
    const t = parseTerm('uploader:bob')
    expect(t.qualifier).toBe('uploader')
    expect(t.tag).toBe('bob')
  })

  it('weak: qualifier', () => {
    const t = parseTerm('weak:rimjob$')
    expect(t.qualifier).toBe('weak')
    expect(t.tag).toBe('rimjob')
    expect(t.suffix).toBe('$')
  })

  it('all qualifiers recognized', () => {
    for (const q of ['tag', 'weak', 'title', 'uploader', 'uploaduid', 'gid', 'comment', 'favnote']) {
      const t = parseTerm(`${q}:test`)
      expect(t.qualifier).toBe(q)
      expect(t.namespace).toBeNull()
    }
  })
})

// ============================================================
// parseTerm — with prefix
// ============================================================

describe('parseTerm (prefix)', () => {
  it('exclude prefix -', () => {
    const t = parseTerm('-female:"big breasts"$')
    expect(t.prefix).toBe('-')
    expect(t.namespace).toBe('female')
    expect(t.tag).toBe('big breasts')
    expect(t.suffix).toBe('$')
  })

  it('or prefix ~', () => {
    const t = parseTerm('~l:chinese$')
    expect(t.prefix).toBe('~')
    expect(t.namespace).toBe('language')
    expect(t.tag).toBe('chinese')
  })

  it('prefix with bare word, no namespace', () => {
    const t = parseTerm('-lolicon$')
    expect(t.prefix).toBe('-')
    expect(t.namespace).toBeNull()
    expect(t.tag).toBe('lolicon')
    expect(t.suffix).toBe('$')
  })

  it('prefix with qualifier', () => {
    const t = parseTerm('-title:2007')
    expect(t.prefix).toBe('-')
    expect(t.qualifier).toBe('title')
    expect(t.tag).toBe('2007')
  })
})

// ============================================================
// parseTerm — complex real-world examples
// ============================================================

describe('parseTerm (real-world)', () => {
  it('-other:"ai generated$" (suffix inside quotes)', () => {
    const t = parseTerm('-other:"ai generated$"')
    expect(t.prefix).toBe('-')
    expect(t.namespace).toBe('other')
    expect(t.tag).toBe('ai generated')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
  })

  it('mixed:"ffm threesome$" (official EH format)', () => {
    const t = parseTerm('mixed:"ffm threesome$"')
    expect(t.namespace).toBe('mixed')
    expect(t.tag).toBe('ffm threesome')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
  })

  it('other:"full color$"', () => {
    const t = parseTerm('other:"full color$"')
    expect(t.namespace).toBe('other')
    expect(t.tag).toBe('full color')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
  })

  it('~language:"chinese$"', () => {
    const t = parseTerm('~language:"chinese$"')
    expect(t.prefix).toBe('~')
    expect(t.namespace).toBe('language')
    expect(t.tag).toBe('chinese')
    expect(t.suffix).toBe('$')
  })
})

// ============================================================
// parseTerm — legacy format (suffix outside quotes)
// ============================================================

describe('parseTerm (legacy: suffix outside quotes)', () => {
  it('-other:"ai generated"$ → same parse result', () => {
    const t = parseTerm('-other:"ai generated"$')
    expect(t.tag).toBe('ai generated')
    expect(t.suffix).toBe('$')
  })

  it('other:"full color"$ → same parse result', () => {
    const t = parseTerm('other:"full color"$')
    expect(t.tag).toBe('full color')
    expect(t.suffix).toBe('$')
  })

  it('legacy form serializes to canonical form', () => {
    const legacy = parseTerm('female:"big breasts"$')
    const canonical = parseTerm('female:"big breasts$"')
    expect(serializeTerm(legacy)).toBe(serializeTerm(canonical))
    expect(serializeTerm(legacy)).toBe('female:"big breasts$"')
  })
})

// ============================================================
// parseTerm — error recovery
// ============================================================

describe('parseTerm (error recovery)', () => {
  it('empty string → parseError', () => {
    const t = parseTerm('')
    expect(t.parseError).toBeDefined()
    expect(t.raw).toBe('')
  })

  it('unknown colon prefix treated as bare word', () => {
    const t = parseTerm('unknown:value$')
    // 'unknown' is not a known ns or qualifier
    expect(t.namespace).toBeNull()
    expect(t.qualifier).toBeNull()
    // the whole 'unknown:value$' is treated as a bare word
    expect(t.tag).toBe('unknown:value')
    expect(t.suffix).toBe('$')
  })

  it('preserves raw for round-trip', () => {
    const raw = 'some-weird-input'
    const t = parseTerm(raw)
    expect(t.raw).toBe(raw)
  })
})

// ============================================================
// serializeTerm
// ============================================================

describe('serializeTerm', () => {
  it('bare word', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: null, namespaceRaw: null,
      tag: 'lolicon', quoted: false, suffix: null, raw: '',
    })).toBe('lolicon')
  })

  it('full form with namespace (suffix inside quotes)', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: 'female',
      tag: 'big breasts', quoted: true, suffix: '$', raw: '',
    })).toBe('female:"big breasts$"')
  })

  it('namespaceRaw preserved when set', () => {
    expect(serializeTerm({
      prefix: '-', qualifier: null, namespace: 'language', namespaceRaw: 'l',
      tag: 'chinese', quoted: false, suffix: '$', raw: '',
    })).toBe('-l:chinese$')
  })

  it('nsFormat: short fallback when namespaceRaw is null', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: null,
      tag: 'big breasts', quoted: true, suffix: '$', raw: '',
    }, { nsFormat: 'short' })).toBe('f:"big breasts$"')
  })

  it('nsFormat: long fallback when namespaceRaw is null', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: 'language', namespaceRaw: null,
      tag: 'chinese', quoted: false, suffix: '$', raw: '',
    })).toBe('language:chinese$')
  })

  it('with qualifier', () => {
    expect(serializeTerm({
      prefix: null, qualifier: 'title', namespace: null, namespaceRaw: null,
      tag: 'comic aun', quoted: true, suffix: null, raw: '',
    })).toBe('title:"comic aun"')
  })

  it('with prefix (namespaceRaw preserved)', () => {
    expect(serializeTerm({
      prefix: '~', qualifier: null, namespace: 'male', namespaceRaw: 'm',
      tag: 'yaoi', quoted: false, suffix: '$', raw: '',
    })).toBe('~m:yaoi$')
  })

  it('auto-quotes tag with spaces (suffix inside quotes)', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: 'female',
      tag: 'big breasts', quoted: false, suffix: '$', raw: '',
    })).toBe('female:"big breasts$"')
  })

  it('wildcard suffix', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: 'female',
      tag: 'big', quoted: false, suffix: '*', raw: '',
    })).toBe('female:big*')
  })

  it('quoted flag ignored for single-word tags', () => {
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: 'language', namespaceRaw: 'language',
      tag: 'chinese', quoted: true, suffix: '$', raw: '',
    })).toBe('language:chinese$')
  })

  it('error token emits raw', () => {
    const raw = 'broken::stuff'
    expect(serializeTerm({
      prefix: null, qualifier: null, namespace: null, namespaceRaw: null,
      tag: raw, quoted: false, suffix: null, raw, parseError: 'test',
    })).toBe(raw)
  })
})

// ============================================================
// round-trip: parse → serialize → parse
// ============================================================

describe('round-trip', () => {
  const cases = [
    'lolicon$',
    'female:"big breasts$"',
    'f:"big breasts$"',
    '-other:"ai generated$"',
    '~language:chinese$',
    'tag:rimjob$',
    'title:"comic aun"',
    '-title:2007',
    'uploader:bob',
    'loli*',
    'other:"full color$"',
    '-female:"big breasts$"',
    'language:translated$',
  ]

  for (const raw of cases) {
    it(`round-trips: ${raw}`, () => {
      const parsed = parseTerm(raw)
      // serialize with the original namespace format
      const nsFormat = parsed.namespaceRaw && parsed.namespace
        ? (parsed.namespaceRaw === parsed.namespace ? 'long' : 'short')
        : 'long'
      const serialized = serializeTerm(parsed, { nsFormat })
      expect(serialized).toBe(raw)

      // re-parse and compare structure
      const reparsed = parseTerm(serialized)
      expect(reparsed.prefix).toBe(parsed.prefix)
      expect(reparsed.qualifier).toBe(parsed.qualifier)
      expect(reparsed.namespace).toBe(parsed.namespace)
      expect(reparsed.tag).toBe(parsed.tag)
      expect(reparsed.suffix).toBe(parsed.suffix)
    })
  }
})

// ============================================================
// parseQuery
// ============================================================

describe('parseQuery', () => {
  it('multi-token string', () => {
    const tokens = parseQuery('f:"big breasts"$ -male:yaoi$')
    expect(tokens).toHaveLength(2)
    expect(tokens[0].namespace).toBe('female')
    expect(tokens[0].tag).toBe('big breasts')
    expect(tokens[1].prefix).toBe('-')
    expect(tokens[1].namespace).toBe('male')
    expect(tokens[1].tag).toBe('yaoi')
  })

  it('complex multi-token', () => {
    const tokens = parseQuery('-f:"big breasts"$ ~m:yaoi$ title:"comic aun"')
    expect(tokens).toHaveLength(3)
    expect(tokens[0].prefix).toBe('-')
    expect(tokens[0].namespace).toBe('female')
    expect(tokens[1].prefix).toBe('~')
    expect(tokens[1].namespace).toBe('male')
    expect(tokens[2].qualifier).toBe('title')
    expect(tokens[2].tag).toBe('comic aun')
  })

  it('empty string → empty array', () => {
    expect(parseQuery('')).toEqual([])
  })

  it('whitespace only → empty array', () => {
    expect(parseQuery('   ')).toEqual([])
  })

  it('single token', () => {
    const tokens = parseQuery('lolicon$')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].tag).toBe('lolicon')
    expect(tokens[0].suffix).toBe('$')
  })
})

// ============================================================
// serializeQuery
// ============================================================

describe('serializeQuery', () => {
  it('preserves original namespace format', () => {
    const tokens = parseQuery('f:"big breasts$" -m:yaoi$')
    const result = serializeQuery(tokens)
    expect(result).toBe('f:"big breasts$" -m:yaoi$')
  })

  it('nsFormat fallback when namespaceRaw is null', () => {
    const tokens = parseQuery('female:"big breasts$" -male:yaoi$')
    // clear namespaceRaw to test fallback
    for (const t of tokens) t.namespaceRaw = null
    const result = serializeQuery(tokens, { nsFormat: 'short' })
    expect(result).toBe('f:"big breasts$" -m:yaoi$')
  })

  it('empty array → empty string', () => {
    expect(serializeQuery([])).toBe('')
  })
})
