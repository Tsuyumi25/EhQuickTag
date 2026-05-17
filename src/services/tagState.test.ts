import { describe, it, expect } from 'vitest'
import { TagState } from '@/types'
import {
  tokenize,
  applyState,
  allForms,
  detectState,
  getState,
  removeTag,
  addTag,
  getEffectiveModifiers,
  getNextRightClickState,
} from './tagState'

// ============================================================
// tokenize
// ============================================================

describe('tokenize', () => {
  it('splits simple words', () => {
    expect(tokenize('foo bar')).toEqual(['foo', 'bar'])
  })

  it('keeps quoted strings intact', () => {
    expect(tokenize('female:"big breasts"$')).toEqual(['female:"big breasts"$'])
  })

  it('handles mixed tokens', () => {
    expect(tokenize('l:chinese$ -female:"big breasts"$ ~male:yaoi$')).toEqual([
      'l:chinese$', '-female:"big breasts"$', '~male:yaoi$',
    ])
  })

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([])
  })
})

// ============================================================
// applyState — positive parts
// ============================================================

describe('applyState (positive part)', () => {
  const p = 'other:"full color"$'

  it('Include → as-is', () => {
    expect(applyState(p, TagState.Include)).toBe(p)
  })

  it('Or → ~prefix', () => {
    expect(applyState(p, TagState.Or)).toBe(`~${p}`)
  })

  it('Exclude → -prefix', () => {
    expect(applyState(p, TagState.Exclude)).toBe(`-${p}`)
  })
})

// ============================================================
// applyState — negative parts
// ============================================================

describe('applyState (negative part)', () => {
  const p = '-other:"ai generated"$'

  it('Include → as-is (keeps -)', () => {
    expect(applyState(p, TagState.Include)).toBe(p)
  })

  it('Or → absorbed, same as Include', () => {
    expect(applyState(p, TagState.Or)).toBe(p)
  })

  it('Exclude → strips -, double negative = positive', () => {
    expect(applyState(p, TagState.Exclude)).toBe('other:"ai generated"$')
  })
})

// ============================================================
// applyState — Or-prefixed parts
// ============================================================

describe('applyState (Or-prefixed part)', () => {
  const p = '~language:"chinese"$'

  it('Include → as-is (keeps ~)', () => {
    expect(applyState(p, TagState.Include)).toBe(p)
  })

  it('Or → absorbed, same as Include', () => {
    expect(applyState(p, TagState.Or)).toBe(p)
  })

  it('Exclude → replaces ~ with -, negates underlying', () => {
    expect(applyState(p, TagState.Exclude)).toBe('-language:"chinese"$')
  })
})

// ============================================================
// allForms
// ============================================================

describe('allForms', () => {
  it('positive part → 3 forms', () => {
    expect(allForms('foo$')).toEqual(['foo$', '~foo$', '-foo$'])
  })

  it('negative part → 2 forms (with and without -)', () => {
    expect(allForms('-foo$')).toEqual(['-foo$', 'foo$'])
  })

  it('Or-prefixed part → 2 forms (~form and -form)', () => {
    expect(allForms('~foo$')).toEqual(['~foo$', '-foo$'])
  })
})

// ============================================================
// detectState — positive parts
// ============================================================

describe('detectState (positive part)', () => {
  const p = 'language:"chinese"$'

  it('Include when token present', () => {
    expect(detectState(p, new Set([p]))).toBe(TagState.Include)
  })

  it('Or when ~token present', () => {
    expect(detectState(p, new Set([`~${p}`]))).toBe(TagState.Or)
  })

  it('Exclude when -token present', () => {
    expect(detectState(p, new Set([`-${p}`]))).toBe(TagState.Exclude)
  })

  it('null when not present', () => {
    expect(detectState(p, new Set())).toBeNull()
  })

  it('Exclude takes priority over Include', () => {
    expect(detectState(p, new Set([p, `-${p}`]))).toBe(TagState.Exclude)
  })
})

// ============================================================
// detectState — negative parts
// ============================================================

describe('detectState (negative part)', () => {
  const p = '-other:"ai generated"$'
  const base = 'other:"ai generated"$'

  it('Include when -token present', () => {
    expect(detectState(p, new Set([p]))).toBe(TagState.Include)
  })

  it('Exclude when base (positive) token present (double negative)', () => {
    expect(detectState(p, new Set([base]))).toBe(TagState.Exclude)
  })

  it('null when neither present', () => {
    expect(detectState(p, new Set())).toBeNull()
  })

  it('Exclude takes priority over Include', () => {
    expect(detectState(p, new Set([p, base]))).toBe(TagState.Exclude)
  })

  it('does not detect Or (no ~-token form)', () => {
    expect(detectState(p, new Set([`~${p}`]))).toBeNull()
  })
})

