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
