import { describe, it, expect } from 'vitest'
import { TagState, type TagMode } from '@/types'
import {
  tokenize,
  normalizeNs,
  tokenIdentity,
  applyState,
  getButtonShape,
  buildIdentityIndex,
  getState as _getStateArr,
  removeTag as _removeTagArr,
  addTag as _addTagArr,
  setTagState as _setTagStateArr,
  getEffectiveModifiers as _getEffectiveModifiersArr,
  getNextRightClickState as _getNextRightClickStateArr,
} from './tagState'

// Legacy comma-separated tag string adapter — these tests were written when
// the public API took a single `tag: string` (with `splitMultiTag` inside).
// 後來 API 簽名改為 `tags: string[]`，邏輯本身沒變。為了不重寫整個檔案，
// 在這裡留 shim：把字串 split 後餵給新 signature。
function splitMultiTag(tag: string): string[] {
  return tag.split(',').map(s => s.trim()).filter(Boolean)
}
type LegacyQt = { tag: string; disabledModes?: readonly TagMode[] }

const getState = (tag: string, tokens: Set<string>) => _getStateArr(splitMultiTag(tag), buildIdentityIndex(tokens))
const removeTag = (text: string, tag: string) => _removeTagArr(text, splitMultiTag(tag))
const addTag = (text: string, tag: string, state: TagState) => _addTagArr(text, splitMultiTag(tag), state)
const getEffectiveModifiers = (qt: LegacyQt) => _getEffectiveModifiersArr(splitMultiTag(qt.tag), qt.disabledModes)
const getNextRightClickState = (qt: LegacyQt, state: TagState) =>
  _getNextRightClickStateArr(splitMultiTag(qt.tag), qt.disabledModes, state)

function identityIndex(text: string): Map<string, string | null> {
  return buildIdentityIndex(tokenize(text))
}

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
// getButtonShape
// ============================================================

describe('getButtonShape', () => {
  it('positive-single / positive-multi by count', () => {
    expect(getButtonShape(['foo$'])).toBe('positive-single')
    expect(getButtonShape(['foo$', 'bar$'])).toBe('positive-multi')
  })

  it('negative-single / negative-multi by count', () => {
    expect(getButtonShape(['-foo$'])).toBe('negative-single')
    expect(getButtonShape(['-foo$', '-bar$'])).toBe('negative-multi')
  })

  it('all-or: any count of ~ prefix (single/multi 不分)', () => {
    expect(getButtonShape(['~foo$'])).toBe('all-or')
    expect(getButtonShape(['~foo$', '~bar$'])).toBe('all-or')
  })

  it('mixed: any prefix combination', () => {
    expect(getButtonShape(['foo$', '-bar$'])).toBe('mixed')
    expect(getButtonShape(['foo$', '~bar$'])).toBe('mixed')
    expect(getButtonShape(['-foo$', '~bar$'])).toBe('mixed')
    expect(getButtonShape(['foo$', '-bar$', '~baz$'])).toBe('mixed')
  })

  it('empty tags → empty shape', () => {
    expect(getButtonShape([])).toBe('empty')
  })
})

// ============================================================
// applyState — per-token, assumes single-tag button context
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

describe('applyState (negative part)', () => {
  const p = '-other:"ai generated"$'

  it('Include → as-is (keeps -)', () => {
    expect(applyState(p, TagState.Include)).toBe(p)
  })

  it('Or → absorbed, same as Include', () => {
    expect(applyState(p, TagState.Or)).toBe(p)
  })

  // single-tag context: -X 的 Exclude 是雙否定 → 正向 base。
  // multi-tag De Morgan 形式（~X）由 addTag 在 button-shape 層級處理。
  it('Exclude → positive base (double negation, single-neg button context)', () => {
    expect(applyState(p, TagState.Exclude)).toBe('other:"ai generated"$')
  })
})

describe('applyState (Or-prefixed part)', () => {
  const p = '~language:"chinese"$'

  it('Include → as-is (keeps ~)', () => {
    expect(applyState(p, TagState.Include)).toBe(p)
  })

  it('Or → stays ~ (already in OR group form)', () => {
    expect(applyState(p, TagState.Or)).toBe(p)
  })

  it('Exclude → replaces ~ with -, negates underlying', () => {
    expect(applyState(p, TagState.Exclude)).toBe('-language:"chinese"$')
  })
})

