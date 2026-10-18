<script setup lang="ts">
import { Funnel, PanelBottom, Rows3, ToggleLeft } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import SettingsTagAppearanceSection from './SettingsTagAppearanceSection.vue'
import {
  LISTING_TAG_LAYOUTS, listingDockAlwaysVisible, listingRulesPaused, listingTagLayout, listingTagSelectEnabled, listingTagsEnabled,
} from '@/services/store'
import { evrInstalled } from '@/utils/evr'

// TODO: EhViewRefined 上架 Sleazy Fork 之後換成那邊的網址
const EVR_URL = 'https://github.com/Tsuyumi25/EhViewRefined'
const evrInstall = () => t('settings.listingEvrInstall').split(/(\{evr\})/)
</script>

<template>
  <div class="eqt-settings__tab-content">
    <!-- 沒有 EhViewRefined 就拿不到完整標籤，規則與選取都會照不完整的資料動作；整個列表強化不啟用，設定也一併停用 -->
    <fieldset class="eqt-settings__fieldset" :disabled="!evrInstalled">
      <section class="eqt-settings__section">
        <h4 class="eqt-settings__subtitle"><ToggleLeft :size="14" /> {{ t('settings.sectionListingToggles') }}</h4>
        <p v-if="!evrInstalled" class="eqt-settings__hint eqt-settings__hint--warn" role="alert">
          {{ t('settings.listingEvrRequired') }}<br />
          <template v-for="(part, index) in evrInstall()" :key="index">
            <a v-if="part === '{evr}'" :href="EVR_URL" target="_blank" rel="noopener noreferrer">{{ EVR_URL }}</a>
            <template v-else>{{ part }}</template>
          </template>
        </p>
        <label class="eqt-settings__row">
          <input
            type="checkbox" :checked="listingTagsEnabled"
            @change="listingTagsEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="eqt-settings__label">{{ t('settings.listingTags') }}</span>
        </label>
      </section>

      <SettingsTagAppearanceSection scene="listing" />

      <section class="eqt-settings__section">
        <h4 class="eqt-settings__subtitle"><Rows3 :size="14" /> {{ t('settings.sectionListingTagLayout') }}</h4>
        <div class="eqt-settings__field-row">
          <label class="eqt-settings__field-label">{{ t('settings.listingTagLayout') }}</label>
          <div class="eqt-settings__locale-row">
            <button
              v-for="mode in LISTING_TAG_LAYOUTS" :key="mode.id" type="button" class="eqt-settings__locale-btn"
              :class="{ 'eqt-settings__locale-btn--active': listingTagLayout === mode.id }" :disabled="!listingTagsEnabled"
              @click="listingTagLayout = mode.id"
            >{{ t(mode.labelKey) }}</button>
          </div>
        </div>
        <p class="eqt-settings__hint">{{ t('settings.listingTagLayoutHint') }}</p>
      </section>

      <!-- 選取做在插件的標籤 chip 上，標籤沒換掉就選不了；圖庫規則也是圖庫列表強化的一部分 -->
      <section class="eqt-settings__section">
        <h4 class="eqt-settings__subtitle"><PanelBottom :size="14" /> {{ t('settings.sectionListingDock') }}</h4>
        <label class="eqt-settings__row">
          <input
            type="checkbox" :checked="listingTagSelectEnabled" :disabled="!listingTagsEnabled"
            @change="listingTagSelectEnabled = ($event.target as HTMLInputElement).checked"
          />
          <span class="eqt-settings__label">{{ t('settings.listingTagSelect') }}</span>
        </label>
        <p class="eqt-settings__hint">{{ t('settings.listingTagSelectHint') }}</p>

        <label class="eqt-settings__row">
          <input
            type="checkbox" :checked="listingDockAlwaysVisible" :disabled="!listingTagsEnabled || !listingTagSelectEnabled"
            @change="listingDockAlwaysVisible = ($event.target as HTMLInputElement).checked"
          />
          <span class="eqt-settings__label">{{ t('settings.listingDockAlways') }}</span>
        </label>
      </section>

      <section class="eqt-settings__section">
        <h4 class="eqt-settings__subtitle"><Funnel :size="14" /> {{ t('settings.sectionListingRules') }}</h4>
        <label class="eqt-settings__row">
          <input
            type="checkbox" :checked="listingRulesPaused" :disabled="!listingTagsEnabled"
            @change="listingRulesPaused = ($event.target as HTMLInputElement).checked"
          />
          <span class="eqt-settings__label">{{ t('settings.listingRulesPaused') }}</span>
        </label>
      </section>
    </fieldset>
  </div>
</template>
