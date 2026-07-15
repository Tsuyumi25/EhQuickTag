<script setup lang="ts">
import { ref, computed } from 'vue'
import { Settings } from '@lucide/vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import type { Line, LineTextAlign, SeparatorStyle } from '@/types'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  line: Line
  embedded?: boolean
  defaultTextAlign?: LineTextAlign
}>()
const emit = defineEmits<{ 'update:line': [value: Line] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)

// 顯示用：沒設過的欄位 fallback 到「視覺預設值」（跟 CSS 預設保持一致）
// 這些 fallback 只給 UI 顯示用，不寫進資料。
const lineStyleValue = computed<SeparatorStyle['line']>(() => props.line.kind === 'separator' ? props.line.style?.line ?? 'solid' : 'solid')
const linePositionValue = computed<SeparatorStyle['linePosition']>(() => props.line.kind === 'separator' ? props.line.style?.linePosition ?? 'middle' : 'middle')
const textAlignValue = computed(() => props.line.style?.textAlign ?? props.defaultTextAlign ?? 'left')
const usesDefaultTextAlign = computed(() => props.line.style?.textAlign === undefined)
const textSizeValue = computed<number>(() => props.line.kind === 'separator' ? props.line.style?.textSize ?? 10 : 10)
const lineThicknessValue = computed<number>(() => props.line.kind === 'separator' ? props.line.style?.lineThickness ?? 2 : 2)
const lineLengthValue = computed<number>(() => props.line.kind === 'separator' ? props.line.style?.lineLength ?? 100 : 100)
const canReset = computed(() => props.line.style !== undefined && Object.keys(props.line.style).length > 0)

function updateStyle(patch: Partial<SeparatorStyle>) {
  if (props.line.kind === 'buttons') {
    const style = { ...props.line.style, ...(patch.textAlign ? { textAlign: patch.textAlign } : {}) }
    emit('update:line', {
      ...props.line,
      style: Object.keys(style).length ? style : undefined,
    })
    return
  }
  const merged: SeparatorStyle = { ...props.line.style, ...patch }
  emit('update:line', {
    ...props.line,
    style: Object.keys(merged).length ? merged : undefined,
  })
}

function clearTextAlign(): void {
  if (!props.line.style) return
  const style = { ...props.line.style }
  delete style.textAlign
  emit('update:line', {
    ...props.line,
    style: Object.keys(style).length ? style : undefined,
  })
}

function resetLayout(): void {
  emit('update:line', {
    ...props.line,
    style: undefined,
  })
}
</script>