// ============================================================
// detectState — Or-prefixed parts
// ============================================================

describe('detectState (Or-prefixed part)', () => {
  const p = '~language:"chinese"$'

  it('Include when ~token present', () => {
    expect(detectState(p, new Set([p]))).toBe(TagState.Include)
  })

  it('Exclude when -base present', () => {
    expect(detectState(p, new Set(['-language:"chinese"$']))).toBe(TagState.Exclude)
  })

  it('null when neither present', () => {
    expect(detectState(p, new Set())).toBeNull()
  })

})

// ============================================================
// getState — single tag
// ============================================================

describe('getState (single positive tag)', () => {
  const tag = 'language:"chinese"$'

  it('Off when not in search', () => {
    expect(getState(tag, new Set())).toBe(TagState.Off)
  })

  it('Include when present', () => {
    expect(getState(tag, new Set([tag]))).toBe(TagState.Include)
  })

  it('Or when ~ present', () => {
    expect(getState(tag, new Set([`~${tag}`]))).toBe(TagState.Or)
  })

  it('Exclude when - present', () => {
    expect(getState(tag, new Set([`-${tag}`]))).toBe(TagState.Exclude)
  })
})

describe('getState (single negative tag)', () => {
  const tag = '-other:"ai generated"$'
  const base = 'other:"ai generated"$'

  it('Off when not in search', () => {
    expect(getState(tag, new Set())).toBe(TagState.Off)
  })

  it('Include when -tag present', () => {
    expect(getState(tag, new Set([tag]))).toBe(TagState.Include)
  })

  it('Exclude when base present (double negative)', () => {
    expect(getState(tag, new Set([base]))).toBe(TagState.Exclude)
  })
})

// ============================================================
// getState — composite tags
// ============================================================

describe('getState (composite positive)', () => {
  const tag = 'female:"yuri"$, female:"lolicon"$'

  it('Include when all parts present', () => {
    expect(getState(tag, new Set(['female:"yuri"$', 'female:"lolicon"$']))).toBe(TagState.Include)
  })

  it('Off when only some parts present', () => {
    expect(getState(tag, new Set(['female:"yuri"$']))).toBe(TagState.Off)
  })

  it('Or when all parts have ~', () => {
    expect(getState(tag, new Set(['~female:"yuri"$', '~female:"lolicon"$']))).toBe(TagState.Or)
  })

  it('Off when parts have mixed states', () => {
    expect(getState(tag, new Set(['female:"yuri"$', '~female:"lolicon"$']))).toBe(TagState.Off)
  })
})

describe('getState (composite negative — e.g. Japanese)', () => {
  const tag = '-language:"english"$, -language:"chinese"$, -language:"korean"$'

  it('Include when all - parts present', () => {
    expect(getState(tag, new Set([
      '-language:"english"$', '-language:"chinese"$', '-language:"korean"$',
    ]))).toBe(TagState.Include)
  })

  it('Exclude when all base parts present (double negative)', () => {
    expect(getState(tag, new Set([
      'language:"english"$', 'language:"chinese"$', 'language:"korean"$',
    ]))).toBe(TagState.Exclude)
  })

  it('Off when mixed', () => {
    expect(getState(tag, new Set([
      '-language:"english"$', 'language:"chinese"$', '-language:"korean"$',
    ]))).toBe(TagState.Off)
  })
})

describe('getState (composite mixed positive/negative)', () => {
  const tag = 'language:"chinese"$, -language:"english"$'

  it('Include when both in their natural form', () => {
    expect(getState(tag, new Set([
      'language:"chinese"$', '-language:"english"$',
    ]))).toBe(TagState.Include)
  })

  it('Exclude when both in inverted form', () => {
    expect(getState(tag, new Set([
      '-language:"chinese"$', 'language:"english"$',
    ]))).toBe(TagState.Exclude)
  })

  it('Off when mixed states', () => {
    expect(getState(tag, new Set([
      'language:"chinese"$', 'language:"english"$',
    ]))).toBe(TagState.Off)
  })

  it('Or is undetectable (positive=Or, negative=Include → Off)', () => {
    // This is why Or is auto-skipped for tags with any negative part
    expect(getState(tag, new Set([
      '~language:"chinese"$', '-language:"english"$',
    ]))).toBe(TagState.Off)
  })
})

