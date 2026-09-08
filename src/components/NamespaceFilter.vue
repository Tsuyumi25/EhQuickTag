<script setup lang="ts">
import { t } from '@/composables/useI18n'
import { DEFAULT_NS_ORDER } from '@/services/tagDb'

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const namespaces = DEFAULT_NS_ORDER.filter((namespace) => namespace !== 'temp')

function toggle(namespace: string): void {
  emit('update:modelValue', props.modelValue === namespace ? null : namespace)
}
</script>

<template>
  <aside class="eqt-namespace-filter" role="group" :aria-label="t('nsFilter.label')">
    <button
      type="button"
      class="eqt-namespace-filter__button"
      :class="{ 'eqt-namespace-filter__button--active': modelValue === null }"
      @click="emit('update:modelValue', null)"
    >{{ t('nsFilter.all') }}</button>
    <button
      v-for="namespace in namespaces"
      :key="namespace"
      type="button"
      class="eqt-namespace-filter__button"
      :class="{ 'eqt-namespace-filter__button--active': modelValue === namespace }"
      :title="t('ns.' + namespace)"
      @click="toggle(namespace)"
    >{{ t('ns.' + namespace) }}</button>
  </aside>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-namespace-filter {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: calc(var(--eqt-checkbox-size) / 6);
  overflow-y: auto;

  &__button {
    @include btn-toned;
    overflow: hidden;
    padding: calc(var(--eqt-checkbox-size) / 12) calc(var(--eqt-checkbox-size) / 4);
    font-size: var(--eqt-fs-sm);
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--active {
      border-color: var(--eqt-text);
      background: var(--eqt-bg-active);
    }
  }
}
</style>
