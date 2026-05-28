<script setup lang="ts">
import { ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { Copy, Check } from '@lucide/vue'
import 'vanilla-colorful/hex-alpha-color-picker.js'
import { t } from '@/composables/useI18n'

const props = defineProps<{ modelValue: string | undefined }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const hexText = ref('')
const rgbText = ref('')

function syncInputs(v: string | undefined) {
  hexText.value = v ?? ''
  rgbText.value = hexToRgbaString(v)
}
syncInputs(props.modelValue)

watch(() => props.modelValue, syncInputs)

function onPickerChange(e: Event) {
  const detail = (e as CustomEvent<{ value: string }>).detail
  emit('update:modelValue', detail.value)
}

// hex (6/8 char) → "rgb(r, g, b)" 或 "rgba(r, g, b, a)"。
// 6-char hex 視為 alpha=1，輸出簡短的 rgb()。
function hexToRgbaString(v: string | undefined): string {
  if (!v) return ''
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(v)
  const m8 = /^#([0-9a-fA-F]{8})$/.exec(v)
  if (!m6 && !m8) return ''
  const hex = (m6 ?? m8!)[1]
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if (m6) return `rgb(${r}, ${g}, ${b})`
  const a = parseInt(hex.slice(6, 8), 16) / 255
  return `rgba(${r}, ${g}, ${b}, ${+a.toFixed(2)})`
}

// Parse #rgb / #rgba / #rrggbb / #rrggbbaa / rgb(...) / rgba(...) → 8-char hex。
// 沒帶 alpha 的視為 ff (opaque)。
function parseColor(raw: string): string | null {
  const s = raw.trim()
  const hex = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(s)
  if (hex) {
    let h = hex[1].toLowerCase()
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + 'ff'
    else if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
    else if (h.length === 6) h = h + 'ff'
    return '#' + h
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s)
  if (rgb) {
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
    const r = +rgb[1], g = +rgb[2], b = +rgb[3]
    const a = rgb[4] !== undefined ? Math.round(Math.max(0, Math.min(1, +rgb[4])) * 255) : 255
    return '#' + toHex(r) + toHex(g) + toHex(b) + toHex(a)
  }
  return null
}

function commitHex() {
  const parsed = parseColor(hexText.value)
  if (parsed) emit('update:modelValue', parsed)
  else hexText.value = props.modelValue ?? ''
}

function commitRgb() {
  const parsed = parseColor(rgbText.value)
  if (parsed) emit('update:modelValue', parsed)
  else rgbText.value = hexToRgbaString(props.modelValue)
}

const hexClip = useClipboard({ legacy: true })
const rgbClip = useClipboard({ legacy: true })
function onCopyHex() { if (hexText.value) hexClip.copy(hexText.value) }
function onCopyRgb() { if (rgbText.value) rgbClip.copy(rgbText.value) }
</script>

<template>
  <div class="eqt-color-picker">
    <hex-alpha-color-picker
      class="eqt-color-picker__picker"
      :color="modelValue ?? '#888888ff'"
      @color-changed="onPickerChange"
    />
    <div class="eqt-color-picker__input-row">
      <input
        v-model="hexText"
        class="eqt-color-picker__input"
        placeholder="#rrggbbaa"
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
        placeholder="rgba(r, g, b, a)"
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
.eqt-color-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__picker {
    width: 180px;
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
      border-color: var(--eqt-border-focus);
    }
  }

  &__copy {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text-secondary);
    cursor: pointer;

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
