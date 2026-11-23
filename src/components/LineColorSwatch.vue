<script setup lang="ts">
import { ref } from 'vue'
import { Palette, X } from '@lucide/vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { t } from '@/composables/useI18n'
import type { ColorUsage } from '@/services/mytags/mytagsColors'

const props = withDefaults(defineProps<{
  modelValue: string | undefined
  title?: string
  embedded?: boolean
  alpha?: boolean
  /** 已經在用的顏色，排在色盤左邊讓人直接點來沿用 */
  presets?: ColorUsage[]
}>(), {
  alpha: true,
  presets: () => [],
})
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)

function clearColor() {
  emit('update:modelValue', undefined)
  open.value = false
}

/** 標籤列表很長時 title 只列前幾個，tooltip 才不會蓋掉半個畫面 */
const PRESET_TITLE_TAGS = 8

function presetTitle(preset: ColorUsage): string {
  const more = preset.tags.length > PRESET_TITLE_TAGS ? '\n…' : ''
  return preset.tags.slice(0, PRESET_TITLE_TAGS).join('\n') + more
}
</script>

<template>
  <button
    v-if="!embedded"
    ref="triggerEl"
    v-bind="$attrs"
    type="button"
    class="eqt-line-color__trigger"
    :style="modelValue ? { color: modelValue } : undefined"
    :title="title ?? t('tagbar.lineColor')"
    @click="open = !open"
  >
    <Palette :size="12" />
  </button>
  <component :is="embedded ? 'div' : AnchoredPopover" v-model:open="open" :anchor="triggerEl">
    <div class="eqt-line-color__popup" :class="{ 'eqt-line-color__popup--embedded': embedded }">
      <div v-if="props.presets.length" class="eqt-line-color__presets">
        <ul class="eqt-line-color__preset-list" :aria-label="t('panel.colorPresets')">
          <li v-for="preset in props.presets" :key="preset.color">
            <button
              type="button"
              class="eqt-line-color__preset"
              :class="{ 'eqt-line-color__preset--active': preset.color === modelValue?.toUpperCase() }"
              :title="presetTitle(preset)"
              @click="emit('update:modelValue', preset.color)"
            >
              <span class="eqt-line-color__preset-chip" :style="{ background: preset.color }" />
              <span class="eqt-line-color__preset-hex">{{ preset.color }}</span>
              <span class="eqt-line-color__preset-count">{{ preset.count }}</span>
            </button>
          </li>
        </ul>
      </div>
      <div class="eqt-line-color__main">
        <ColorPicker
          :model-value="modelValue"
          :alpha="alpha"
          @update:model-value="emit('update:modelValue', $event)"
        />
        <button type="button" class="eqt-line-color__clear" @click="clearColor">
          <X :size="12" /> {{ t('tagbar.lineColorClear') }}
        </button>
      </div>
    </div>
  </component>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-line-color {
  &__trigger {
    @include btn-icon;
    width: auto;
    padding: 0 4px;
  }

  &__popup {
    padding: 8px;
    background: var(--eqt-bg);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: var(--eqt-radius-md);
    box-shadow: var(--eqt-shadow-popover);
    display: flex;
    gap: 6px;

    &--embedded {
      padding: 4px;
      background: none;
      border: 0;
      box-shadow: none;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  // 清單自己不出高度：撐開的是右邊色盤那一欄，顏色再多也只在這個高度裡捲
  &__presets {
    position: relative;
    flex: none;
    width: var(--eqt-number-field-width);
  }

  &__preset-list {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  &__preset {
    @include btn-ghost;
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
    padding: 2px 4px;
    color: var(--eqt-text);
    font-size: var(--eqt-fs-sm);

    &--active {
      background: var(--eqt-bg-active);
    }
  }

  &__preset-chip {
    flex: none;
    width: calc(var(--eqt-checkbox-size) / 2);
    height: calc(var(--eqt-checkbox-size) / 2);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: var(--eqt-radius-sm);
  }

  &__preset-hex {
    font-family: monospace;
  }

  &__preset-count {
    margin-left: auto;
    color: var(--eqt-text-hint);
  }

  &__clear {
    @include btn-filled;
    padding: 4px 8px;
    color: var(--eqt-text);

    &:hover:not(:disabled) {
      background: var(--eqt-bg-hover);
    }
  }
}
</style>
