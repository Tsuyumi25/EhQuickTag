<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { Check, Copy, ScrollText } from '@lucide/vue'
import RuleActionSummary from './RuleActionSummary.vue'
import RuleDigestPhrase from './RuleDigestPhrase.vue'
import RuleDigestTerm from './RuleDigestTerm.vue'
import { t } from '@/composables/useI18n'
import { ruleDigestMode } from '@/services/appOverlays'
import { MAX_GROUP_DEPTH, type FixedRule } from '@/services/listing/fixedRulePrototype'
import {
  actionsExpression, digestRule, NEVER_NOTES, rangeTerms, ruleExpression, type DigestMode, type DigestTerm,
} from '@/services/listing/ruleDigest'
import { noteParams, noteTerms, rowsMarkdown } from '@/services/listing/ruleDigestMarkdown'
import { applyConditions, parseConditions, printConditions, type ExpressionError } from '@/services/listing/ruleExpression'

const props = defineProps<{ rule: FixedRule }>()
const MODES: readonly DigestMode[] = ['rows', 'raw']
const expression = computed(() => ruleExpression(props.rule))
const clipboard = useClipboard({ legacy: true })

const printed = computed(() => printConditions(props.rule.root))
const actionsLine = computed(() => actionsExpression(props.rule.actions))
const draft = ref(printed.value)
const editing = ref(false)
const parseError = ref<ExpressionError | null>(null)
const errorId = useId()
const rows = computed(() => Math.max(2, draft.value.split('\n').length))
const errorText = computed(() => parseError.value && t('rulePagePrototype.expression.errorAt', {
  at: parseError.value.at + 1,
  message: t(`rulePagePrototype.expression.error.${parseError.value.kind}`, { text: parseError.value.text, max: MAX_GROUP_DEPTH }),
}))

// 打字途中讀得懂的文字會立刻換掉條件樹，printed 也跟著變；這時不能拿標準寫法蓋掉使用者正在打的字
watch(printed, (value) => {
  if (editing.value) return
  draft.value = value
  parseError.value = null
})
watch(() => props.rule.id, () => {
  draft.value = printed.value
  parseError.value = null
})

function onInput() {
  const result = parseConditions(draft.value)
  if (!result.ok) {
    parseError.value = result.error
    return
  }
  parseError.value = null
  const root = applyConditions(result.root, props.rule.root)
  // 只差在空白、換行或 - 與 NOT 這種寫法時不換樹：印不出差別的結構（例如只有一個條件的群組是 AND 還是 OR）照舊留著
  if (printConditions(root) !== printed.value) props.rule.root = root
}

// 離開時換成標準寫法；寫到一半有錯就留著，回來還能接著改
function onBlur() {
  editing.value = false
  if (!parseError.value) draft.value = printed.value
}

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
      <textarea
        v-model="draft" class="eqt-rule-page__digest-raw eqt-rule-page__digest-editor" :rows="rows"
        spellcheck="false" autocomplete="off" :aria-label="t('rulePagePrototype.expression.label')"
        :placeholder="t('rulePagePrototype.expression.placeholder')"
        :aria-invalid="!!parseError" :aria-describedby="parseError ? errorId : undefined"
        @focus="editing = true" @blur="onBlur" @input="onInput"
      />
      <p v-if="parseError" :id="errorId" class="eqt-rule-page__digest-error" role="alert">{{ errorText }}</p>
      <pre v-if="actionsLine" class="eqt-rule-page__digest-raw">=> {{ actionsLine }}</pre>
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
