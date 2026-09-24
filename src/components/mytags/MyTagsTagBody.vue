<script setup lang="ts">
import { computed } from 'vue'
import EqtNumberField from '@/components/EqtNumberField.vue'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import { t } from '@/composables/useI18n'
import { useTagLabel } from '@/composables/useTagLabel'
import type { TagState } from '@/services/mytagsEdits'
import { normalizeTagColor, tagChipStyle } from '@/services/mytagsColors'
import type { TagImpact } from '@/services/mytagsScore'

const props = withDefaults(defineProps<{
  full: string
  state: TagState
  setColor: string
  impact?: TagImpact
  selectable?: boolean
  showImpact?: boolean
}>(), {
  impact: undefined,
  selectable: false,
  showImpact: false,
})

const emit = defineEmits<{
  patch: [Partial<TagState>]
  select: []
}>()

const { label } = useTagLabel()

const chipStyle = computed(() => tagChipStyle({
  color: props.state.color,
  setColor: props.setColor,
  weight: props.state.weight,
  hidden: props.state.hidden,
}))

function colorPreview(): string {
  return props.state.color || props.setColor || chipStyle.value.background
}

function onColor(value: string | undefined): void {
  const color = normalizeTagColor(value ?? '')
  if (color !== null) emit('patch', { color })
}

function onHexInput(event: Event): void {
  const color = normalizeTagColor((event.target as HTMLInputElement).value)
  if (color !== null) emit('patch', { color })
}

function onHexBlur(event: Event): void {
  const input = event.target as HTMLInputElement
  input.value = normalizeTagColor(input.value) ?? props.state.color
}

function pct(part: number, total: number): string {
  return total ? `${(part / total * 100).toFixed(1)}%` : '0%'
}

function impactTitle(): string {
  return props.impact
    ? t('taglist.impact', { left: props.impact.left, right: props.impact.right })
    : t('taglist.impactNone')
}
</script>

<template>
  <div class="eqt-taglist__body">
    <div class="eqt-taglist__top">
      <slot name="tag">
        <component
          :is="selectable ? 'button' : 'span'"
          :type="selectable ? 'button' : undefined"
          class="eqt-taglist__chip"
          :class="{ 'eqt-taglist__chip--static': !selectable }"
          :style="chipStyle"
          :title="full"
          @click="selectable && emit('select')"
        >
          <span v-if="full" class="eqt-taglist__ns">{{ label(full).nsLabel }}:</span>
          <span v-if="full" class="eqt-taglist__label">{{ label(full).display }}</span>
          <span v-else class="eqt-taglist__label">{{ t('manage.newTag') }}</span>
        </component>
      </slot>
      <span class="eqt-taglist__color-control">
        <LineColorSwatch
          class="eqt-taglist__color-swatch"
          :model-value="state.color || undefined"
          :alpha="false"
          :style="{ '--eqt-tag-color-preview': colorPreview(), '--eqt-tag-color-border': chipStyle.borderColor }"
          :title="t('panel.colorHint')"
          @update:model-value="onColor"
        />
        <input
          class="eqt-taglist__input eqt-taglist__color"
          type="text"
          :value="state.color"
          placeholder="#default"
          maxlength="7"
          pattern="#?[0-9A-Fa-f]{6}"
          spellcheck="false"
          autocomplete="off"
          :aria-label="t('panel.colorHint')"
          :title="t('panel.colorHint')"
          @input="onHexInput"
          @blur="onHexBlur"
          @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
        >
      </span>
    </div>

    <div class="eqt-taglist__controls">
      <label class="eqt-taglist__flag" :title="t('panel.toggleWatch')">
        <input
          type="checkbox"
          :checked="state.watch"
          @change="emit('patch', { watch: ($event.target as HTMLInputElement).checked })"
        >
        {{ t('panel.labelWatch') }}
      </label>
      <label class="eqt-taglist__flag" :title="t('panel.toggleHidden')">
        <input
          type="checkbox"
          :checked="state.hidden"
          @change="emit('patch', { hidden: ($event.target as HTMLInputElement).checked })"
        >
        {{ t('panel.labelHidden') }}
      </label>

      <span class="eqt-panel__spacer" />

      <EqtNumberField
        :model-value="state.weight"
        :min="-99"
        :max="99"
        :disabled="state.hidden"
        :label="t('panel.weightHint')"
        @update:model-value="emit('patch', { weight: $event })"
      />
    </div>

    <span
      v-if="showImpact"
      class="eqt-taglist__impact"
      role="img"
      :aria-label="impactTitle()"
      :title="impactTitle()"
    >
      <span class="eqt-taglist__impact-count" aria-hidden="true">{{ impact?.left ?? 0 }}</span>
      <span class="eqt-taglist__bar" aria-hidden="true">
        <i
          class="eqt-taglist__neg"
          :style="{ width: pct(impact?.left ?? 0, impact?.total ?? 0) }"
        />
        <i
          class="eqt-taglist__pos"
          :style="{ width: pct(impact?.right ?? 0, impact?.total ?? 0) }"
        />
      </span>
      <span class="eqt-taglist__impact-count" aria-hidden="true">{{ impact?.right ?? 0 }}</span>
    </span>
  </div>
</template>