// ============================================================
// tokenIdentity — 身份模型核心：(qualifier, ns, tag)，剝掉前綴後綴
// ============================================================

describe('tokenIdentity', () => {
  it('忽略前綴 (-, ~)，同身份', () => {
    const a = tokenIdentity('language:chinese$')
    expect(tokenIdentity('-language:chinese$')).toBe(a)
    expect(tokenIdentity('~language:chinese$')).toBe(a)
  })

  it('忽略後綴 ($, *, %)，同身份', () => {
    const a = tokenIdentity('language:chinese$')
    expect(tokenIdentity('language:chinese')).toBe(a)
    expect(tokenIdentity('language:chinese*')).toBe(a)
    expect(tokenIdentity('language:chinese%')).toBe(a)
  })

  it('namespace alias 解析後同身份', () => {
    expect(tokenIdentity('l:chinese$')).toBe(tokenIdentity('language:chinese$'))
    expect(tokenIdentity('f:"big breasts"$')).toBe(tokenIdentity('female:"big breasts"$'))
  })

  it('quoted 跟 bare 同身份（內容相同的話）', () => {
    expect(tokenIdentity('language:"chinese"$')).toBe(tokenIdentity('language:chinese$'))
  })

  it('不同 ns / 不同 tag → 不同身份', () => {
    expect(tokenIdentity('language:chinese$')).not.toBe(tokenIdentity('language:english$'))
    expect(tokenIdentity('language:chinese$')).not.toBe(tokenIdentity('other:chinese$'))
  })

  it('qualifier（gid / uploader 等）跟 ns 區分', () => {
    expect(tokenIdentity('gid:12345')).not.toBe(tokenIdentity('language:12345'))
  })

  it('tag 大小寫不敏感（容錯不同來源）', () => {
    expect(tokenIdentity('language:Chinese$')).toBe(tokenIdentity('language:chinese$'))
  })

  it('parse error 的 token → null（不屬於任何身份）', () => {
    expect(tokenIdentity('')).toBeNull()
  })
})

// ============================================================
// getState — button-aware, handles multi-neg De Morgan specially
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

  // single-neg 按鈕：Exclude = 雙否定 = positive base（不走 De Morgan ~base）
  it('Exclude when positive base present (double negation)', () => {
    expect(getState(tag, new Set([base]))).toBe(TagState.Exclude)
  })

  // ~base 是 multi-neg 按鈕的 De Morgan 形式，對 single-neg 按鈕不該被偵測
  it('Off when ~base present (multi-neg form, not applicable to single-neg button)', () => {
    expect(getState(tag, new Set([`~${base}`]))).toBe(TagState.Off)
  })
})

describe('getState (single OR-prefixed tag)', () => {
  const tag = '~language:"chinese"$'
  const base = 'language:"chinese"$'

  it('Include when ~tag present', () => {
    expect(getState(tag, new Set([tag]))).toBe(TagState.Include)
  })

  it('Exclude when -base present', () => {
    expect(getState(tag, new Set([`-${base}`]))).toBe(TagState.Exclude)
  })
})

describe('getState (composite positive — multi-positive)', () => {
  const tag = 'female:"yuri"$, female:"lolicon"$'

  it('Include when all parts present', () => {
    expect(getState(tag, new Set(['female:"yuri"$', 'female:"lolicon"$']))).toBe(TagState.Include)
  })

  it('Off when only some parts present', () => {
    expect(getState(tag, new Set(['female:"yuri"$']))).toBe(TagState.Off)
  })

  it('Or when all parts have ~ (real OR group)', () => {
    expect(getState(tag, new Set(['~female:"yuri"$', '~female:"lolicon"$']))).toBe(TagState.Or)
  })

  it('Off when parts have mixed states', () => {
    expect(getState(tag, new Set(['female:"yuri"$', '~female:"lolicon"$']))).toBe(TagState.Off)
  })

  // multi-positive Exclude 是 shape-disabled（嚴格 inverse 是 OR-of-negation 不合法）。
  // search 欄偶然湊到全 -X 也不該把按鈕亮成 Exclude。
  it('Off when all -X (Exclude form) present (shape-disabled, no visual lie)', () => {
    expect(getState(tag, new Set([
      '-female:"yuri"$', '-female:"lolicon"$',
    ]))).toBe(TagState.Off)
  })
})