<template>
  <button
    v-if="!embedded"
    ref="triggerEl"
    type="button"
    class="eqt-line-sep__trigger"
    :title="t('tagbar.separatorSettings')"
    @click="open = !open"
  >
    <Settings :size="12" />
  </button>
  <component :is="embedded ? 'div' : AnchoredPopover" v-model:open="open" :anchor="triggerEl">
    <div class="eqt-line-sep__popup" :class="{ 'eqt-line-sep__popup--embedded': embedded }">
      <div class="eqt-line-sep__field">
        <span class="eqt-line-sep__field-label">{{ line.kind === 'buttons' ? t('tagbar.lineAlign') : t('tagbar.separatorTextAlign') }}</span>
        <div class="eqt-line-sep__options eqt-line-sep__options--four">
          <button
            type="button"
            class="eqt-line-sep__option"
            :class="{ 'eqt-line-sep__option--active': usesDefaultTextAlign }"
            :title="t('tagbar.lineAlignGlobal', { align: t(`tagbar.separatorTextAlign_${defaultTextAlign ?? 'left'}`) })"
            @click="clearTextAlign"
          >{{ t('tagbar.lineAlignDefault') }}</button>
          <button
            v-for="opt in (['left', 'center', 'right'] as const)"
            :key="opt"
            type="button"
            class="eqt-line-sep__option"
            :class="{ 'eqt-line-sep__option--active': !usesDefaultTextAlign && textAlignValue === opt }"
            @click="updateStyle({ textAlign: opt })"
          >{{ t(`tagbar.separatorTextAlign_${opt}`) }}</button>
        </div>
      </div>
      <template v-if="line.kind === 'separator'">
        <div class="eqt-line-sep__field">
          <span class="eqt-line-sep__field-label">{{ t('tagbar.separatorLinePosition') }}</span>
          <div class="eqt-line-sep__options">
            <button
              v-for="opt in (['top', 'middle', 'bottom'] as const)"
              :key="opt"
              type="button"
              class="eqt-line-sep__option"
              :class="{ 'eqt-line-sep__option--active': linePositionValue === opt }"
              @click="updateStyle({ linePosition: opt })"
            >{{ t(`tagbar.separatorLinePosition_${opt}`) }}</button>
          </div>
        </div>
        <div class="eqt-line-sep__field">
          <span class="eqt-line-sep__field-label">{{ t('tagbar.separatorStyle') }}</span>
          <div class="eqt-line-sep__options">
            <button
              v-for="opt in (['solid', 'dashed', 'none'] as const)"
              :key="opt"
              type="button"
              class="eqt-line-sep__option"
              :class="{ 'eqt-line-sep__option--active': lineStyleValue === opt }"
              @click="updateStyle({ line: opt })"
            >{{ t(`tagbar.separatorStyle_${opt}`) }}</button>
          </div>
        </div>
        <div class="eqt-line-sep__field">
          <div class="eqt-line-sep__slider-head">
            <span class="eqt-line-sep__field-label">{{ t('tagbar.separatorTextSize') }}</span>
            <span class="eqt-line-sep__slider-value">{{ textSizeValue }}px</span>
          </div>
          <input
            class="eqt-line-sep__slider"
            type="range"
            min="9"
            max="20"
            step="1"
            :value="textSizeValue"
            @input="updateStyle({ textSize: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <div class="eqt-line-sep__field">
          <div class="eqt-line-sep__slider-head">
            <span class="eqt-line-sep__field-label">{{ t('tagbar.separatorLineThickness') }}</span>
            <span class="eqt-line-sep__slider-value">{{ lineThicknessValue }}px</span>
          </div>
          <input
            class="eqt-line-sep__slider"
            type="range"
            min="1"
            max="6"
            step="1"
            :value="lineThicknessValue"
            :disabled="lineStyleValue === 'none'"
            @input="updateStyle({ lineThickness: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <div class="eqt-line-sep__field">
          <div class="eqt-line-sep__slider-head">
            <span class="eqt-line-sep__field-label">{{ t('tagbar.separatorLineLength') }}</span>
            <span class="eqt-line-sep__slider-value">{{ lineLengthValue }}%</span>
          </div>
          <input
            class="eqt-line-sep__slider"
            type="range"
            min="1"
            max="100"
            step="1"
            :value="lineLengthValue"
            :disabled="lineStyleValue === 'none'"
            @input="updateStyle({ lineLength: Number(($event.target as HTMLInputElement).value) === 100 ? undefined : Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </template>
      <div class="eqt-line-sep__footer">
        <button
          type="button"
          class="eqt-line-sep__reset"
          :disabled="!canReset"
          :title="t('settings.resetTitle')"
          @click="resetLayout"
        >{{ t('settings.reset') }}</button>
      </div>
    </div>
  </component>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-line-sep {
  &__trigger {
    @include btn-icon;
    width: auto;
    padding: 0 4px;
  }

  &__popup {
    --eqt-ctrl-h: 25px;
    width: 210px;
    min-width: 0;
    padding: 8px;
    background: var(--eqt-bg);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: var(--eqt-radius-md);
    box-shadow: var(--eqt-shadow-popover);
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    color: var(--eqt-text);

    &--embedded {
      padding: 4px;
      background: transparent;
      border: 0;
      box-shadow: none;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__field-label {
    color: var(--eqt-text);
    font-size: 12px;
  }

  &__options {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;

    &--four {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  &__option {
    @include btn-toned;
    min-width: 0;
    height: var(--eqt-ctrl-h);
    padding: 0 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

    &--active {
      background: var(--eqt-bg-active);
      font-weight: 600;
    }
  }

  &__slider-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__slider-value {
    color: var(--eqt-text-hint);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  &__slider {
    width: 100%;
    margin: 0;
    accent-color: var(--eqt-green);

    &:disabled {
      opacity: 0.4;
    }
  }

  &__footer {
    margin-top: 2px;
    padding-top: 6px;
    border-top: var(--eqt-border-width) solid var(--eqt-border);
  }

  &__reset {
    @include btn-ghost;
    width: 100%;
    height: var(--eqt-ctrl-h);
  }
}
</style>
