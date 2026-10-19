<script setup lang="ts">
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import { parseColorInput } from '@/services/color'

// 跟 My Tags 的標籤顏色同一組：色盤選、或直接貼色碼；色碼框留空就是不指定
defineProps<{ label: string }>()
const color = defineModel<string | null>({ required: true })

function onHexInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (!raw.trim()) color.value = null
  else {
    const parsed = parseColorInput(raw, true)
    if (parsed) color.value = parsed
  }
}

function resetInput(event: Event) {
  (event.target as HTMLInputElement).value = color.value ?? ''
}
</script>

<template>
  <span class="eqt-rule-page__field">
    <span>{{ label }}</span>
    <span class="eqt-rule-page__color-control">
      <LineColorSwatch
        class="eqt-rule-page__color-swatch"
        :model-value="color ?? undefined"
        :style="color ? { '--eqt-rule-page-color-preview': color } : undefined"
        :title="label"
        @update:model-value="color = $event ?? null"
      />
      <input
        class="eqt-rule-page__input eqt-rule-page__color" type="text" :value="color ?? ''"
        placeholder="#rrggbbaa" maxlength="9" spellcheck="false" autocomplete="off" :aria-label="label"
        @input="onHexInput" @blur="resetInput" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      >
    </span>
  </span>
</template>