describe('getState (composite negative — multi-neg, De Morgan)', () => {
  const tag = '-language:"english"$, -language:"chinese"$, -language:"korean"$'

  it('Include when all - parts present', () => {
    expect(getState(tag, new Set([
      '-language:"english"$', '-language:"chinese"$', '-language:"korean"$',
    ]))).toBe(TagState.Include)
  })

  // multi-neg Exclude = De Morgan 推導的真實 inverse = OR-of-positives = ~X1 ~X2 ~X3
  it('Exclude when all ~base parts present (OR group form, De Morgan)', () => {
    expect(getState(tag, new Set([
      '~language:"english"$', '~language:"chinese"$', '~language:"korean"$',
    ]))).toBe(TagState.Exclude)
  })

  // 關鍵：用戶 include 全部三個語言（AND of positives）≠ 多 neg 按鈕的真實 inverse
  // （OR of positives）。前者 = 三語言全擁有的稀少多語本；後者 = 至少有一種語言的所有本。
  // 不該被誤判為 Exclude（視覺撒謊）。
  it('Off when all positive base parts present (AND ≠ De Morgan inverse)', () => {
    expect(getState(tag, new Set([
      'language:"english"$', 'language:"chinese"$', 'language:"korean"$',
    ]))).toBe(TagState.Off)
  })

  it('Off when mixed', () => {
    expect(getState(tag, new Set([
      '-language:"english"$', 'language:"chinese"$', '-language:"korean"$',
    ]))).toBe(TagState.Off)
  })
})

describe('getState (composite OR-prefixed — multi-or)', () => {
  const tag = '~language:"chinese"$, ~language:"english"$'

  it('Include when all ~ parts present', () => {
    expect(getState(tag, new Set([
      '~language:"chinese"$', '~language:"english"$',
    ]))).toBe(TagState.Include)
  })

  // multi-or Exclude = De Morgan 對 ¬(X1 ∪ X2) = ¬X1 ∩ ¬X2 = -X1 -X2
  it('Exclude when all -base parts present', () => {
    expect(getState(tag, new Set([
      '-language:"chinese"$', '-language:"english"$',
    ]))).toBe(TagState.Exclude)
  })
})

