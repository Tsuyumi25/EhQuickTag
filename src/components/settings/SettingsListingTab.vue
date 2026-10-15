<script setup lang="ts">
import { Funnel, PanelBottom } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { listingDockAlwaysVisible, listingRulesPaused, listingTagSelectEnabled } from '@/services/store'

// TODO: EhViewRefined 上架 Sleazy Fork 之後換成那邊的網址
const EVR_URL = 'https://github.com/Tsuyumi25/EhViewRefined'
const evrInstall = () => t('settings.listingEvrInstall').split(/(\{evr\})/)
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><PanelBottom :size="14" /> {{ t('settings.sectionListingDock') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox" :checked="listingTagSelectEnabled"
          @change="listingTagSelectEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.listingTagSelect') }}</span>
      </label>
      <p class="eqt-settings__hint">{{ t('settings.listingTagSelectHint') }}</p>

      <label class="eqt-settings__row">
        <input
          type="checkbox" :checked="listingDockAlwaysVisible" :disabled="!listingTagSelectEnabled"
          @change="listingDockAlwaysVisible = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.listingDockAlways') }}</span>
      </label>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Funnel :size="14" /> {{ t('settings.sectionListingRules') }}</h4>
      <p class="eqt-settings__hint">
        {{ t('settings.listingEvrNotice') }}<br />
        <template v-for="(part, index) in evrInstall()" :key="index">
          <a v-if="part === '{evr}'" :href="EVR_URL" target="_blank" rel="noopener noreferrer">{{ EVR_URL }}</a>
          <template v-else>{{ part }}</template>
        </template>
      </p>
      <label class="eqt-settings__row">
        <input
          type="checkbox" :checked="listingRulesPaused"
          @change="listingRulesPaused = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.listingRulesPaused') }}</span>
      </label>
    </section>
  </div>
</template>
