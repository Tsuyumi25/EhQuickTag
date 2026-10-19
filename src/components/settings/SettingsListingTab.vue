<script setup lang="ts">
import { nextTick } from 'vue'
import { Funnel, PanelBottom, Rows3, Settings, ToggleLeft } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import { showSettings } from '@/services/appOverlays'
import SettingsTagAppearanceSection from './SettingsTagAppearanceSection.vue'
import {
  listingDockAlwaysVisible, listingRulesPaused, listingTagSelectEnabled, listingTagsEnabled,
} from '@/services/store'
import { evrInstalled } from '@/utils/evr'

// TODO: EhViewRefined 上架 Sleazy Fork 之後換成那邊的網址
const EVR_URL = 'https://github.com/Tsuyumi25/EhViewRefined'
const evrInstall = () => t('settings.listingEvrInstall').split(/(\{evr\})/)

// EVR 的 README 寫明的 hook。先關掉這裡：兩邊都會鎖 body 的捲動，EVR 打開時記下的是
// 「已經被我們鎖住」的狀態，關掉後會把頁面還原成鎖住；等我們卸載、鎖解開了再請它打開
async function openEvrSettings() {
  showSettings.value = false
  await nextTick()
  document.dispatchEvent(new Event('evr:open-settings'))
}
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
        <p class="eqt-settings__hint">{{ t('settings.listingTagLayoutHint') }}</p>
        <button type="button" class="eqt-settings__evr-settings" @click="openEvrSettings">
          <Settings :size="14" aria-hidden="true" />{{ t('settings.listingOpenEvrSettings') }}
        </button>
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

<style lang="scss">
@use '../../styles/buttons' as *;

.eqt-settings__evr-settings {
  @include btn-toned;
  align-self: flex-start;
  min-height: var(--eqt-checkbox-size);
  padding: calc(var(--eqt-checkbox-size) / 6) calc(var(--eqt-checkbox-size) / 3);
}
</style>