describe('mixed tag: Or→Exclude transition does not produce ~- or --', () => {
  const tag = 'language:"chinese"$, -other:"ai generated"$'

  it('removeTag cleans Or-form tokens correctly', () => {
    // Hypothetical Or state: ~chinese -ai (even though Or is auto-skipped)
    const orText = '~language:"chinese"$ -other:"ai generated"$'
    const cleaned = removeTag(orText, tag)
    expect(cleaned).toBe('')
  })

  it('Or→Exclude transition via remove+readd produces clean output', () => {
    const orText = '~language:"chinese"$ -other:"ai generated"$'
    const cleaned = removeTag(orText, tag)
    const result = addTag(cleaned, tag, TagState.Exclude)
    // Should be -chinese ai, NOT ~-chinese ai
    expect(result).toBe('-language:"chinese"$ other:"ai generated"$')
    expect(result).not.toContain('~-')
    expect(result).not.toContain('--')
  })

  it('Include→Exclude transition is also clean', () => {
    const includeText = 'language:"chinese"$ -other:"ai generated"$'
    const cleaned = removeTag(includeText, tag)
    const result = addTag(cleaned, tag, TagState.Exclude)
    expect(result).toBe('-language:"chinese"$ other:"ai generated"$')
  })
})

describe('user-reported: composite tag with -rough and ~chinese', () => {
  // User's actual tag definition: "-other:\"rough translation\"$, ~language:\"chinese\"$"
  const tag = '-other:"rough translation"$, ~language:"chinese"$'
  const qt = { tag }

  it('Include state detected when both parts in natural form', () => {
    const tokens = new Set(tokenize('-other:"rough translation"$ ~language:"chinese"$'))
    expect(getState(tag, tokens)).toBe(TagState.Include)
  })

  it('Exclude state detected when both parts negated', () => {
    const tokens = new Set(tokenize('other:"rough translation"$ -language:"chinese"$'))
    expect(getState(tag, tokens)).toBe(TagState.Exclude)
  })

  it('Or auto-skipped (has prefixed parts)', () => {
    expect(getEffectiveModifiers(qt)).toEqual([TagState.Exclude])
  })

  it('right-click from Include → Exclude, no ~- or -- produced', () => {
    const searchText = '-other:"rough translation"$ ~language:"chinese"$'
    expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Exclude)

    const cleaned = removeTag(searchText, tag)
    expect(cleaned).toBe('')

    const result = addTag(cleaned, tag, TagState.Exclude)
    expect(result).toBe('other:"rough translation"$ -language:"chinese"$')
    expect(result).not.toContain('~-')
    expect(result).not.toContain('--')
    expect(result).not.toContain('-~')
  })

  it('removeTag cleans Include form', () => {
    expect(removeTag('-other:"rough translation"$ ~language:"chinese"$', tag)).toBe('')
  })

  it('removeTag cleans Exclude form', () => {
    expect(removeTag('other:"rough translation"$ -language:"chinese"$', tag)).toBe('')
  })
})

// ============================================================
// removeTag
// ============================================================

describe('removeTag', () => {
  it('removes Include form of positive tag', () => {
    expect(removeTag('language:"chinese"$ other:foo$', 'language:"chinese"$'))
      .toBe('other:foo$')
  })

  it('removes Or form of positive tag', () => {
    expect(removeTag('~language:"chinese"$ other:foo$', 'language:"chinese"$'))
      .toBe('other:foo$')
  })

  it('removes Exclude form of positive tag', () => {
    expect(removeTag('-language:"chinese"$ other:foo$', 'language:"chinese"$'))
      .toBe('other:foo$')
  })

  it('removes Include form of negative tag', () => {
    expect(removeTag('-other:"ai generated"$ other:foo$', '-other:"ai generated"$'))
      .toBe('other:foo$')
  })

  it('removes Exclude form of negative tag (the positive base)', () => {
    expect(removeTag('other:"ai generated"$ other:foo$', '-other:"ai generated"$'))
      .toBe('other:foo$')
  })

  it('removes all parts of composite tag', () => {
    expect(removeTag(
      '-language:"english"$ -language:"chinese"$ other:foo$',
      '-language:"english"$, -language:"chinese"$',
    )).toBe('other:foo$')
  })
})

// ============================================================
// addTag
// ============================================================

describe('addTag (positive tag)', () => {
  const tag = 'language:"chinese"$'

  it('Include adds as-is', () => {
    expect(addTag('', tag, TagState.Include)).toBe(tag)
  })

  it('Or adds ~', () => {
    expect(addTag('', tag, TagState.Or)).toBe(`~${tag}`)
  })

  it('Exclude adds -', () => {
    expect(addTag('', tag, TagState.Exclude)).toBe(`-${tag}`)
  })

  it('appends to existing text', () => {
    expect(addTag('other:foo$', tag, TagState.Include)).toBe(`other:foo$ ${tag}`)
  })
})

