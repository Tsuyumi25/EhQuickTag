<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { Check, Copy, ScrollText } from '@lucide/vue'
import RuleActionSummary from './RuleActionSummary.vue'
import RuleDigestPhrase from './RuleDigestPhrase.vue'
import RuleDigestTerm from './RuleDigestTerm.vue'
import { t } from '@/composables/useI18n'
import { ruleDigestMode } from '@/services/appOverlays'
import type { FixedRule } from '@/services/listing/fixedRulePrototype'
import {
  caseOutcome, digestCases, digestRule, NEVER_NOTES, rangeTerms, ruleExpression, type DigestMode, type DigestNote, type DigestTerm,
} from '@/services/listing/ruleDigest'

const props = defineProps<{ rule: FixedRule }>()
const MODES: readonly DigestMode[] = ['sentence', 'rows', 'cases', 'raw']
const expression = computed(() => ruleExpression(props.rule))
const clipboard = useClipboard({ legacy: true })

const digest = computed(() => digestRule(props.rule))
const mustTerms = computed((): DigestTerm[] => digest.value.tags.map(tag => ({ kind: 'tag', tag, exclude: false })))
const mustRanges = computed(() => rangeTerms(digest.value.ranges))
const cases = computed(() => (ruleDigestMode.value === 'cases' ? digestCases(digest.value) : null))
const caseOutcomes = computed(() => cases.value?.cases.map(item => caseOutcome(props.rule, item)) ?? [])
const hasMust = computed(() => digest.value.tags.length > 0 || mustRanges.value.length > 0)

function noteTerms(note: DigestNote): DigestTerm[] {
  if (note.kind === 'conflict') return note.tags.map(tag => ({ kind: 'tag', tag, exclude: false }))
  if (note.kind === 'rangeMerged') return [{ kind: 'range', field: note.field, range: note.range, exclude: false }]
  return note.kind === 'groupImpossible' || note.kind === 'groupRedundant' ? note.terms : []
}

function noteParams(note: DigestNote): Record<string, string> | undefined {
  if (note.kind !== 'rangeEmpty' && note.kind !== 'rangeExcluded' && note.kind !== 'rangeMerged') return undefined
  return { field: t(`rulePagePrototype.${note.field}`) }
}
</script>

