// 摘要的「複製」：畫面上的分行照同一套字串寫成 Markdown，貼到別處不看畫面也讀得懂。
// 標籤一律寫原始的 namespace:tag 並包在反引號裡，翻譯後的顯示名稱不夠精確，貼給別人或 AI 時會對不上

import type { FixedActions, FixedRule } from '@/services/listing/fixedRulePrototype'
import { CATEGORY_LABELS } from './galleryCategory'
import { formatAverage, formatRange, rangeTerms, type DigestNote, type DigestTerm, type RuleDigest } from './ruleDigest'

export type Translate = (key: string, params?: Record<string, string | number>) => string

const code = (text: string) => `\`${text}\``

/** 譯文裡的 {items} 換成已經寫好的 Markdown 片段 */
function phrase(tr: Translate, key: string, items: string, params?: Record<string, string | number>): string {
  return tr(key, { ...params, items: '{items}' }).replace('{items}', items)
}

function rangeText(tr: Translate, term: Extract<DigestTerm, { kind: 'range' }>): string {
  const value = code(formatRange(term.field, term.range))
  const average = term.field === 'rating' ? ` (${tr('rulePagePrototype.digest.average', { range: formatAverage(term.range) })})` : ''
  return `${value}${average}`
}

export function termMarkdown(tr: Translate, term: DigestTerm): string {
  if (term.kind === 'tag') return term.exclude ? phrase(tr, 'rulePagePrototype.digest.lacks', code(term.tag)) : code(term.tag)
  if (term.kind === 'category') {
    const label = code(CATEGORY_LABELS[term.category])
    return term.exclude ? phrase(tr, 'rulePagePrototype.digest.lacks', label) : label
  }
  if (term.kind === 'range') {
    return `${tr(`rulePagePrototype.${term.field}`)} ${term.exclude ? '∉ ' : ''}${rangeText(tr, term)}`
  }
  return `(${term.terms.map(child => termMarkdown(tr, child)).join(term.kind === 'all' ? ' AND ' : ' OR ')})`
}

export function actionsMarkdown(tr: Translate, actions: FixedActions): string {
  if (actions.hide) return tr('rulePagePrototype.hideShort')
  const parts: string[] = []
  if (actions.background) parts.push(tr('rulePagePrototype.backgroundIs', { color: code(actions.background) }))
  if (actions.blur) parts.push(tr('rulePrototype.blur'))
  if (actions.showName) parts.push(tr('rulePagePrototype.showNameShort'))
  if (actions.titlePrefix) parts.push(tr('rulePagePrototype.titlePrefixIs', { prefix: code(actions.titlePrefix) }))
  if (actions.strike) parts.push(tr('rulePagePrototype.strikeShort'))
  if (actions.dim) parts.push(tr('rulePagePrototype.dimShort'))
  return parts.length ? parts.join(tr('rulePagePrototype.digest.clauseSep')) : tr('rulePagePrototype.noAction')
}

export function noteTerms(note: DigestNote): DigestTerm[] {
  if (note.kind === 'conflict') return note.tags.map(tag => ({ kind: 'tag', tag, exclude: false }))
  if (note.kind === 'categoryConflict') return note.categories.map(category => ({ kind: 'category', category, exclude: false }))
  if (note.kind === 'rangeMerged') return [{ kind: 'range', field: note.field, range: note.range, exclude: false }]
  return note.kind === 'groupImpossible' || note.kind === 'groupRedundant' ? note.terms : []
}

export function noteParams(tr: Translate, note: DigestNote): Record<string, string> | undefined {
  if (note.kind !== 'rangeEmpty' && note.kind !== 'rangeExcluded' && note.kind !== 'rangeMerged') return undefined
  return { field: tr(`rulePagePrototype.${note.field}`) }
}

function notesMarkdown(tr: Translate, digest: RuleDigest): string[] {
  return digest.notes.map(note => `> ${phrase(
    tr, `rulePagePrototype.digest.note.${note.kind}`, noteTerms(note).map(term => termMarkdown(tr, term)).join(' '), noteParams(tr, note),
  )}`)
}

function document(rule: FixedRule, body: string[], tr: Translate, digest: RuleDigest): string {
  const notes = notesMarkdown(tr, digest)
  return [`### ${rule.name}`, '', ...body, ...(notes.length ? ['', ...notes] : [])].join('\n')
}

function row(label: string, items: string): string {
  return `- **${label}** — ${items}`
}

export function rowsMarkdown(tr: Translate, rule: FixedRule, digest: RuleDigest): string {
  const lines: string[] = []
  const must = [
    ...digest.categories.map(category => code(CATEGORY_LABELS[category])),
    ...digest.tags.map(code),
    ...rangeTerms(digest.ranges).map(term => termMarkdown(tr, term)),
  ]
  if (must.length) lines.push(row(tr('rulePagePrototype.digest.must'), must.join(' ')))
  for (const group of digest.groups) lines.push(row(tr('rulePagePrototype.digest.any'), group.map(term => termMarkdown(tr, term)).join(' ')))
  if (digest.unless.length) lines.push(row(tr('rulePagePrototype.digest.none'), digest.unless.map(term => termMarkdown(tr, term)).join(' ')))
  lines.push(row(tr('rulePrototype.actions'), actionsMarkdown(tr, rule.actions)))
  return document(rule, lines, tr, digest)
}