describe('addTag (negative tag)', () => {
  const tag = '-other:"ai generated"$'

  it('Include adds with -', () => {
    expect(addTag('', tag, TagState.Include)).toBe('-other:"ai generated"$')
  })

  it('Or absorbed, same as Include', () => {
    expect(addTag('', tag, TagState.Or)).toBe('-other:"ai generated"$')
  })

  it('Exclude strips -, double negative', () => {
    expect(addTag('', tag, TagState.Exclude)).toBe('other:"ai generated"$')
  })
})

describe('addTag (composite negative)', () => {
  const tag = '-language:"english"$, -language:"chinese"$'

  it('Include adds all with -', () => {
    expect(addTag('', tag, TagState.Include))
      .toBe('-language:"english"$ -language:"chinese"$')
  })

  it('Exclude strips all -, double negative', () => {
    expect(addTag('', tag, TagState.Exclude))
      .toBe('language:"english"$ language:"chinese"$')
  })
})

describe('addTag (composite mixed)', () => {
  const tag = 'language:"chinese"$, -language:"english"$'

  it('Include adds each in natural form', () => {
    expect(addTag('', tag, TagState.Include))
      .toBe('language:"chinese"$ -language:"english"$')
  })

  it('Or: positive gets ~, negative absorbed', () => {
    expect(addTag('', tag, TagState.Or))
      .toBe('~language:"chinese"$ -language:"english"$')
  })

  it('Exclude: positive gets -, negative stripped', () => {
    expect(addTag('', tag, TagState.Exclude))
      .toBe('-language:"chinese"$ language:"english"$')
  })
})

// ============================================================
// getEffectiveModifiers
// ============================================================

describe('getEffectiveModifiers', () => {
  it('all enabled by default', () => {
    expect(getEffectiveModifiers({ tag: 'foo$' }))
      .toEqual([TagState.Or, TagState.Exclude])
  })

  it('respects disabledModes', () => {
    expect(getEffectiveModifiers({ tag: 'foo$', disabledModes: ['or'] }))
      .toEqual([TagState.Exclude])
  })

  it('both disabled → empty', () => {
    expect(getEffectiveModifiers({ tag: 'foo$', disabledModes: ['or', 'exclude'] }))
      .toEqual([])
  })

  it('auto-removes Or for all-negative tags', () => {
    expect(getEffectiveModifiers({ tag: '-foo$' }))
      .toEqual([TagState.Exclude])
  })

  it('auto-removes Or for composite all-negative', () => {
    expect(getEffectiveModifiers({ tag: '-foo$, -bar$' }))
      .toEqual([TagState.Exclude])
  })

  it('auto-removes Or for mixed positive/negative (Or undetectable)', () => {
    expect(getEffectiveModifiers({ tag: 'foo$, -bar$' }))
      .toEqual([TagState.Exclude])
  })

  it('keeps Or for all-positive', () => {
    expect(getEffectiveModifiers({ tag: 'foo$, bar$' }))
      .toEqual([TagState.Or, TagState.Exclude])
  })

  it('any-negative + both disabled → empty', () => {
    expect(getEffectiveModifiers({ tag: '-foo$', disabledModes: ['or', 'exclude'] }))
      .toEqual([])
  })
})

// ============================================================
// getNextRightClickState
// ============================================================

describe('getNextRightClickState', () => {
  describe('normal tag (all modes enabled)', () => {
    const qt = { tag: 'foo$' }

    it('Off → Or', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Or)
    })

    it('Include → Or', () => {
      expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Or)
    })

    it('Or → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Or)).toBe(TagState.Exclude)
    })

    it('Exclude → Off', () => {
      expect(getNextRightClickState(qt, TagState.Exclude)).toBe(TagState.Off)
    })
  })

  describe('normal tag (Or disabled)', () => {
    const qt = { tag: 'foo$', disabledModes: ['or'] as const }

    it('Off → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Exclude)
    })

    it('Include → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Exclude)
    })

    it('Exclude → Off (single modifier cycles back)', () => {
      expect(getNextRightClickState(qt, TagState.Exclude)).toBe(TagState.Off)
    })
  })

  describe('all-negative tag (default modes)', () => {
    const qt = { tag: '-other:"ai generated"$' }

    it('Off → Exclude (Or auto-skipped)', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Exclude)
    })

    it('Include → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Exclude)
    })

    it('Exclude → Off', () => {
      expect(getNextRightClickState(qt, TagState.Exclude)).toBe(TagState.Off)
    })
  })

  describe('all-negative tag (both modes explicitly disabled)', () => {
    const qt = { tag: '-foo$', disabledModes: ['or', 'exclude'] as const }

    it('returns null for any state', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBeNull()
      expect(getNextRightClickState(qt, TagState.Include)).toBeNull()
    })
  })

  describe('mixed positive/negative tag', () => {
    const qt = { tag: 'foo$, -bar$' }

    it('Off → Exclude (Or auto-skipped because has negative part)', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Exclude)
    })

    it('Include → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Exclude)
    })
  })
})