describe('getState (composite mixed)', () => {
  const tag = 'language:"chinese"$, -language:"english"$'

  it('Include when both in natural form', () => {
    expect(getState(tag, new Set([
      'language:"chinese"$', '-language:"english"$',
    ]))).toBe(TagState.Include)
  })

  // mixed 按鈕的 Exclude 在 getEffectiveModifiers 是 shape-disabled。getState 偵測層級
  // 也要對齊——即使 token 偶然湊到 per-tag 翻轉形式（每 tag detectState 都回 Exclude），
  // 也要回 Off 而不是 Exclude，避免在 search 欄偶然存在反向 token 時把按鈕亮成 Exclude
  // 的視覺謊言。
  it('Off when per-token inverted form present (shape-disabled, no visual lie)', () => {
    expect(getState(tag, new Set([
      '-language:"chinese"$', 'language:"english"$',
    ]))).toBe(TagState.Off)
  })

  it('Off when mixed states between parts', () => {
    expect(getState(tag, new Set([
      'language:"chinese"$', 'language:"english"$',
    ]))).toBe(TagState.Off)
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

  it('removes Exclude form of negative tag (positive base, double negation)', () => {
    expect(removeTag('other:"ai generated"$ other:foo$', '-other:"ai generated"$'))
      .toBe('other:foo$')
  })

  // 身份模型：~base 跟 -base / base 共享 (ns, tag) 身份，一律驅逐。
  // 跟舊的「分形式清」不一樣——這是 update / replace 心智模型的核心：
  // 點按鈕 = 該按鈕宣告它要當這身份的當家，舊住戶不管什麼態度都退場。
  it('removes ~base form of negative tag (identity match)', () => {
    expect(removeTag('~other:"ai generated"$ other:foo$', '-other:"ai generated"$'))
      .toBe('other:foo$')
  })

  it('removes all parts of multi-neg button (De Morgan form)', () => {
    expect(removeTag(
      '~language:"english"$ ~language:"chinese"$ other:foo$',
      '-language:"english"$, -language:"chinese"$',
    )).toBe('other:foo$')
  })

  it('removes all parts of multi-neg button (Include form)', () => {
    expect(removeTag(
      '-language:"english"$ -language:"chinese"$ other:foo$',
      '-language:"english"$, -language:"chinese"$',
    )).toBe('other:foo$')
  })

  // 身份模型下，single-neg [-english$] 跟 multi-or [~english$, ...] 共用
  // language:english 身份。前者 click 會驅逐後者的 ~english$——這是 update /
  // replace 模型的預期行為，不是 bug。
  it('single-neg removeTag evicts shared identity from multi-or neighbor', () => {
    expect(removeTag('~language:"chinese"$ ~language:"english"$', '-language:"english"$'))
      .toBe('~language:"chinese"$')
  })

  it('multi-neg removeTag evicts both identities', () => {
    expect(removeTag(
      '~language:"english"$ ~language:"chinese"$',
      '-language:"english"$, -language:"chinese"$',
    )).toBe('')
  })

  // 身份不在 button 管轄範圍 → 完全不動
  it('leaves unrelated namespace tokens alone', () => {
    expect(removeTag('language:chinese$ other:"full color$" m:yaoi$', 'language:chinese$'))
      .toBe('other:"full color$" m:yaoi$')
  })
})

// ============================================================
// addTag
// ============================================================

describe('addTag (single positive)', () => {
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

describe('addTag (single negative)', () => {
  const tag = '-other:"ai generated"$'

  it('Include adds with -', () => {
    expect(addTag('', tag, TagState.Include)).toBe('-other:"ai generated"$')
  })

  // single-neg + Exclude = 雙否定 = 正向 base
  it('Exclude removes - (double negation)', () => {
    expect(addTag('', tag, TagState.Exclude)).toBe('other:"ai generated"$')
  })
})

describe('addTag (multi-neg — De Morgan)', () => {
  const tag = '-language:"english"$, -language:"chinese"$'

  it('Include adds all with -', () => {
    expect(addTag('', tag, TagState.Include))
      .toBe('-language:"english"$ -language:"chinese"$')
  })

  // multi-neg + Exclude = De Morgan = OR-of-positives = ~X1 ~X2
  it('Exclude outputs ~base for each (OR group, De Morgan inverse)', () => {
    expect(addTag('', tag, TagState.Exclude))
      .toBe('~language:"english"$ ~language:"chinese"$')
  })
})

describe('addTag (multi-or)', () => {
  const tag = '~language:"chinese"$, ~language:"english"$'

  it('Include adds all with ~', () => {
    expect(addTag('', tag, TagState.Include))
      .toBe('~language:"chinese"$ ~language:"english"$')
  })

  // Or 在 all-or cycle 已被禁用（isStateShapeAllowed 攔住），這條測 applyState
  // 層級的 defensive 行為——若有人直接 call addTag 帶 Or，~X 維持不變不會炸
  it('Or keeps ~ form unchanged (defensive: cycle 不會走到這)', () => {
    expect(addTag('', tag, TagState.Or))
      .toBe('~language:"chinese"$ ~language:"english"$')
  })

  // multi-or Exclude = -X1 -X2（每個 ~X 翻轉成 -X）
  it('Exclude flips each ~ to -', () => {
    expect(addTag('', tag, TagState.Exclude))
      .toBe('-language:"chinese"$ -language:"english"$')
  })
})

// ============================================================
// getEffectiveModifiers — UI-level state availability
// ============================================================

describe('getEffectiveModifiers — by button shape', () => {
  it('single positive: Or ✓ Exclude ✓', () => {
    expect(getEffectiveModifiers({ tag: 'foo$' }))
      .toEqual([TagState.Or, TagState.Exclude])
  })

  // multi-positive Exclude 嚴格 inverse = OR-of-negations，e站不支援
  it('multi-positive: Or ✓ Exclude ✗', () => {
    expect(getEffectiveModifiers({ tag: 'foo$, bar$' }))
      .toEqual([TagState.Or])
  })

  // all-negative Or 嚴格 inverse = OR-of-negations，e站不支援
  it('single negative: Or ✗ Exclude ✓ (double negation)', () => {
    expect(getEffectiveModifiers({ tag: '-foo$' }))
      .toEqual([TagState.Exclude])
  })

  it('multi-negative: Or ✗ Exclude ✓ (De Morgan)', () => {
    expect(getEffectiveModifiers({ tag: '-foo$, -bar$' }))
      .toEqual([TagState.Exclude])
  })

  // all-or Or 被禁用：~X 在 Or 態下 applyState 沒有 distinct token 形式
  // （回傳同個 ~X，跟 Include 撞臉，cycle 會卡死偵測不到）
  it('single OR-group: Or ✗ Exclude ✓', () => {
    expect(getEffectiveModifiers({ tag: '~foo$' }))
      .toEqual([TagState.Exclude])
  })

  it('multi-OR-group: Or ✗ Exclude ✓ (De Morgan)', () => {
    expect(getEffectiveModifiers({ tag: '~foo$, ~bar$' }))
      .toEqual([TagState.Exclude])
  })

  // mixed 各種形狀：嚴格 inverse 必含 ~-X 或 ~~X，e站不支援
  it('mixed positive+negative: Or ✗ Exclude ✗', () => {
    expect(getEffectiveModifiers({ tag: 'foo$, -bar$' }))
      .toEqual([])
  })

  it('mixed positive+OR: Or ✗ Exclude ✗', () => {
    expect(getEffectiveModifiers({ tag: 'foo$, ~bar$' }))
      .toEqual([])
  })

  it('mixed negative+OR: Or ✗ Exclude ✗', () => {
    expect(getEffectiveModifiers({ tag: '-foo$, ~bar$' }))
      .toEqual([])
  })
})

describe('getEffectiveModifiers — disabledModes override', () => {
  it('respects user-set disabledModes', () => {
    expect(getEffectiveModifiers({ tag: 'foo$', disabledModes: ['or'] }))
      .toEqual([TagState.Exclude])
  })

  it('both disabled by user → empty', () => {
    expect(getEffectiveModifiers({ tag: 'foo$', disabledModes: ['or', 'exclude'] }))
      .toEqual([])
  })

  it('user override on already-shape-disabled state is a no-op', () => {
    // mixed 本來就 disable Exclude，user 再 disable 也還是 disabled
    expect(getEffectiveModifiers({ tag: 'foo$, -bar$', disabledModes: ['exclude'] }))
      .toEqual([])
  })
})

// ============================================================
// getNextRightClickState
// ============================================================

describe('getNextRightClickState', () => {
  describe('single positive (full three-state)', () => {
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

  describe('single negative (Or skipped, Exclude only)', () => {
    const qt = { tag: '-other:"ai generated"$' }

    it('Off → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Exclude)
    })

    it('Include → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Exclude)
    })

    it('Exclude → Off', () => {
      expect(getNextRightClickState(qt, TagState.Exclude)).toBe(TagState.Off)
    })
  })

  describe('multi-positive (Exclude skipped, Or only)', () => {
    const qt = { tag: 'foo$, bar$' }

    it('Off → Or', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Or)
    })

    it('Or → Off', () => {
      expect(getNextRightClickState(qt, TagState.Or)).toBe(TagState.Off)
    })
  })

  // all-or 的 Or 被禁用（沒 distinct token 形式），cycle 只剩 Include ↔ Exclude
  describe('all-or (Or skipped, Exclude only)', () => {
    const qt = { tag: '~foo$, ~bar$' }

    it('Off → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBe(TagState.Exclude)
    })

    it('Include → Exclude', () => {
      expect(getNextRightClickState(qt, TagState.Include)).toBe(TagState.Exclude)
    })

    it('Exclude → Off', () => {
      expect(getNextRightClickState(qt, TagState.Exclude)).toBe(TagState.Off)
    })
  })

  describe('mixed (both disabled, no cycle)', () => {
    const qt = { tag: 'foo$, -bar$' }

    it('returns null for any state', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBeNull()
      expect(getNextRightClickState(qt, TagState.Include)).toBeNull()
    })
  })

  describe('user-disabled all modes → null', () => {
    const qt = { tag: '-foo$', disabledModes: ['or', 'exclude'] as const }

    it('returns null for any state', () => {
      expect(getNextRightClickState(qt, TagState.Off)).toBeNull()
      expect(getNextRightClickState(qt, TagState.Include)).toBeNull()
    })
  })
})

