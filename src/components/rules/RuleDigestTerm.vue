<script setup lang="ts">
import TagChip from '@/components/TagChip.vue'
import RuleDigestPhrase from './RuleDigestPhrase.vue'
import RuleRangeValue from './RuleRangeValue.vue'
import { categoryChipStyle } from './categoryChip'
import { RANGE_FIELD_ICONS } from './rangeFieldIcons'
import { useRuleTagView } from '@/composables/useRuleTagView'
import { t } from '@/composables/useI18n'
import { CATEGORY_LABELS } from '@/services/listing/galleryCategory'
import { formatAverage, type DigestTerm } from '@/services/listing/ruleDigest'

const props = defineProps<{ term: DigestTerm }>()
const view = useRuleTagView(() => (props.term.kind === 'tag' ? props.term.tag : ''))
</script>

<template>
  <RuleDigestPhrase
    v-if="term.kind === 'tag'"
    :text-key="term.exclude ? 'rulePagePrototype.digest.lacks' : undefined"
  >
    <TagChip
      class="eqt-rule-page__digest-chip" :full="term.tag" :display="view.text" :icon-url="view.iconUrl" :colors="view.colors"
      :show-score="false" :show-marks="false" :title="term.tag"
    />
  </RuleDigestPhrase>
  <RuleDigestPhrase v-else-if="term.kind === 'category'" :text-key="term.exclude ? 'rulePagePrototype.digest.lacks' : undefined">
    <TagChip
      class="eqt-rule-page__digest-chip eqt-gallery-chip--mytags-colored" :style="categoryChipStyle(term.category)"
      :full="`category:${term.category}`" :display="CATEGORY_LABELS[term.category]" :show-score="false" :show-marks="false"
    />
  </RuleDigestPhrase>
  <span v-else-if="term.kind === 'range'" class="eqt-rule-page__digest-range">
    <component
      :is="RANGE_FIELD_ICONS[term.field]" v-if="term.field !== 'rating'"
      class="eqt-rule-page__icon" :aria-label="t(`rulePagePrototype.${term.field}`)"
    />
    {{ term.exclude ? '∉' : '' }}<RuleRangeValue :field="term.field" :range="term.range" />
    <small v-if="term.field === 'rating'" class="eqt-rule-page__digest-average">
      {{ t('rulePagePrototype.digest.average', { range: formatAverage(term.range) }) }}
    </small>
  </span>
  <span v-else class="eqt-rule-page__digest-group" :class="`eqt-rule-page__digest-group--${term.kind}`">
    <RuleDigestTerm v-for="(child, index) in term.terms" :key="index" :term="child" />
  </span>
</template>
