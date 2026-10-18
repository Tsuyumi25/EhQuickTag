<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { t } from '@/composables/useI18n'
import { MAX_GROUP_DEPTH, type FixedRule } from '@/services/listing/fixedRulePrototype'
import { applyConditions, parseConditions, printConditions, type ExpressionError } from '@/services/listing/ruleExpression'

// 換規則時由上層換 key，草稿與錯誤跟著重來
const props = defineProps<{ rule: FixedRule }>()

const printed = computed(() => printConditions(props.rule.root))
const draft = ref(printed.value)
const editing = ref(false)
const parseError = ref<ExpressionError | null>(null)
const errorId = useId()
const rows = computed(() => Math.max(3, draft.value.split('\n').length))
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
</script>

<template>
  <div class="eqt-rule-page__source">
    <textarea
      v-model="draft" class="eqt-rule-page__source-input" :rows="rows"
      spellcheck="false" autocomplete="off" :aria-label="t('rulePagePrototype.expression.label')"
      :placeholder="t('rulePagePrototype.expression.placeholder')"
      :aria-invalid="!!parseError" :aria-describedby="parseError ? errorId : undefined"
      @focus="editing = true" @blur="onBlur" @input="onInput"
    />
    <p v-if="parseError" :id="errorId" class="eqt-rule-page__source-error" role="alert">{{ errorText }}</p>
  </div>
</template>