// ============================================================
// Full round-trip: left-click toggle + right-click cycle
// ============================================================

describe('round-trip: positive tag', () => {
  const tag = 'language:"chinese"$'

  it('left-click on → off → on', () => {
    let text = addTag('', tag, TagState.Include)
    expect(text).toBe('language:"chinese"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)

    text = removeTag(text, tag)
    expect(text).toBe('')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Off)
  })

  it('right-click cycle: Off → Or → Exclude → Off', () => {
    const qt = { tag }
    let text = ''

    // Off → Or
    text = addTag(removeTag(text, tag), tag, TagState.Or)
    expect(text).toBe('~language:"chinese"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Or)

    // Or → Exclude
    text = addTag(removeTag(text, tag), tag, TagState.Exclude)
    expect(text).toBe('-language:"chinese"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)

    // Exclude → Off
    text = removeTag(text, tag)
    expect(text).toBe('')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Off)
  })
})

describe('round-trip: negative tag (e.g. exclude AI)', () => {
  const tag = '-other:"ai generated"$'

  it('left-click on → off → on', () => {
    let text = addTag('', tag, TagState.Include)
    expect(text).toBe('-other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)

    text = removeTag(text, tag)
    expect(text).toBe('')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Off)
  })

  it('right-click: Off → Exclude (double negative = positive)', () => {
    let text = addTag('', tag, TagState.Exclude)
    expect(text).toBe('other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)
  })

  it('removeTag cleans both forms', () => {
    expect(removeTag('-other:"ai generated"$', tag)).toBe('')
    expect(removeTag('other:"ai generated"$', tag)).toBe('')
  })
})

describe('round-trip: composite negative (Japanese)', () => {
  const tag = '-language:"english"$, -language:"chinese"$, -language:"korean"$'

  it('left-click Include adds all exclusions', () => {
    const text = addTag('', tag, TagState.Include)
    expect(text).toBe('-language:"english"$ -language:"chinese"$ -language:"korean"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)
  })

  it('Exclude double-negates all to positive', () => {
    const text = addTag('', tag, TagState.Exclude)
    expect(text).toBe('language:"english"$ language:"chinese"$ language:"korean"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)
  })

  it('removeTag cleans Include form', () => {
    expect(removeTag(
      '-language:"english"$ -language:"chinese"$ -language:"korean"$',
      tag,
    )).toBe('')
  })

  it('removeTag cleans Exclude (double-negative) form', () => {
    expect(removeTag(
      'language:"english"$ language:"chinese"$ language:"korean"$',
      tag,
    )).toBe('')
  })
})

describe('round-trip: composite mixed (chinese + exclude AI)', () => {
  const tag = 'language:"chinese"$, -other:"ai generated"$'

  it('left-click Include: chinese + exclude AI', () => {
    const text = addTag('', tag, TagState.Include)
    expect(text).toBe('language:"chinese"$ -other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)
  })

  it('Exclude: -chinese + ai (both flip)', () => {
    const text = addTag('', tag, TagState.Exclude)
    expect(text).toBe('-language:"chinese"$ other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)
  })

  it('Or skipped (has negative part)', () => {
    expect(getEffectiveModifiers({ tag })).toEqual([TagState.Exclude])
  })

  it('right-click cycle: Off → Exclude → Off', () => {
    const qt = { tag }
    expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Exclude)
    expect(getNextRightClickState(qt, TagState.Exclude)).toBe(TagState.Off)
  })

  it('removeTag cleans Include form', () => {
    expect(removeTag('language:"chinese"$ -other:"ai generated"$', tag)).toBe('')
  })

  it('removeTag cleans Exclude form', () => {
    expect(removeTag('-language:"chinese"$ other:"ai generated"$', tag)).toBe('')
  })

  it('removeTag cleans from mixed search text', () => {
    expect(removeTag(
      'language:"chinese"$ -other:"ai generated"$ other:foo$',
      tag,
    )).toBe('other:foo$')
  })
})
