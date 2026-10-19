import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { sortByNamespace } from './tagGroups'

const namespaceOf = (tag: string) => tag.includes(':') ? tag.slice(0, tag.indexOf(':')) : ''

const tagsArb = fc.array(
  fc.tuple(fc.constantFrom('female', 'male', 'parody', 'language', ''), fc.nat(5))
    .map(([namespace, n]) => (namespace ? `${namespace}:t${n}` : `t${n}`)),
)

describe('sortByNamespace', () => {
  const ORDER = ['female', 'male', 'uploader']

  it('照給的順序排，不在裡面的放最後', () => {
    expect(sortByNamespace(['uploader:u', 'female:a', 'parody:p', 'male:m', 'female:b', 'uploader:v'], namespaceOf, ORDER))
      .toEqual(['female:a', 'female:b', 'male:m', 'uploader:u', 'uploader:v', 'parody:p'])
  })

  test.prop([tagsArb])('只換順序不增減，同一個 namespace 裡維持原本的先後，排過再排不變', (tags) => {
    const sorted = sortByNamespace(tags, namespaceOf, ORDER)
    expect([...sorted].sort()).toEqual([...tags].sort())
    for (const namespace of new Set(tags.map(namespaceOf))) {
      expect(sorted.filter(tag => namespaceOf(tag) === namespace)).toEqual(tags.filter(tag => namespaceOf(tag) === namespace))
    }
    expect(sortByNamespace(sorted, namespaceOf, ORDER)).toEqual(sorted)
  })
})
