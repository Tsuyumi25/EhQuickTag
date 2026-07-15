<script setup lang="ts">
import { ref } from 'vue'
import { Palette, X } from '@lucide/vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { t } from '@/composables/useI18n'

defineProps<{
  modelValue: string | undefined
  title?: string
  embedded?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)

function clearColor() {
  emit('update:modelValue', undefined)
  open.value = false
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
      <ColorPicker :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
      <button type="button" class="eqt-line-color__clear" @click="clearColor">
        <X :size="12" /> {{ t('tagbar.lineColorClear') }}
      </button>
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
    flex-direction: column;
    gap: 6px;

    &--embedded {
      padding: 4px;
      background: none;
      border: 0;
      box-shadow: none;
    }
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
