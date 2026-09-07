<script setup lang="ts">
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from 'reka-ui'

withDefaults(defineProps<{
  modelValue: number | null
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  label: string
}>(), {
  step: 1,
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function updateModelValue(value: number | undefined): void {
  if (typeof value === 'number' && Number.isFinite(value)) emit('update:modelValue', value)
}
</script>

<template>
  <NumberFieldRoot
    class="eqt-number-field"
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    @update:model-value="updateModelValue"
  >
    <NumberFieldDecrement class="eqt-number-field__step" :title="`${label} −`">
      -
    </NumberFieldDecrement>
    <NumberFieldInput class="eqt-number-field__input" :title="label" :aria-label="label" />
    <NumberFieldIncrement class="eqt-number-field__step" :title="`${label} +`">
      +
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>

<style lang="scss">
.eqt-number-field {
  display: inline-flex;
  flex: 0 0 var(--eqt-number-field-width);
  align-items: center;
  width: var(--eqt-number-field-width);
  height: var(--eqt-checkbox-size);

  &__step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 calc(var(--eqt-checkbox-size) * 1.5);
    width: calc(var(--eqt-checkbox-size) * 1.5);
    height: var(--eqt-checkbox-size);
    box-sizing: border-box;
    padding: 0;
    border: var(--eqt-border-width) solid var(--eqt-border);
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    font: inherit;
    font-size: var(--eqt-fs-md);
    line-height: 1;
    cursor: pointer;

    &:first-child {
      border-right: 0;
      border-radius: var(--eqt-radius-sm) 0 0 var(--eqt-radius-sm);
    }

    &:last-child {
      border-left: 0;
      border-radius: 0 var(--eqt-radius-sm) var(--eqt-radius-sm) 0;
    }

    &:hover:not(:disabled) { background: var(--eqt-bg-btn-hover); }
    &:disabled { opacity: 0.3; cursor: default; }
  }

  input#{&}__input {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    height: var(--eqt-checkbox-size);
    box-sizing: border-box;
    margin: 0;
    padding: 0 calc(var(--eqt-checkbox-size) / 6);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 0;
    outline: none;
    background: var(--eqt-bg-btn-hover);
    color: var(--eqt-text);
    font-size: var(--eqt-fs-sm);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-align: center;

    &:enabled:hover,
    &:enabled:focus {
      border-color: var(--eqt-border);
      background: var(--eqt-bg-btn-hover);
    }
  }
}
</style>
