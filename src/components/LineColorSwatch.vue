<script setup lang="ts">
import { ref } from 'vue'
import { Palette, X } from '@lucide/vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { t } from '@/composables/useI18n'

defineProps<{
  modelValue: string | undefined
  title?: string
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
  <AnchoredPopover v-model:open="open" :anchor="triggerEl">
    <div class="eqt-line-color__popup">
      <ColorPicker :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
      <button type="button" class="eqt-line-color__clear" @click="clearColor">
        <X :size="12" /> {{ t('tagbar.lineColorClear') }}
      </button>
    </div>
  </AnchoredPopover>
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
  }

  &__clear {
    @include btn-filled;
    padding: 4px 8px;
    color: var(--eqt-text-secondary);

    &:hover:not(:disabled) {
      background: var(--eqt-bg-hover);
    }
  }
}
</style>
