<script setup lang="ts">
import { computed } from 'vue'
import { Languages, Replace, Type, Eye } from '@lucide/vue'
import { textAlignToJustify } from '@/utils/align'
import { t, locale, setLocale, type Locale } from '@/composables/useI18n'
import {
  fontFamily, fontWeight, getDefaultLines,
  buttonLineTextAlign,
  convertToTraditional,
  CONVERT_TO_TRADITIONAL_MODES,
} from '@/services/store'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { buttonPreviewLabel } from '@/utils/buttonPreview'

const localeOptions: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const previewLines = computed(() => getDefaultLines())
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Languages :size="14" /> {{ t('settings.language') }}</h4>
      <div class="eqt-settings__locale-row">
        <button
          v-for="opt in localeOptions"
          :key="opt.value"
          type="button"
          class="eqt-settings__locale-btn"
          :class="{ 'eqt-settings__locale-btn--active': locale === opt.value }"
          @click="setLocale(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <p class="eqt-settings__hint">
        {{ t('settings.languageHint') }}
      </p>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Replace :size="14" /> {{ t('settings.convertToTraditional') }}</h4>
      <div class="eqt-settings__locale-row">
        <button
          v-for="m in CONVERT_TO_TRADITIONAL_MODES"
          :key="m.id"
          type="button"
          class="eqt-settings__locale-btn"
          :class="{ 'eqt-settings__locale-btn--active': convertToTraditional === m.id }"
          @click="convertToTraditional = m.id"
        >{{ t(m.labelKey) }}</button>
      </div>
      <p class="eqt-settings__hint">
        {{ t('settings.convertToTraditionalHint') }}
      </p>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Type :size="14" /> {{ t('settings.fontFamily') }}</h4>
      <div class="eqt-settings__font-row">
        <input
          :value="fontFamily"
          class="eqt-settings__text-input eqt-settings__text-input--full"
          :placeholder="t('settings.fontFamilyPlaceholder')"
          @input="fontFamily = ($event.target as HTMLInputElement).value"
        />
      </div>
      <p class="eqt-settings__hint">
        {{ t('settings.fontFamilyHint') }}<code>"Noto Sans TC", sans-serif</code>
      </p>

      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.fontWeight') }}</label>
        <input
          type="range"
          min="100"
          max="900"
          step="100"
          :value="fontWeight || '400'"
          class="eqt-settings__weight-slider"
          @input="fontWeight = ($event.target as HTMLInputElement).value"
        />
        <span class="eqt-settings__weight-value">{{ fontWeight || '400' }}</span>
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Eye :size="14" /> {{ t('settings.preview') }}</h4>
      <div class="eqt-settings__font-preview" :class="currentTagStyleClass">
        <template v-for="(line, li) in previewLines" :key="li">
          <div
            v-if="line.kind === 'buttons' && line.buttons.some(b => b.kind !== 'spacer')"
            class="eqt-settings__preview-line"
            :style="{ justifyContent: textAlignToJustify(line.style?.textAlign ?? buttonLineTextAlign) }"
          >
            <template v-for="(b, ti) in line.buttons" :key="ti">
              <span
                v-if="b.kind !== 'spacer'"
                class="eqt-settings__preview-tag"
                :class="{ 'eqt-settings__preview-tag--url': b.kind === 'url' }"
              >{{ buttonPreviewLabel(b) }}</span>
            </template>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<style lang="scss">
.eqt-settings__font-row {
  display: flex;
}

.eqt-settings__weight-slider {
  flex: 1;
  accent-color: var(--eqt-green);
}

.eqt-settings__weight-value {
  font-size: 12px;
  color: var(--eqt-text-hint);
  min-width: 2.5em;
  text-align: right;
}
</style>
