<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { t } from '@/composables/useI18n'

defineProps<{
  name: string
  count?: number
  isActive?: boolean
  chosen: boolean
  purgeable?: boolean
  purgeTitle?: string
}>()

const emit = defineEmits<{
  click: []
  purge: []
}>()
</script>

<template>
  <li
    class="eqt-settings__ns-item eqt-settings__ns-item--clickable"
    :class="{ 'eqt-settings__ns-item--chosen': chosen }"
    @click="emit('click')"
  >
    <span class="eqt-settings__item-name">
      {{ name }}
      <span v-if="isActive" class="eqt-settings__active-badge">{{ t('settings.activeBadge') }}</span>
    </span>
    <span v-if="count !== undefined" class="eqt-settings__item-count">{{ count }}</span>
    <button
      v-if="purgeable"
      class="eqt-settings__item-btn eqt-settings__item-btn--purge"
      type="button"
      :title="purgeTitle"
      @click.stop="emit('purge')"
    ><Trash2 :size="12" /></button>
  </li>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

.eqt-settings {
  &__ns-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    min-height: 30px;
    border-radius: 3px;
    font-size: 13px;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--ghost {
      opacity: 0.4;
    }

    &--chosen {
      background: var(--eqt-bg-active);
    }

    &--clickable {
      cursor: pointer;
    }

    &--draggable {
      cursor: grab;
    }
  }

  &__active-badge {
    font-size: var(--eqt-fs-xs);
    color: var(--eqt-text-on-color);
    background: var(--eqt-green);
    padding: 1px 4px;
    border-radius: 2px;
    margin-left: 4px;
    vertical-align: middle;
  }

  &__item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__item-count {
    font-size: 11px;
    color: var(--eqt-text-hint);
    flex-shrink: 0;
  }

  &__item-btn {
    @include btn-ghost;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    // 還原 popup container 的 13px——btn-base 預設 12px 會讓 icon glyph 縮 1px
    font-size: var(--eqt-fs-lg);

    &:hover:not(:disabled) {
      background: var(--eqt-bg-active);
      color: var(--eqt-text);
    }

    // 必須加 :not(:disabled) 才不會輸 btn-ghost / 上面 hover 的 (0,3,0) 特異性，
    // 否則 purge 紅色被 var(--eqt-text) 蓋掉
    &--purge:hover:not(:disabled) {
      color: var(--eqt-danger);
    }
  }
}
</style>
