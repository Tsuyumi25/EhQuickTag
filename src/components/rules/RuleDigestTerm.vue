<script setup lang="ts">
import TagChip from '@/components/TagChip.vue'
import RuleDigestPhrase from './RuleDigestPhrase.vue'
import RuleRangeValue from './RuleRangeValue.vue'
import { RANGE_FIELD_ICONS } from './rangeFieldIcons'
import { useRuleTagView } from '@/composables/useRuleTagView'
import { t } from '@/composables/useI18n'
import { formatAverage, type DigestTerm } from '@/services/listing/ruleDigest'

// phrase：放進句子時帶上動詞或欄位名（含有／同時含有／頁數），列表裡只放 chip 與圖示
const props = defineProps<{ term: DigestTerm; phrase?: boolean }>()
const view = useRuleTagView(() => (props.term.kind === 'tag' ? props.term.tag : ''))
</script>

<template>
  <RuleDigestPhrase
    v-if="term.kind === 'tag'"
    :text-key="term.exclude ? 'rulePagePrototype.digest.lacks' : phrase ? 'rulePagePrototype.digest.has' : undefined"
  >
    <TagChip
      class="eqt-rule-page__digest-chip" :full="term.tag" :display="view.text" :icon-url="view.iconUrl" :colors="view.colors"
      :show-score="false" :show-marks="false" :title="term.tag"
    />
  </RuleDigestPhrase>
  <span v-else-if="term.kind === 'range'" class="eqt-rule-page__digest-range">
    <RuleDigestPhrase
      v-if="phrase && !term.exclude" text-key="rulePagePrototype.digest.range"
      :params="{ field: t(`rulePagePrototype.${term.field}`) }"
    >
      <RuleRangeValue :field="term.field" :range="term.range" />
    </RuleDigestPhrase>
    <template v-else>
      <component
        :is="RANGE_FIELD_ICONS[term.field]" v-if="term.field !== 'rating'"
        class="eqt-rule-page__icon" :aria-label="t(`rulePagePrototype.${term.field}`)"
      />
      {{ term.exclude ? '∉' : '' }}<RuleRangeValue :field="term.field" :range="term.range" />
    </template>
    <small v-if="term.field === 'rating'" class="eqt-rule-page__digest-average">
      {{ t('rulePagePrototype.digest.average', { range: formatAverage(term.range) }) }}
    </small>
  </span>
  <RuleDigestPhrase v-else-if="term.kind === 'all' && phrase" text-key="rulePagePrototype.digest.hasAll">
    <RuleDigestTerm v-for="(child, index) in term.terms" :key="index" :term="child" />
  </RuleDigestPhrase>
  <span v-else class="eqt-rule-page__digest-group" :class="`eqt-rule-page__digest-group--${term.kind}`">
    <RuleDigestTerm v-for="(child, index) in term.terms" :key="index" :term="child" />
  </span>
</template>
