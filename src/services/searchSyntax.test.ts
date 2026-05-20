import { describe, it, expect } from 'vitest'
import {
  parseToken,
  serializeToken,
  parseQuery,
  serializeQuery,
  type SearchToken,
} from './searchSyntax'

// ============================================================
// parseToken — bare words
// ============================================================

describe('parseToken (bare word)', () => {
  it('plain word', () => {
    const t = parseToken('lolicon')
    expect(t.prefix).toBeNull()
    expect(t.qualifier).toBeNull()
    expect(t.namespace).toBeNull()
    expect(t.tag).toBe('lolicon')
    expect(t.quoted).toBe(false)
    expect(t.suffix).toBeNull()
  })

  it('with $ suffix', () => {
    const t = parseToken('lolicon$')
    expect(t.tag).toBe('lolicon')
    expect(t.suffix).toBe('$')
  })

  it('with * wildcard', () => {
    const t = parseToken('loli*')
    expect(t.tag).toBe('loli')
    expect(t.suffix).toBe('*')
  })

  it('with % wildcard', () => {
    const t = parseToken('loli%')
    expect(t.tag).toBe('loli')
    expect(t.suffix).toBe('%')
  })
})

// ============================================================
// parseToken — with namespace
// ============================================================

describe('parseToken (namespace)', () => {
  it('full namespace, quoted tag, exact', () => {
    const t = parseToken('female:"big breasts"$')
    expect(t.namespace).toBe('female')
    expect(t.namespaceRaw).toBe('female')
    expect(t.tag).toBe('big breasts')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
    expect(t.qualifier).toBeNull()
  })

  it('short alias resolved', () => {
    const t = parseToken('f:"big breasts"$')
    expect(t.namespace).toBe('female')
    expect(t.namespaceRaw).toBe('f')
    expect(t.tag).toBe('big breasts')
    expect(t.suffix).toBe('$')
  })

  it('unquoted tag with namespace', () => {
    const t = parseToken('l:chinese$')
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
      const t = parseToken(`${alias}test$`)
      expect(t.namespace).toBe(expected)
    }
  })

  it('full namespace names work directly', () => {
    for (const ns of ['female', 'male', 'artist', 'character', 'parody', 'language', 'other', 'mixed', 'reclass', 'cosplayer', 'group', 'location', 'temp']) {
      const t = parseToken(`${ns}:test$`)
      expect(t.namespace).toBe(ns)
      expect(t.namespaceRaw).toBe(ns)
    }
  })

  it('namespace without suffix', () => {
    const t = parseToken('female:lolicon')
    expect(t.namespace).toBe('female')
    expect(t.tag).toBe('lolicon')
    expect(t.suffix).toBeNull()
  })
})

// ============================================================
// parseToken — with qualifier
// ============================================================

describe('parseToken (qualifier)', () => {
  it('tag: qualifier', () => {
    const t = parseToken('tag:rimjob$')
    expect(t.qualifier).toBe('tag')
    expect(t.namespace).toBeNull()
    expect(t.tag).toBe('rimjob')
    expect(t.suffix).toBe('$')
  })

  it('title: qualifier with quoted', () => {
    const t = parseToken('title:"comic aun"')
    expect(t.qualifier).toBe('title')
    expect(t.tag).toBe('comic aun')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBeNull()
  })

  it('uploader: qualifier', () => {
    const t = parseToken('uploader:bob')
    expect(t.qualifier).toBe('uploader')
    expect(t.tag).toBe('bob')
  })

  it('weak: qualifier', () => {
    const t = parseToken('weak:rimjob$')
    expect(t.qualifier).toBe('weak')
    expect(t.tag).toBe('rimjob')
    expect(t.suffix).toBe('$')
  })

  it('all qualifiers recognized', () => {
    for (const q of ['tag', 'weak', 'title', 'uploader', 'uploaduid', 'gid', 'comment', 'favnote']) {
      const t = parseToken(`${q}:test`)
      expect(t.qualifier).toBe(q)
      expect(t.namespace).toBeNull()
    }
  })
})

// ============================================================
// parseToken — with prefix
// ============================================================

describe('parseToken (prefix)', () => {
  it('exclude prefix -', () => {
    const t = parseToken('-female:"big breasts"$')
    expect(t.prefix).toBe('-')
    expect(t.namespace).toBe('female')
    expect(t.tag).toBe('big breasts')
    expect(t.suffix).toBe('$')
  })

  it('or prefix ~', () => {
    const t = parseToken('~l:chinese$')
    expect(t.prefix).toBe('~')
    expect(t.namespace).toBe('language')
    expect(t.tag).toBe('chinese')
  })

  it('prefix with bare word, no namespace', () => {
    const t = parseToken('-lolicon$')
    expect(t.prefix).toBe('-')
    expect(t.namespace).toBeNull()
    expect(t.tag).toBe('lolicon')
    expect(t.suffix).toBe('$')
  })

  it('prefix with qualifier', () => {
    const t = parseToken('-title:2007')
    expect(t.prefix).toBe('-')
    expect(t.qualifier).toBe('title')
    expect(t.tag).toBe('2007')
  })
})

// ============================================================
// parseToken — complex real-world examples
// ============================================================