<template>
  <section class="eqt-rule-page__section">
    <div class="eqt-rule-page__digest-head">
      <h2><ScrollText class="eqt-rule-page__icon" />{{ t('rulePagePrototype.summary') }}</h2>
      <div class="eqt-rule-page__digest-modes" role="group" :aria-label="t('rulePagePrototype.digest.mode')">
        <button
          v-for="mode in MODES" :key="mode" type="button" class="eqt-rule-page__digest-mode"
          :aria-pressed="ruleDigestMode === mode" @click="ruleDigestMode = mode"
        >{{ t(`rulePagePrototype.digest.mode.${mode}`) }}</button>
      </div>
    </div>

    <div v-if="ruleDigestMode === 'raw'" class="eqt-rule-page__digest eqt-rule-page__digest--raw">
      <pre class="eqt-rule-page__digest-raw">{{ expression }}</pre>
      <button
        type="button" class="eqt-rule-page__digest-copy"
        :title="t(clipboard.copied.value ? 'settings.editorCopied' : 'settings.editorCopy')"
        :aria-label="t(clipboard.copied.value ? 'settings.editorCopied' : 'settings.editorCopy')"
        @click="clipboard.copy(expression)"
      ><component :is="clipboard.copied.value ? Check : Copy" class="eqt-rule-page__icon" /></button>
    </div>

    <div v-else class="eqt-rule-page__digest" :class="{ 'eqt-rule-page__digest--never': digest.never }">
      <p v-if="ruleDigestMode === 'sentence'" class="eqt-rule-page__digest-sentence">
        <template v-if="digest.tags.length">
          <RuleDigestPhrase text-key="rulePagePrototype.digest.has">
            <RuleDigestTerm v-for="term in mustTerms" :key="term.kind === 'tag' ? term.tag : ''" :term="term" />
          </RuleDigestPhrase>
        </template>
        <template v-for="(term, index) in mustRanges" :key="`range-${index}`">
          <template v-if="digest.tags.length || index">{{ t('rulePagePrototype.digest.clauseSep') }}</template>
          <RuleDigestTerm :term="term" phrase />
        </template>
        <template v-for="(group, index) in digest.groups" :key="`group-${index}`">
          <template v-if="hasMust || index">{{ t('rulePagePrototype.digest.clauseSep') }}</template>
          <RuleDigestPhrase text-key="rulePagePrototype.digest.anyOf">
            <RuleDigestTerm v-for="(term, termIndex) in group" :key="termIndex" :term="term" />
          </RuleDigestPhrase>
        </template>
        <template v-if="digest.unless.length">
          <template v-if="hasMust || digest.groups.length">{{ t('rulePagePrototype.digest.clauseSep') }}</template>
          <RuleDigestPhrase text-key="rulePagePrototype.digest.unless">
            <template v-for="(term, index) in digest.unless" :key="index">
              <template v-if="index"> {{ t('rulePagePrototype.digest.or') }} </template>
              <RuleDigestTerm :term="term" phrase />
            </template>
          </RuleDigestPhrase>
        </template>
        <template v-if="hasMust || digest.groups.length || digest.unless.length">{{ t('rulePagePrototype.digest.end') }}</template>
      </p>

      <dl v-else-if="ruleDigestMode === 'rows'" class="eqt-rule-page__digest-rows">
        <div v-if="hasMust" class="eqt-rule-page__digest-row eqt-rule-page__digest-row--all">
          <dt>{{ t('rulePagePrototype.digest.must') }}</dt>
          <dd>
            <RuleDigestTerm v-for="term in mustTerms" :key="term.kind === 'tag' ? term.tag : ''" :term="term" />
            <RuleDigestTerm v-for="(term, index) in mustRanges" :key="`range-${index}`" :term="term" />
          </dd>
        </div>
        <div v-for="(group, index) in digest.groups" :key="index" class="eqt-rule-page__digest-row eqt-rule-page__digest-row--any">
          <dt>{{ t('rulePagePrototype.digest.any') }}</dt>
          <dd><RuleDigestTerm v-for="(term, termIndex) in group" :key="termIndex" :term="term" /></dd>
        </div>
        <div v-if="digest.unless.length" class="eqt-rule-page__digest-row eqt-rule-page__digest-row--none">
          <dt>{{ t('rulePagePrototype.digest.none') }}</dt>
          <dd><RuleDigestTerm v-for="(term, index) in digest.unless" :key="index" :term="term" /></dd>
        </div>
      </dl>

      <template v-else-if="cases">
        <p class="eqt-rule-page__digest-caption">{{ t('rulePagePrototype.digest.cases', { n: cases.total }) }}</p>
        <ol class="eqt-rule-page__digest-cases">
          <li
            v-for="(item, index) in cases.cases" :key="index"
            :class="{ 'eqt-rule-page__digest-case--impossible': item.impossible }"
          >
            <RuleDigestTerm v-for="(term, termIndex) in item.terms" :key="termIndex" :term="term" />
            <span v-if="caseOutcomes[index]" class="eqt-rule-page__digest-outcome">
              <span aria-hidden="true">→</span><RuleActionSummary v-bind="caseOutcomes[index]!" />
            </span>
            <small v-if="item.impossible">{{ t('rulePagePrototype.digest.impossible') }}</small>
          </li>
        </ol>
        <p v-if="cases.total > cases.cases.length" class="eqt-rule-page__digest-caption">
          {{ t('rulePagePrototype.digest.more', { n: cases.total - cases.cases.length }) }}
        </p>
        <dl v-if="digest.unless.length" class="eqt-rule-page__digest-rows">
          <div class="eqt-rule-page__digest-row eqt-rule-page__digest-row--none">
            <dt>{{ t('rulePagePrototype.digest.none') }}</dt>
            <dd><RuleDigestTerm v-for="(term, index) in digest.unless" :key="index" :term="term" /></dd>
          </div>
        </dl>
      </template>

      <ul v-if="digest.notes.length" class="eqt-rule-page__digest-notes">
        <li
          v-for="(note, index) in digest.notes" :key="index"
          :class="{ 'eqt-rule-page__digest-note--never': NEVER_NOTES[note.kind] }"
        >
          <RuleDigestPhrase
            :text-key="`rulePagePrototype.digest.note.${note.kind}`"
            :params="noteParams(note)"
          >
            <RuleDigestTerm v-for="(term, termIndex) in noteTerms(note)" :key="termIndex" :term="term" />
          </RuleDigestPhrase>
        </li>
      </ul>
    </div>
  </section>
</template>
