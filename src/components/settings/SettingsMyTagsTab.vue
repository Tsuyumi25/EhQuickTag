<script setup lang="ts">
import { ref } from 'vue'
import { ToggleLeft } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { myTagsEnhancerEnabled } from '@/services/store'
import SettingsTagAppearanceSection from './SettingsTagAppearanceSection.vue'
import { clearSamples } from '@/services/mytags/mytagsSampleStore'
import { askConfirm } from '@/services/confirmDialog'
import { useEqtToast } from '@/composables/useEqtToast'

const clearingSamples = ref(false)
const toast = useEqtToast()

async function onClearSamples(): Promise<void> {
  if (clearingSamples.value) return
  clearingSamples.value = true
  try {
    if (!await askConfirm(t('settings.myTagsClearSamplesConfirm'), t('settings.myTagsClearSamples'))) return
    await clearSamples()
    toast.success(t('settings.myTagsSamplesCleared'))
  } catch {
    toast.error(t('settings.myTagsClearSamplesFailed'))
  } finally {
    clearingSamples.value = false
  }
}
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
    <SettingsTagAppearanceSection scene="mytags" />
    <section class="eqt-settings__section">
      <button
        type="button"
        class="eqt-settings__clear-samples"
        :disabled="clearingSamples"
        @click="onClearSamples"
      >{{ t('settings.myTagsClearSamples') }}</button>
      <p class="eqt-settings__hint">{{ t('settings.myTagsClearSamplesHint') }}</p>
    </section>
  </div>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

.eqt-settings__clear-samples {
  @include btn-danger;
  align-self: flex-start;
  min-height: var(--eqt-checkbox-size);
  padding: calc(var(--eqt-checkbox-size) / 6) calc(var(--eqt-checkbox-size) / 3);
}
</style>