describe('parseToken (real-world)', () => {
  it('-other:"ai generated"$', () => {
    const t = parseToken('-other:"ai generated"$')
    expect(t.prefix).toBe('-')
    expect(t.namespace).toBe('other')
    expect(t.tag).toBe('ai generated')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
  })

  it('language:"translated"$', () => {
    const t = parseToken('language:"translated"$')
    expect(t.namespace).toBe('language')
    expect(t.tag).toBe('translated')
    expect(t.suffix).toBe('$')
  })

  it('other:"full color"$', () => {
    const t = parseToken('other:"full color"$')
    expect(t.namespace).toBe('other')
    expect(t.tag).toBe('full color')
    expect(t.quoted).toBe(true)
    expect(t.suffix).toBe('$')
  })

  it('~language:"chinese"$', () => {
    const t = parseToken('~language:"chinese"$')
    expect(t.prefix).toBe('~')
    expect(t.namespace).toBe('language')
    expect(t.tag).toBe('chinese')
    expect(t.suffix).toBe('$')
  })
})

// ============================================================
// parseToken — error recovery
// ============================================================

describe('parseToken (error recovery)', () => {
  it('empty string → parseError', () => {
    const t = parseToken('')
    expect(t.parseError).toBeDefined()
    expect(t.raw).toBe('')
  })

  it('unknown colon prefix treated as bare word', () => {
    const t = parseToken('unknown:value$')
    // 'unknown' is not a known ns or qualifier
    expect(t.namespace).toBeNull()
    expect(t.qualifier).toBeNull()
    // the whole 'unknown:value$' is treated as a bare word
    expect(t.tag).toBe('unknown:value')
    expect(t.suffix).toBe('$')
  })

  it('preserves raw for round-trip', () => {
    const raw = 'some-weird-input'
    const t = parseToken(raw)
    expect(t.raw).toBe(raw)
  })
})

// ============================================================
// serializeToken
// ============================================================

describe('serializeToken', () => {
  it('bare word', () => {
    expect(serializeToken({
      prefix: null, qualifier: null, namespace: null, namespaceRaw: null,
      tag: 'lolicon', quoted: false, suffix: null, raw: '',
    })).toBe('lolicon')
  })

  it('full form with namespace', () => {
    expect(serializeToken({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: 'female',
      tag: 'big breasts', quoted: true, suffix: '$', raw: '',
    })).toBe('female:"big breasts"$')
  })

  it('namespaceRaw preserved when set', () => {
    expect(serializeToken({
      prefix: '-', qualifier: null, namespace: 'language', namespaceRaw: 'l',
      tag: 'chinese', quoted: false, suffix: '$', raw: '',
    })).toBe('-l:chinese$')
  })

  it('nsFormat: short fallback when namespaceRaw is null', () => {
    expect(serializeToken({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: null,
      tag: 'big breasts', quoted: true, suffix: '$', raw: '',
    }, { nsFormat: 'short' })).toBe('f:"big breasts"$')
  })

  it('nsFormat: long fallback when namespaceRaw is null', () => {
    expect(serializeToken({
      prefix: null, qualifier: null, namespace: 'language', namespaceRaw: null,
      tag: 'chinese', quoted: false, suffix: '$', raw: '',
    })).toBe('language:chinese$')
  })

  it('with qualifier', () => {
    expect(serializeToken({
      prefix: null, qualifier: 'title', namespace: null, namespaceRaw: null,
      tag: 'comic aun', quoted: true, suffix: null, raw: '',
    })).toBe('title:"comic aun"')
  })

  it('with prefix (namespaceRaw preserved)', () => {
    expect(serializeToken({
      prefix: '~', qualifier: null, namespace: 'male', namespaceRaw: 'm',
      tag: 'yaoi', quoted: false, suffix: '$', raw: '',
    })).toBe('~m:yaoi$')
  })

  it('auto-quotes tag with spaces', () => {
    expect(serializeToken({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: 'female',
      tag: 'big breasts', quoted: false, suffix: '$', raw: '',
    })).toBe('female:"big breasts"$')
  })

  it('wildcard suffix', () => {
    expect(serializeToken({
      prefix: null, qualifier: null, namespace: 'female', namespaceRaw: 'female',
      tag: 'big', quoted: false, suffix: '*', raw: '',
    })).toBe('female:big*')
  })

  it('error token emits raw', () => {
    const raw = 'broken::stuff'
    expect(serializeToken({
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
    'female:"big breasts"$',
    'f:"big breasts"$',
    '-other:"ai generated"$',
    '~language:"chinese"$',
    'tag:rimjob$',
    'title:"comic aun"',
    '-title:2007',
    'uploader:bob',
    'loli*',
    'other:"full color"$',
    '-female:"big breasts"$',
    'language:"translated"$',
  ]

  for (const raw of cases) {
    it(`round-trips: ${raw}`, () => {
      const parsed = parseToken(raw)
      // serialize with the original namespace format
      const nsFormat = parsed.namespaceRaw && parsed.namespace
        ? (parsed.namespaceRaw === parsed.namespace ? 'long' : 'short')
        : 'long'
      const serialized = serializeToken(parsed, { nsFormat })
      expect(serialized).toBe(raw)

      // re-parse and compare structure
      const reparsed = parseToken(serialized)
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
    const tokens = parseQuery('f:"big breasts"$ -m:yaoi$')
    const result = serializeQuery(tokens)
    expect(result).toBe('f:"big breasts"$ -m:yaoi$')
  })

  it('nsFormat fallback when namespaceRaw is null', () => {
    const tokens = parseQuery('female:"big breasts"$ -male:yaoi$')
    // clear namespaceRaw to test fallback
    for (const t of tokens) t.namespaceRaw = null
    const result = serializeQuery(tokens, { nsFormat: 'short' })
    expect(result).toBe('f:"big breasts"$ -m:yaoi$')
  })

  it('empty array → empty string', () => {
    expect(serializeQuery([])).toBe('')
  })
})
