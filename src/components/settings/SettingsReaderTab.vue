<script setup lang="ts">
import { BookOpen, ToggleLeft } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import {
  readerEnhancerEnabled, readerPanelOpacity, readerPanelPosition, READER_PANEL_POSITIONS,
} from '@/services/store'
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><ToggleLeft :size="14" /> {{ t('settings.sectionReaderToggles') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="readerEnhancerEnabled"
          @change="readerEnhancerEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.readerEnhancer') }}</span>
      </label>
      <p class="eqt-settings__hint">{{ t('settings.readerEnhancerHint') }}</p>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><BookOpen :size="14" /> {{ t('settings.sectionReaderPanel') }}</h4>
      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.readerPanelPosition') }}</label>
        <div class="eqt-settings__locale-row">
          <button
            v-for="p in READER_PANEL_POSITIONS"
            :key="p.id"
            type="button"
            class="eqt-settings__locale-btn"
            :class="{ 'eqt-settings__locale-btn--active': readerPanelPosition === p.id }"
            :disabled="!readerEnhancerEnabled"
            @click="readerPanelPosition = p.id"
          >{{ t(p.labelKey) }}</button>
        </div>
      </div>
      <p class="eqt-settings__hint">{{ t('settings.readerPanelPositionHint') }}</p>
      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.readerPanelOpacity') }}</label>
        <input
          class="eqt-settings__range"
          type="range"
          min="30"
          max="100"
          step="5"
          :disabled="!readerEnhancerEnabled"
          v-model.number="readerPanelOpacity"
          :title="t('settings.readerPanelOpacity')"
        />
        <span class="eqt-settings__label">{{ readerPanelOpacity }}%</span>
      </div>
    </section>
  </div>
</template>
