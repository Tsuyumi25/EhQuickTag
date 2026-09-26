<script setup lang="ts">
import { ToggleLeft } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { myTagsEnhancerEnabled } from '@/services/store'
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><ToggleLeft :size="14" /> {{ t('settings.sectionMyTagsToggles') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="myTagsEnhancerEnabled"
          @change="myTagsEnhancerEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.myTagsEnhancer') }}</span>
      </label>
      <p class="eqt-settings__hint">
        <template v-for="(part, i) in t('settings.myTagsEnhancerHint').split(/(\{mytags\})/)" :key="i">
          <a v-if="part === '{mytags}'" href="/mytags" target="_blank" rel="noopener noreferrer">/mytags</a>
          <template v-else>{{ part }}</template>
        </template>
      </p>
    </section>
  </div>
</template>
