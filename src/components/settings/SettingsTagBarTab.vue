<script setup lang="ts">
import { computed } from 'vue'
import {
  Eye, LayoutPanelTop, Tag, MousePointerClick, Palette, ExternalLink,
} from '@lucide/vue'
import { textAlignToJustify } from '@/utils/align'
import type { LineTextAlign } from '@/types'
import { t } from '@/composables/useI18n'
import {
  getDefaultLines,
  dblClickLeft, dblClickRight, dblClickLeftNewTabActive, dblClickRightNewTabActive,
  nsFormat, defaultExactMatch,
  tagStylePreset, buttonLineTextAlign, separatorLineTextAlign, useAccentOnInclude, type DblClickAction,
  showSearchPanel, searchPanelLangMode, enableHistory, followCurrentSite,
  SEARCH_PANEL_LANG_MODES,
} from '@/services/store'
import { TAG_STYLE_PRESETS, currentTagStyleClass } from '@/composables/useTagStyle'
import { buttonPreviewLabel } from '@/utils/buttonPreview'

const dblClickOptions = [
  { labelKey: 'settings.dblClickLeft', ref: dblClickLeft, newTabRef: dblClickLeftNewTabActive },
  { labelKey: 'settings.dblClickRight', ref: dblClickRight, newTabRef: dblClickRightNewTabActive },
]

const lineAlignSettings = [
  { labelKey: 'settings.buttonLineTextAlign', ref: buttonLineTextAlign },
  { labelKey: 'settings.separatorLineTextAlign', ref: separatorLineTextAlign },
]

const previewLines = computed(() => getDefaultLines())
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><LayoutPanelTop :size="14" /> {{ t('settings.searchBarVisibility') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="showSearchPanel"
          @change="showSearchPanel = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.showSearchPanel') }}</span>
      </label>

      <div class="eqt-settings__field-row eqt-settings__field-row--sub">
        <label class="eqt-settings__field-label">{{ t('settings.searchPanelLang') }}</label>
        <div class="eqt-settings__locale-row">
          <button
            v-for="m in SEARCH_PANEL_LANG_MODES"
            :key="m.id"
            type="button"
            class="eqt-settings__locale-btn"
            :class="{ 'eqt-settings__locale-btn--active': searchPanelLangMode === m.id }"
            :disabled="!showSearchPanel"
            @click="searchPanelLangMode = m.id"
          >{{ t(m.labelKey) }}</button>
        </div>
      </div>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="enableHistory"
          @change="enableHistory = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.enableHistory') }}</span>
      </label>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Tag :size="14" /> {{ t('settings.sectionTagFormat') }}</h4>
      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.nsFormat') }}</label>
        <div class="eqt-settings__locale-row">
          <button
            type="button"
            class="eqt-settings__locale-btn"
            :class="{ 'eqt-settings__locale-btn--active': nsFormat === 'long' }"
            @click="nsFormat = 'long'"
          >{{ t('settings.nsFormatLong') }}</button>
          <button
            type="button"
            class="eqt-settings__locale-btn"
            :class="{ 'eqt-settings__locale-btn--active': nsFormat === 'short' }"
            @click="nsFormat = 'short'"
          >{{ t('settings.nsFormatShort') }}</button>
        </div>
      </div>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="defaultExactMatch"
          @change="defaultExactMatch = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.defaultExactMatch') }}</span>
      </label>
      <p class="eqt-settings__hint">
        {{ t('settings.defaultExactMatchHint') }}
      </p>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><MousePointerClick :size="14" /> {{ t('settings.dblClickActions') }}</h4>
      <div
        v-for="({ labelKey, ref: r, newTabRef }) in dblClickOptions"
        :key="labelKey"
        class="eqt-settings__field-row"
      >
        <label class="eqt-settings__field-label eqt-settings__field-label--aligned">{{ t(labelKey) }}</label>
        <select
          class="eqt-settings__select"
          :value="r.value"
          @change="r.value = ($event.target as HTMLSelectElement).value as DblClickAction"
        >
          <option value="search">{{ t('settings.actionSearchCurrent') }}</option>
          <option value="searchNewTab">{{ t('settings.actionSearchNewTab') }}</option>
          <option value="clearSearch">{{ t('settings.actionClear') }}</option>
          <option value="toggleEdit">{{ t('settings.actionToggleEdit') }}</option>
          <option value="openSearchPopup">{{ t('settings.actionOpenSearchPopup') }}</option>
          <option value="none">{{ t('settings.actionNone') }}</option>
        </select>
        <label v-if="r.value === 'searchNewTab'" class="eqt-settings__row">
          <input
            type="checkbox"
            :checked="newTabRef.value"
            @change="newTabRef.value = ($event.target as HTMLInputElement).checked"
          />
          <span class="eqt-settings__label">{{ t('settings.newTabActivate') }}</span>
        </label>
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><ExternalLink :size="14" /> {{ t('settings.sectionUrlButton') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="followCurrentSite"
          @change="followCurrentSite = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.followCurrentSite') }}</span>
      </label>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Palette :size="14" /> {{ t('settings.tagStyle') }}</h4>
      <div class="eqt-settings__locale-row">
        <button
          v-for="preset in TAG_STYLE_PRESETS"
          :key="preset.id"
          type="button"
          class="eqt-settings__locale-btn"
          :class="{ 'eqt-settings__locale-btn--active': tagStylePreset === preset.id }"
          @click="tagStylePreset = preset.id"
        >{{ t(preset.labelKey) }}</button>
      </div>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="useAccentOnInclude"
          @change="useAccentOnInclude = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.useAccentOnInclude') }}</span>
      </label>
      <p class="eqt-settings__hint">
        {{ t('settings.useAccentOnIncludeHint') }}
      </p>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><LayoutPanelTop :size="14" /> {{ t('settings.sectionLineAlignment') }}</h4>
      <div
        v-for="row in lineAlignSettings"
        :key="row.labelKey"
        class="eqt-settings__field-row"
      >
        <label class="eqt-settings__field-label">{{ t(row.labelKey) }}</label>
        <div class="eqt-settings__locale-row">
          <button
            v-for="align in (['left', 'center', 'right'] as LineTextAlign[])"
            :key="align"
            type="button"
            class="eqt-settings__locale-btn"
            :class="{ 'eqt-settings__locale-btn--active': row.ref.value === align }"
            @click="row.ref.value = align"
          >{{ t(`tagbar.separatorTextAlign_${align}`) }}</button>
        </div>
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
