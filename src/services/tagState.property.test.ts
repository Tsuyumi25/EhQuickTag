import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { TagState } from '@/types'
import {
  applyState,
  removeTag,
  addTag,
  setTagState,
  tokenize,
  tokenIdentity,
  buildIdentityIndex,
} from './tagState'
import { tokenArb, tagsArb, textArb } from './test-helpers'

const nonOffStateArb = fc.constantFrom(TagState.Include, TagState.Or, TagState.Exclude)

describe('tagState 性質測試', () => {
  test.prop([tokenArb])(
    'applyState(part, Include) 是 identity',
    (part) => {
      expect(applyState(part, TagState.Include)).toBe(part)
    },
  )

  test.prop([textArb, tagsArb])(
    'removeTag 是 idempotent',
    (text, tags) => {
      const once = removeTag(text, tags)
      expect(removeTag(once, tags)).toBe(once)
    },
  )

  test.prop([textArb, tagsArb])(
    'setTagState(_, _, Off) === removeTag（doc 寫的 invariant）',
    (text, tags) => {
      expect(setTagState(text, tags, TagState.Off)).toBe(removeTag(text, tags))
    },
  )

  test.prop([textArb, tagsArb, nonOffStateArb])(
    'setTagState 對 state 是 idempotent',
    (text, tags, state) => {
      const once = setTagState(text, tags, state)
      expect(setTagState(once, tags, state)).toBe(once)
    },
  )

  test.prop([textArb, tagsArb, nonOffStateArb])(
    'removeTag(addTag(text, tags, state), tags) === removeTag(text, tags)',
    (text, tags, state) => {
      const added = addTag(text, tags, state)
      expect(removeTag(added, tags)).toBe(removeTag(text, tags))
    },
  )

  test.prop([textArb])(
    'buildIdentityIndex 的 key 對應到 tokenize 中所有 valid identity',
    (text) => {
      const tokens = tokenize(text)
      const index = buildIdentityIndex(tokens)
      for (const t of tokens) {
        const id = tokenIdentity(t)
        if (!id) continue
        expect(index.has(id)).toBe(true)
      }
    },
  )

  test.prop([textArb])(
    'buildIdentityIndex 對同 text 是 deterministic',
    (text) => {
      const a = buildIdentityIndex(tokenize(text))
      const b = buildIdentityIndex(tokenize(text))
      expect(new Map(a)).toEqual(new Map(b))
    },
  )
})