// ============================================================
// Full round-trip: left-click toggle + right-click cycle
// ============================================================

describe('round-trip: single positive', () => {
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
    let text = ''

    text = addTag(removeTag(text, tag), tag, TagState.Or)
    expect(text).toBe('~language:"chinese"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Or)

    text = addTag(removeTag(text, tag), tag, TagState.Exclude)
    expect(text).toBe('-language:"chinese"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)

    text = removeTag(text, tag)
    expect(text).toBe('')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Off)
  })
})

describe('round-trip: single negative (e.g. exclude AI)', () => {
  const tag = '-other:"ai generated"$'

  it('left-click on → off → on', () => {
    let text = addTag('', tag, TagState.Include)
    expect(text).toBe('-other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)

    text = removeTag(text, tag)
    expect(text).toBe('')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Off)
  })

  // single-neg Exclude = 雙否定 = positive base
  it('right-click: Off → Exclude outputs positive base (double negation)', () => {
    const text = addTag('', tag, TagState.Exclude)
    expect(text).toBe('other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)
  })

  // 身份模型：identity 匹配就驅逐，不管 token 形式（-X / X / ~X 全清）。
  // 這是 update / replace 心智模型——按鈕點下去就把該身份戳收回來。
  it('removeTag evicts all forms sharing the identity (-X, X, ~X)', () => {
    expect(removeTag('-other:"ai generated"$', tag)).toBe('')
    expect(removeTag('other:"ai generated"$', tag)).toBe('')
    expect(removeTag('~other:"ai generated"$', tag)).toBe('')
  })
})

describe('round-trip: multi-negative (Japanese — De Morgan)', () => {
  const tag = '-language:"english"$, -language:"chinese"$, -language:"korean"$'

  it('left-click Include adds all exclusions', () => {
    const text = addTag('', tag, TagState.Include)
    expect(text).toBe('-language:"english"$ -language:"chinese"$ -language:"korean"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)
  })

  it('Exclude outputs ~base for each (OR group = De Morgan inverse)', () => {
    const text = addTag('', tag, TagState.Exclude)
    expect(text).toBe('~language:"english"$ ~language:"chinese"$ ~language:"korean"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)
  })

  it('removeTag cleans Include form', () => {
    expect(removeTag(
      '-language:"english"$ -language:"chinese"$ -language:"korean"$',
      tag,
    )).toBe('')
  })

  it('removeTag cleans Exclude (~base) form', () => {
    expect(removeTag(
      '~language:"english"$ ~language:"chinese"$ ~language:"korean"$',
      tag,
    )).toBe('')
  })

  // 向前相容：用戶手打的 positive base form 仍能被清掉
  it('removeTag still cleans bare positive base form', () => {
    expect(removeTag(
      'language:"english"$ language:"chinese"$ language:"korean"$',
      tag,
    )).toBe('')
  })
})

describe('round-trip: multi-or', () => {
  const tag = '~language:"chinese"$, ~language:"english"$'

  it('left-click Include outputs OR group', () => {
    const text = addTag('', tag, TagState.Include)
    expect(text).toBe('~language:"chinese"$ ~language:"english"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)
  })

  it('Exclude outputs -base for each (De Morgan)', () => {
    const text = addTag('', tag, TagState.Exclude)
    expect(text).toBe('-language:"chinese"$ -language:"english"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Exclude)
  })
})

describe('round-trip: mixed (no Or, no Exclude — only Include/Off cycle)', () => {
  const tag = 'language:"chinese"$, -other:"ai generated"$'
  const qt = { tag }

  it('left-click Include adds tags in natural form', () => {
    const text = addTag('', tag, TagState.Include)
    expect(text).toBe('language:"chinese"$ -other:"ai generated"$')
    expect(getState(tag, new Set(tokenize(text)))).toBe(TagState.Include)
  })

  it('right-click cycle returns null (no modifiers)', () => {
    expect(getNextRightClickState(qt, TagState.Off)).toBeNull()
    expect(getNextRightClickState(qt, TagState.Include)).toBeNull()
  })

  it('removeTag cleans Include form', () => {
    expect(removeTag('language:"chinese"$ -other:"ai generated"$', tag)).toBe('')
  })
})

// ============================================================
// 身份模型 cross-button replace 場景
// ============================================================

// 經典場景：all-or 多 tag button + 跟它身份重疊的 single-neg button。
// 設計約定：兩按鈕無法「並存」（共享 language:chinese 身份），點誰誰當家。
// 用 setTagState 模擬 click handler（位置守恆 in-place 替換 + 補尾巴）。
describe('cross-button: all-or 跟 negative-single 互搶身份', () => {
  const A = ['~language:chinese$', '~language:english$']  // all-or
  const B = ['-language:chinese$']                          // negative-single

  it('step 1: 點 A → A=Include', () => {
    const text = _setTagStateArr('', A, TagState.Include)
    expect(text).toBe('~language:chinese$ ~language:english$')
    expect(_getStateArr(A, identityIndex(text))).toBe(TagState.Include)
    expect(_getStateArr(B, identityIndex(text))).toBe(TagState.Off)
  })

  it('step 2: 點 B → B 搶下 language:chinese 身份（位置守恆）', () => {
    const text = _setTagStateArr('~language:chinese$ ~language:english$', B, TagState.Include)
    // chinese 原地被 -chinese$ 取代，english 留在原位（不會跳到 chinese 前面）
    expect(text).toBe('-language:chinese$ ~language:english$')
    expect(_getStateArr(A, identityIndex(text))).toBe(TagState.Off)
    expect(_getStateArr(B, identityIndex(text))).toBe(TagState.Include)
  })

  it('step 3: 再點 A → A 搶回身份，B 退場（位置守恆）', () => {
    const text = _setTagStateArr('-language:chinese$ ~language:english$', A, TagState.Include)
    // chinese 從 -chinese$ 原地換回 ~chinese$，english 維持
    expect(text).toBe('~language:chinese$ ~language:english$')
    expect(_getStateArr(A, identityIndex(text))).toBe(TagState.Include)
    expect(_getStateArr(B, identityIndex(text))).toBe(TagState.Off)
  })
})

describe('setTagState: 位置守恆', () => {
  it('in-place 取代既有同身份 token（不跳位）', () => {
    expect(_setTagStateArr('a$ b$ c$', ['b$'], TagState.Exclude))
      .toBe('a$ -b$ c$')
    expect(_setTagStateArr('a$ b$ c$', ['b$'], TagState.Or))
      .toBe('a$ ~b$ c$')
  })

  it('沒既存身份就補在尾巴', () => {
    expect(_setTagStateArr('a$ c$', ['b$'], TagState.Include))
      .toBe('a$ c$ b$')
  })

  it('部分 emission 在 search（原地）、部分不在（尾巴）', () => {
    // 純日語 部分身份已在（-chinese 在），部分不在（其他 -X）
    const japaneseOnly = [
      '-language:chinese$', '-language:english$', '-language:japanese$',
    ]
    expect(_setTagStateArr('other:foo$ -language:chinese$', japaneseOnly, TagState.Include))
      .toBe('other:foo$ -language:chinese$ -language:english$ -language:japanese$')
  })

  it('state=Off → 等同 removeTag（驅逐）', () => {
    expect(_setTagStateArr('a$ b$ c$', ['b$'], TagState.Off))
      .toBe('a$ c$')
  })

  it('重複身份的 search token → 第一個原地換、後續 dedup', () => {
    expect(_setTagStateArr('~chinese$ other:foo$ -chinese$', ['chinese$'], TagState.Include))
      .toBe('chinese$ other:foo$')
  })
})

// 預設標籤組真實案例：純日語（negative-multi）跟 7 個語言按鈕（positive-single）
// 互搶 language:X 身份。
describe('cross-button: 純日語 ↔ 個別語言按鈕', () => {
  const japaneseOnly = [
    '-language:chinese$', '-language:english$', '-language:japanese$',
    '-language:korean$', '-language:speechless$', '-language:"text cleaned$"',
  ]
  const english = ['language:english$']

  it('純日語 active → 點英文 → 英文搶下 l:english，純日語退場', () => {
    let text = _setTagStateArr('', japaneseOnly, TagState.Include)
    expect(_getStateArr(japaneseOnly, identityIndex(text))).toBe(TagState.Include)

    // 英文的 getState：l:english 在 search 是 -english$，**剛好**也是英文按鈕
    // positive-single 的 Exclude emission → 偵測為 Exclude state（不是 Off）。
    // 這個「視覺 state」反映 search 對 l:english 的當前態度，不代表是英文按鈕
    // 自己 emit 的——可能來自純日語。
    const state = _getStateArr(english, identityIndex(text))
    expect(state).toBe(TagState.Exclude)
    // 左鍵語意「state != Include → set Include」：英文搶回 l:english 身份
    // 位置守恆：-english$ 原地換成 english$，純日語其他 -X 都留原位
    text = _setTagStateArr(text, english, TagState.Include)

    expect(text).toContain('language:english$')
    expect(text).not.toContain('-language:english$')
    // 純日語少了 l:english 戳記 → Off
    expect(_getStateArr(japaneseOnly, identityIndex(text))).toBe(TagState.Off)
    expect(_getStateArr(english, identityIndex(text))).toBe(TagState.Include)
  })

  it('翻譯本（language:translated）跟純日語身份不重疊 → 可真正共存', () => {
    const translated = ['language:translated$']
    let text = _setTagStateArr('', japaneseOnly, TagState.Include)
    text = _setTagStateArr(text, translated, TagState.Include)

    // 兩按鈕都 Include：純日語的 6 個 -language 身份戳齊全，翻譯本的 l:translated 也在
    expect(_getStateArr(japaneseOnly, identityIndex(text))).toBe(TagState.Include)
    expect(_getStateArr(translated, identityIndex(text))).toBe(TagState.Include)
  })
})

// ============================================================
// namespace normalization
// ============================================================

describe('namespace normalization: getState', () => {
  it('button=long, search=short → Include', () => {
    const tag = 'language:"chinese"$'
    const tokens = new Set(tokenize('l:"chinese"$').map(normalizeNs))
    expect(getState(tag, tokens)).toBe(TagState.Include)
  })

  it('button=short, search=long → Include', () => {
    const tag = 'l:"chinese"$'
    const tokens = new Set(tokenize('language:"chinese"$').map(normalizeNs))
    expect(getState(tag, tokens)).toBe(TagState.Include)
  })

  it('multi-neg: button=long, search=long, Include detected', () => {
    const tag = '-language:"english"$, -language:"chinese"$'
    const tokens = new Set(tokenize('-l:"english"$ -l:"chinese"$').map(normalizeNs))
    expect(getState(tag, tokens)).toBe(TagState.Include)
  })

  it('multi-neg: De Morgan form detected as Exclude', () => {
    const tag = '-language:"english"$, -language:"chinese"$'
    const tokens = new Set(tokenize('~l:"english"$ ~l:"chinese"$').map(normalizeNs))
    expect(getState(tag, tokens)).toBe(TagState.Exclude)
  })
})

describe('namespace normalization: removeTag', () => {
  it('removes short-form tokens when button uses long form', () => {
    expect(removeTag('l:"chinese"$ other:foo$', 'language:"chinese"$'))
      .toBe('other:foo$')
  })

  it('removes long-form tokens when button uses short form', () => {
    expect(removeTag('language:"chinese"$ other:foo$', 'l:"chinese"$'))
      .toBe('other:foo$')
  })

  it('removes mixed ns forms from search text', () => {
    expect(removeTag(
      'l:"chinese"$ -o:"ai generated"$ other:foo$',
      'language:"chinese"$, -other:"ai generated"$',
    )).toBe('other:foo$')
  })

  it('removes ~short-form tokens', () => {
    expect(removeTag('~f:"big breasts"$ other:foo$', 'female:"big breasts"$'))
      .toBe('other:foo$')
  })
})
