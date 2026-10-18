<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
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
const input = ref<HTMLTextAreaElement | null>(null)
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

// 高度跟著內容走：換行與自動折行都算。offsetHeight − clientHeight 是上下框線，
// border-box 下 scrollHeight 不含框線，少了這段會多出一條捲軸
function fitHeight() {
  const el = input.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
}
watch(draft, () => nextTick(fitHeight))
onMounted(fitHeight)
// 寬度變了折行就跟著變；只看寬度，自己改高度觸發的那次不必再量
let measuredWidth = 0
useResizeObserver(input, ([entry]) => {
  if (entry.contentRect.width === measuredWidth) return
  measuredWidth = entry.contentRect.width
  fitHeight()
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
      ref="input" v-model="draft" class="eqt-rule-page__source-input" rows="2"
      spellcheck="false" autocomplete="off" :aria-label="t('rulePagePrototype.expression.label')"
      :placeholder="t('rulePagePrototype.expression.placeholder')"
      :aria-invalid="!!parseError" :aria-describedby="parseError ? errorId : undefined"
      @focus="editing = true" @blur="onBlur" @input="onInput"
    />
    <p v-if="parseError" :id="errorId" class="eqt-rule-page__source-error" role="alert">{{ errorText }}</p>
  </div>
</template>
