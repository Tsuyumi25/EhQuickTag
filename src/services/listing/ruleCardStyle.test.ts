import { describe, expect, it } from 'vitest'
import { createActions, createRule, createTagCondition, resolveRuleEffects, type FixedActions } from './fixedRulePrototype'
import { cardStyle, MAX_BLUR, MAX_MOSAIC, MIN_OPACITY, mosaicCell, mosaicFilterId, mosaicFiltersSvg } from './ruleCardStyle'

function effectsOf(actions: Partial<FixedActions>) {
  const rule = createRule(1)
  rule.root.conditions.push(createTagCondition('female:a'))
  rule.actions = { ...createActions(), ...actions }
  return resolveRuleEffects([rule], { tags: new Set(['female:a']), complete: true, rating: null, pages: null, category: null, uploader: null })
}

describe('cardStyle', () => {
  it('0 是不做，100 是最強的那一檔', () => {
    expect(cardStyle(effectsOf({})).modifiers).toEqual({ background: false, blur: false, dim: false, hidden: false })
    const strongest = cardStyle(effectsOf({ blur: 100, dim: 100 }))
    expect(strongest.modifiers).toMatchObject({ blur: true, dim: true })
    expect(strongest.vars['--eqt-rule-prototype-cover-filter']).toBe(`blur(${MAX_BLUR}px)`)
    expect(Number(strongest.vars['--eqt-rule-prototype-opacity'])).toBeCloseTo(MIN_OPACITY)
  })

  it('馬賽克引用的濾鏡一定定義過', () => {
    const defined = new Set([...mosaicFiltersSvg().matchAll(/id="([^"]+)"/g)].map(match => match[1]))
    for (let amount = 1; amount <= 100; amount++) {
      const id = mosaicFilterId(mosaicCell(amount))
      expect(cardStyle(effectsOf({ blur: amount, blurMode: 'mosaic' })).vars['--eqt-rule-prototype-cover-filter']).toBe(`url(#${id})`)
      expect(defined.has(id)).toBe(true)
    }
    expect(mosaicCell(100)).toBe(MAX_MOSAIC)
  })

  it('標題的樣式全部寫進變數，沒背景時不設圓角', () => {
    const { vars } = cardStyle(effectsOf({ titleColor: '#111111ff', strike: true, underline: true, bold: true, italic: true, titleRadius: 7 }))
    expect(vars).toMatchObject({
      '--eqt-rule-prototype-title-color': '#111111ff',
      '--eqt-rule-prototype-title-decoration': 'underline line-through',
      '--eqt-rule-prototype-title-weight': 'bold',
      '--eqt-rule-prototype-title-style': 'italic',
      '--eqt-rule-prototype-title-radius': null,
    })
    expect(cardStyle(effectsOf({ titleBackground: '#222222ff', titleRadius: 7 })).vars['--eqt-rule-prototype-title-radius']).toBe('7px')
  })
})
