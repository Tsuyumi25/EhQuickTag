<script setup lang="ts">
import { t } from '@/composables/useI18n'
import { DEFAULT_NS_ORDER } from '@/services/tags/tagDb'

const props = defineProps<{
  modelValue: string | null
  /** 給了才會出現「選中」按鈕 */
  pickedCount?: number
  picked?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'update:picked': [value: boolean]
}>()

const namespaces = DEFAULT_NS_ORDER.filter((namespace) => namespace !== 'temp')

function showAll(): void {
  emit('update:picked', false)
  emit('update:modelValue', null)
}

function toggle(namespace: string): void {
  emit('update:picked', false)
  emit('update:modelValue', props.modelValue === namespace && !props.picked ? null : namespace)
}

function togglePicked(): void {
  emit('update:modelValue', null)
  emit('update:picked', !props.picked)
}
</script>

<template>
  <aside class="eqt-namespace-filter" role="group" :aria-label="t('nsFilter.label')">
    <button
      v-if="pickedCount"
      type="button"
      class="eqt-namespace-filter__button"
      :class="{ 'eqt-namespace-filter__button--active': picked }"
      :title="t('nsFilter.picked', { n: String(pickedCount) })"
      @click="togglePicked"
    >{{ t('nsFilter.picked', { n: String(pickedCount) }) }}</button>
    <button
      type="button"
      class="eqt-namespace-filter__button"
      :class="{ 'eqt-namespace-filter__button--active': modelValue === null && !picked }"
      @click="showAll"
    >{{ t('nsFilter.all') }}</button>
    <button
      v-for="namespace in namespaces"
      :key="namespace"
      type="button"
      class="eqt-namespace-filter__button"
      :class="{ 'eqt-namespace-filter__button--active': modelValue === namespace && !picked }"
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
