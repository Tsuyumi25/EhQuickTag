import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { groupByNamespace, namespaceOf } from './tagGroups'

const tagsArb = fc.array(
  fc.tuple(fc.constantFrom('female', 'male', 'parody', 'language', ''), fc.nat(5))
    .map(([namespace, n]) => (namespace ? `${namespace}:t${n}` : `t${n}`)),
)

describe('groupByNamespace', () => {
  it('列的先後照每個 namespace 第一次出現的位置', () => {
    expect(groupByNamespace(['language:x', 'female:a', 'misc', 'language:y', 'female:b'], namespaceOf)).toEqual([
      { namespace: 'language', items: ['language:x', 'language:y'] },
      { namespace: 'female', items: ['female:a', 'female:b'] },
      { namespace: '', items: ['misc'] },
    ])
  })

  test.prop([tagsArb])('攤平回去就是原本的標籤，同一列裡照原本的先後', (tags) => {
    const groups = groupByNamespace(tags, namespaceOf)
    expect(groups.flatMap(group => group.items).sort()).toEqual([...tags].sort())
    for (const group of groups) {
      expect(group.items).toEqual(tags.filter(tag => namespaceOf(tag) === group.namespace))
    }
    expect(new Set(groups.map(group => group.namespace)).size).toBe(groups.length)
  })
})
