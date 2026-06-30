<script setup lang="ts">
import { CircleAlert, ExternalLink, Code } from '@lucide/vue'
import { t } from '@/composables/useI18n'

const appVersion = __APP_VERSION__
</script>

<template>
  <div class="eqt-settings__tab-content eqt-settings__about">
    <div class="eqt-about__hero">
      <div class="eqt-about__title">EH Quick Tag</div>
      <div class="eqt-about__version">v{{ appVersion }}</div>
      <div class="eqt-about__desc">{{ t('about.desc') }}</div>
      <div class="eqt-about__actions">
        <a class="eqt-about__action-btn" href="https://github.com/Tsuyumi25/EhQuickTag" target="_blank" rel="noopener"><Code :size="14" /> GitHub</a>
        <a class="eqt-about__action-btn" href="https://github.com/Tsuyumi25/EhQuickTag/issues" target="_blank" rel="noopener"><CircleAlert :size="14" /> {{ t('about.reportIssue') }}</a>
      </div>
    </div>

    <div class="eqt-about__section">
      <div class="eqt-about__section-title">{{ t('about.inspiration') }}</div>
      <div class="eqt-about__items">
        <a class="eqt-about__item" href="https://sleazyfork.org/scripts/454282" target="_blank" rel="noopener">
          <ExternalLink :size="12" /> Add button on exhentai searchbox
        </a>
        <a class="eqt-about__item" href="https://sleazyfork.org/scripts/454209" target="_blank" rel="noopener">
          <ExternalLink :size="12" /> ExAdvancedSearchMemo
        </a>
        <a class="eqt-about__item" href="https://sleazyfork.org/scripts/516145" target="_blank" rel="noopener">
          <ExternalLink :size="12" /> Lolicon E-Hentai/ExHentai Enhancer
        </a>
      </div>
    </div>

    <div class="eqt-about__section">
      <div class="eqt-about__section-title">{{ t('about.techRef') }}</div>
      <div class="eqt-about__items">
        <a class="eqt-about__item" href="https://github.com/sk2589822/Exhentai-Enhancer" target="_blank" rel="noopener">
          <Code :size="12" /> sk2589822/Exhentai-Enhancer
        </a>
        <a class="eqt-about__item" href="https://github.com/mokurin000/e-hentai-tag-count" target="_blank" rel="noopener">
          <Code :size="12" /> mokurin000/e-hentai-tag-count
        </a>
      </div>
    </div>

    <div class="eqt-about__section">
      <div class="eqt-about__section-title">{{ t('about.credits') }}</div>
      <div class="eqt-about__items">
        <a class="eqt-about__item" href="https://github.com/EhTagTranslation/Database" target="_blank" rel="noopener">
          <Code :size="12" /> EhTagTranslation/Database
          <span class="eqt-about__item-detail">{{ t('about.ehttDetail') }}</span>
        </a>
        <a class="eqt-about__item" href="https://github.com/EhTagTranslation/EhSyringe" target="_blank" rel="noopener">
          <Code :size="12" /> EhTagTranslation/EhSyringe
          <span class="eqt-about__item-detail">{{ t('about.ehsyringeDetail') }}</span>
        </a>
        <a class="eqt-about__item" href="https://github.com/BYVoid/OpenCC" target="_blank" rel="noopener">
          <Code :size="12" /> BYVoid/OpenCC
          <span class="eqt-about__item-detail">{{ t('about.openccDetail') }}</span>
        </a>
        <a class="eqt-about__item" href="https://github.com/URenko/e-hentai-db" target="_blank" rel="noopener">
          <Code :size="12" /> URenko/e-hentai-db
          <span class="eqt-about__item-detail">{{ t('about.urenkoDbDetail') }}</span>
        </a>
      </div>
    </div>

    <div class="eqt-about__footer">MIT License</div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-about {
  &__hero {
    text-align: center;
    padding: 20px 16px;
    margin-bottom: 16px;
    border-radius: 6px;
    background: var(--eqt-bg-hover);
  }

  &__title {
    font-size: 18px;
    font-weight: bold;
    color: var(--eqt-text);
  }

  &__version {
    margin-top: 2px;
    font-size: 11px;
    color: var(--eqt-text-hint);
  }

  &__desc {
    margin-top: 4px;
    font-size: 12px;
    color: var(--eqt-text-hint);
  }

  &__actions {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
  }

  &__action-btn {
    @include btn-filled;
    padding: 4px 12px;
    text-decoration: none;
  }

  &__section {
    margin-bottom: 12px;
  }

  &__section-title {
    font-size: 11px;
    font-weight: bold;
    color: var(--eqt-text-hint);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 3px;
    font-size: 12px;
    color: var(--eqt-text);
    text-decoration: none;

    &:hover {
      background: var(--eqt-bg-hover);
    }
  }

  &__item-detail {
    color: var(--eqt-text-hint);
    font-size: 11px;
    margin-left: auto;
  }

  &__footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: var(--eqt-border-width) solid var(--eqt-border);
    font-size: 11px;
    color: var(--eqt-text-hint);
    text-align: center;
  }
}
</style>
