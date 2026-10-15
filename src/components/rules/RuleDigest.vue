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
  digestRule, NEVER_NOTES, rangeTerms, ruleExpression, type DigestMode, type DigestTerm,
} from '@/services/listing/ruleDigest'
import { noteParams, noteTerms, rowsMarkdown } from '@/services/listing/ruleDigestMarkdown'

const props = defineProps<{ rule: FixedRule }>()
const MODES: readonly DigestMode[] = ['rows', 'raw']
const expression = computed(() => ruleExpression(props.rule))
const clipboard = useClipboard({ legacy: true })

const digest = computed(() => digestRule(props.rule))
const mustTerms = computed((): DigestTerm[] => [
  ...digest.value.categories.map(category => ({ kind: 'category', category, exclude: false }) satisfies DigestTerm),
  ...digest.value.tags.map(tag => ({ kind: 'tag', tag, exclude: false }) satisfies DigestTerm),
])
const mustRanges = computed(() => rangeTerms(digest.value.ranges))
const hasMust = computed(() => mustTerms.value.length > 0 || mustRanges.value.length > 0)

// 原始算式複製的就是畫面上那段；分行寫成 Markdown，貼到別處不看畫面也讀得懂
function copyCurrent() {
  clipboard.copy(ruleDigestMode.value === 'raw' ? expression.value : rowsMarkdown(t, props.rule, digest.value))
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
      <button
        type="button" class="eqt-rule-page__digest-copy"
        :title="t(clipboard.copied.value ? 'settings.editorCopied' : 'settings.editorCopy')"
        :aria-label="t(clipboard.copied.value ? 'settings.editorCopied' : 'settings.editorCopy')"
        @click="copyCurrent"
      ><component :is="clipboard.copied.value ? Check : Copy" class="eqt-rule-page__icon" /></button>
    </div>

    <div v-if="ruleDigestMode === 'raw'" class="eqt-rule-page__digest">
      <pre class="eqt-rule-page__digest-raw">{{ expression }}</pre>
    </div>

    <div v-else class="eqt-rule-page__digest" :class="{ 'eqt-rule-page__digest--never': digest.never }">
      <dl class="eqt-rule-page__digest-rows">
        <div v-if="hasMust" class="eqt-rule-page__digest-row eqt-rule-page__digest-row--all">
          <dt>{{ t('rulePagePrototype.digest.must') }}</dt>
          <dd>
            <RuleDigestTerm v-for="(term, index) in mustTerms" :key="`must-${index}`" :term="term" />
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
        <div class="eqt-rule-page__digest-row eqt-rule-page__digest-row--action">
          <dt>{{ t('rulePrototype.actions') }}</dt>
          <dd><RuleActionSummary class="eqt-rule-page__digest-action" v-bind="rule.actions" verbose /></dd>
        </div>
      </dl>

      <ul v-if="digest.notes.length" class="eqt-rule-page__digest-notes">
        <li
          v-for="(note, index) in digest.notes" :key="index"
          :class="{ 'eqt-rule-page__digest-note--never': NEVER_NOTES[note.kind] }"
        >
          <RuleDigestPhrase
            :text-key="`rulePagePrototype.digest.note.${note.kind}`"
            :params="noteParams(t, note)"
          >
            <RuleDigestTerm v-for="(term, termIndex) in noteTerms(note)" :key="termIndex" :term="term" />
          </RuleDigestPhrase>
        </li>
      </ul>
    </div>
  </section>
</template>
