<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { Copy, Check } from '@lucide/vue'
import 'vanilla-colorful/hex-alpha-color-picker.js'
import 'vanilla-colorful/hex-color-picker.js'
import { t } from '@/composables/useI18n'
import { formatRgbInput, parseColorInput } from '@/services/color'

const props = withDefaults(defineProps<{ modelValue: string | undefined, alpha?: boolean }>(), {
  alpha: true,
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const hexText = ref('')
const rgbText = ref('')

function syncInputs(v: string | undefined) {
  hexText.value = v ?? ''
  rgbText.value = formatRgbInput(v, props.alpha)
}
syncInputs(props.modelValue)

watch(() => [props.modelValue, props.alpha] as const, ([value]) => syncInputs(value))

const pickerColor = computed(() =>
  parseColorInput(props.modelValue ?? '', props.alpha) ?? (props.alpha ? '#888888ff' : '#888888'))

function onPickerChange(e: Event) {
  const detail = (e as CustomEvent<{ value: string }>).detail
  const color = parseColorInput(detail.value, props.alpha)
  if (color) emit('update:modelValue', color)
}


function commitHex() {
  const parsed = parseColorInput(hexText.value, props.alpha)
  if (parsed) emit('update:modelValue', parsed)
  else hexText.value = props.modelValue ?? ''
}

function commitRgb() {
  const parsed = parseColorInput(rgbText.value, props.alpha)
  if (parsed) emit('update:modelValue', parsed)
  else rgbText.value = formatRgbInput(props.modelValue, props.alpha)
}

const hexClip = useClipboard({ legacy: true })
const rgbClip = useClipboard({ legacy: true })
function onCopyHex() { if (hexText.value) hexClip.copy(hexText.value) }
function onCopyRgb() { if (rgbText.value) rgbClip.copy(rgbText.value) }
</script>

<template>
  <div class="eqt-color-picker">
    <component
      :is="alpha ? 'hex-alpha-color-picker' : 'hex-color-picker'"
      class="eqt-color-picker__picker"
      :color="pickerColor"
      @color-changed="onPickerChange"
    />
    <div class="eqt-color-picker__input-row">
      <input
        v-model="hexText"
        class="eqt-color-picker__input"
        :placeholder="alpha ? '#rrggbbaa' : '#rrggbb'"
        spellcheck="false"
        @change="commitHex"
        @keydown.enter.prevent="commitHex"
      />
      <button
        type="button"
        class="eqt-color-picker__copy"
        :disabled="!hexText"
        :title="hexClip.copied.value ? t('settings.editorCopied') : t('settings.editorCopy')"
        @click="onCopyHex"
      >
        <Check v-if="hexClip.copied.value" :size="12" />
        <Copy v-else :size="12" />
      </button>
    </div>
    <div class="eqt-color-picker__input-row">
      <input
        v-model="rgbText"
        class="eqt-color-picker__input"
        :placeholder="alpha ? 'rgba(r, g, b, a)' : 'rgb(r, g, b)'"
        spellcheck="false"
        @change="commitRgb"
        @keydown.enter.prevent="commitRgb"
      />
      <button
        type="button"
        class="eqt-color-picker__copy"
        :disabled="!rgbText"
        :title="rgbClip.copied.value ? t('settings.editorCopied') : t('settings.editorCopy')"
        @click="onCopyRgb"
      >
        <Check v-if="rgbClip.copied.value" :size="12" />
        <Copy v-else :size="12" />
      </button>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-color-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__picker {
    // 寬度跟著容器走（context menu 內撐滿選單寬）；shrink-to-fit 容器
    //（AnchoredPopover）裡百分比無錨定，靠 min-width 保底不塌
    width: 100%;
    min-width: 180px;
    height: 180px;
    user-select: none;
  }

  &__input-row {
    display: flex;
    gap: 4px;
  }

  &__input {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    font-size: 12px;
    font-family: monospace;
    box-sizing: border-box;

    &:focus {
      outline: none;
    }
  }

  &__copy {
    @include btn-filled;
    flex-shrink: 0;
    padding: 4px 6px;
    color: var(--eqt-text);

    &:hover:not(:disabled) {
      background: var(--eqt-bg-hover);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}
</style>
