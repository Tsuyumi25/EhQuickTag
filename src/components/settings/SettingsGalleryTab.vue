<script setup lang="ts">
import { ToggleLeft, UnfoldVertical, MousePointerClick, Info } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import {
  taggingEnhancerEnabled, galleryDragSelectEnabled, galleryTaglistExpand, galleryTaglistHeight, galleryTaglistZoom, introPanelPrimaryLang, wikiPreludeExpanded,
  galleryDblClickLeft, galleryDblClickRight, galleryDblClickLeftNewTabActive, galleryDblClickRightNewTabActive,
  INTRO_PANEL_PRIMARY_LANGS,
  GALLERY_DBL_CLICK_ACTIONS, type GalleryDblClickAction,
} from '@/services/store'

const galleryDblClickOptions = [
  { labelKey: 'settings.galleryDblClickLeft', ref: galleryDblClickLeft, newTabRef: galleryDblClickLeftNewTabActive },
  { labelKey: 'settings.galleryDblClickRight', ref: galleryDblClickRight, newTabRef: galleryDblClickRightNewTabActive },
]
</script>

<template>
  <div class="eqt-settings__tab-content">
    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><ToggleLeft :size="14" /> {{ t('settings.sectionGalleryToggles') }}</h4>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="taggingEnhancerEnabled"
          @change="taggingEnhancerEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.taggingEnhancer') }}</span>
      </label>
      <p class="eqt-settings__hint">
        {{ t('settings.taggingEnhancerHint') }}
      </p>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="galleryDragSelectEnabled"
          :disabled="!taggingEnhancerEnabled"
          @change="galleryDragSelectEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.galleryDragSelect') }}</span>
      </label>
      <p class="eqt-settings__hint">
        {{ t('settings.galleryDragSelectHint') }}
      </p>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><UnfoldVertical :size="14" /> {{ t('settings.sectionGallerySize') }}</h4>
      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.galleryTaglistHeight') }}</label>
        <input
          class="eqt-settings__input eqt-settings__input--short"
          type="number"
          min="200"
          max="1000"
          step="10"
          :disabled="!taggingEnhancerEnabled"
          v-model.number="galleryTaglistHeight"
          :title="t('settings.galleryTaglistHeight')"
        />
        <span class="eqt-settings__label">px</span>
      </div>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="galleryTaglistExpand"
          :disabled="!taggingEnhancerEnabled"
          @change="galleryTaglistExpand = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.galleryTaglistExpand') }}</span>
      </label>
      <p class="eqt-settings__hint">
        {{ t('settings.galleryTaglistHeightTipBefore')
        }}<a
          href="https://e-hentai.org/g/760051/e601ae7b84/"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('settings.galleryTaglistHeightTipLink') }}</a>{{
          t('settings.galleryTaglistHeightTipAfter')
        }}
      </p>
      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.galleryTaglistZoom') }}</label>
        <input
          class="eqt-settings__range"
          type="range"
          min="50"
          max="200"
          step="5"
          :disabled="!taggingEnhancerEnabled"
          v-model.number="galleryTaglistZoom"
          :title="t('settings.galleryTaglistZoom')"
        />
        <span class="eqt-settings__label">{{ galleryTaglistZoom }}%</span>
      </div>
      <div class="eqt-settings__gallery-preview">
        <div class="eqt-gallery-taglist" :style="{ zoom: galleryTaglistZoom / 100 }">
          <div class="eqt-gallery-taglist__row">
            <div class="eqt-gallery-taglist__label">language:</div>
            <div class="eqt-gallery-taglist__cells">
              <div class="eqt-gallery-chip eqt-gallery-chip--gt"><span class="eqt-gallery-chip__body">chinese</span></div>
              <div class="eqt-gallery-chip eqt-gallery-chip--gt"><span class="eqt-gallery-chip__body">translated</span></div>
            </div>
          </div>
          <div class="eqt-gallery-taglist__row">
            <div class="eqt-gallery-taglist__label">other:</div>
            <div class="eqt-gallery-taglist__cells">
              <div class="eqt-gallery-chip eqt-gallery-chip--gtl"><span class="eqt-gallery-chip__body">full color</span></div>
              <div class="eqt-gallery-chip eqt-gallery-chip--gtw"><span class="eqt-gallery-chip__body">story arc</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><MousePointerClick :size="14" /> {{ t('settings.galleryDblClickActions') }}</h4>
      <div
        v-for="({ labelKey, ref: r, newTabRef }) in galleryDblClickOptions"
        :key="labelKey"
        class="eqt-settings__field-row"
      >
        <label class="eqt-settings__field-label eqt-settings__field-label--aligned">{{ t(labelKey) }}</label>
        <select
          class="eqt-settings__select"
          :value="r.value"
          :disabled="!taggingEnhancerEnabled"
          @change="r.value = ($event.target as HTMLSelectElement).value as GalleryDblClickAction"
        >
          <option v-for="a in GALLERY_DBL_CLICK_ACTIONS" :key="a.id" :value="a.id">{{ t(a.labelKey) }}</option>
        </select>
        <label v-if="r.value === 'searchNewTab'" class="eqt-settings__row">
          <input
            type="checkbox"
            :checked="newTabRef.value"
            :disabled="!taggingEnhancerEnabled"
            @change="newTabRef.value = ($event.target as HTMLInputElement).checked"
          />
          <span class="eqt-settings__label">{{ t('settings.newTabActivate') }}</span>
        </label>
      </div>
    </section>

    <section class="eqt-settings__section">
      <h4 class="eqt-settings__subtitle"><Info :size="14" /> {{ t('settings.sectionIntroPanel') }}</h4>
      <div class="eqt-settings__field-row">
        <label class="eqt-settings__field-label">{{ t('settings.introPanelPrimaryLang') }}</label>
        <div class="eqt-settings__locale-row">
          <button
            v-for="m in INTRO_PANEL_PRIMARY_LANGS"
            :key="m.id"
            type="button"
            class="eqt-settings__locale-btn"
            :class="{ 'eqt-settings__locale-btn--active': introPanelPrimaryLang === m.id }"
            @click="introPanelPrimaryLang = m.id"
          >{{ t(m.labelKey) }}</button>
        </div>
      </div>
      <p class="eqt-settings__hint">
        {{ t('settings.introPanelPrimaryLangHint') }}
      </p>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="wikiPreludeExpanded"
          :disabled="!taggingEnhancerEnabled"
          @change="wikiPreludeExpanded = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.wikiPreludeExpanded') }}</span>
      </label>
      <p class="eqt-settings__hint">
        {{ t('settings.wikiPreludeExpandedHint') }}
      </p>
    </section>
  </div>
</template>

<style lang="scss">
.eqt-settings {
  &__range {
    width: 160px;
    height: var(--eqt-ctrl-h);
    margin: 0;
    accent-color: var(--eqt-border);

    &:disabled {
      opacity: 0.5;
    }
  }

  // 迷你 taglist 預覽：直接複用 gallery-taglist.scss 的 chip/grid class，
  // 跟實際 gallery 同一套樣式源，不另維護一份「長得像」的複製品。
  // pointer-events 關掉——純展示，不讓 chip :hover 假裝可點
  &__gallery-preview {
    pointer-events: none;
    border: 1px dashed var(--eqt-border);
    border-radius: 4px;
    padding: 4px 6px;
    overflow: hidden;
  }
}
</style>
