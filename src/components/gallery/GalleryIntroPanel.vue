<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { t } from '@/composables/useI18n'
import { useIntroPanel } from '@/composables/useIntroPanel'

const {
  openTag, entry, introHtml, linksHtml, iconUrl, wikiEntry, wikiUrl, extraImages,
  displayedLang, toggleLang, close, cjkDisplay,
} = useIntroPanel()

const contentEl = ref<HTMLElement | null>(null)

// 跟 EhSyringe 對齊：referrerPolicy='no-referrer' 避免 EH 端 referrer 觸發 hot-link 防護
watch(introHtml, async () => {
  await nextTick()
  if (!contentEl.value) return
  for (const img of contentEl.value.querySelectorAll<HTMLImageElement>('img')) {
    img.referrerPolicy = 'no-referrer'
  }
})
</script>

<template>
  <Teleport to="#gd5" :disabled="!openTag">
    <div v-if="openTag" class="eqt-intro-panel">
      <div class="eqt-intro-panel__title">
        <div class="eqt-intro-panel__name">
          <template v-if="displayedLang === 'en'">
            <span class="eqt-intro-panel__name-cn">
              <img v-if="iconUrl" :src="iconUrl" class="eqt-intro-panel__name-icon" alt="" referrerpolicy="no-referrer" />{{ openTag.raw }}
            </span>
            <code class="eqt-intro-panel__name-key">{{ openTag.ns }}</code>
          </template>
          <template v-else>
            <span v-if="entry" class="eqt-intro-panel__name-cn">
              <img v-if="iconUrl" :src="iconUrl" class="eqt-intro-panel__name-icon" alt="" referrerpolicy="no-referrer" />{{ cjkDisplay(entry.name) }}
            </span>
            <code class="eqt-intro-panel__name-key">{{ openTag.nsRaw }}</code>
          </template>
        </div>
        <button
          type="button"
          class="eqt-intro-panel__lang-toggle-btn"
          :title="t('intro.toggleLang')"
          @click="toggleLang"
        >
          <span class="eqt-intro-panel__lang-toggle-stack">
            <span :class="{ 'is-visible': displayedLang === 'zh' }">EN</span>
            <span :class="{ 'is-visible': displayedLang === 'en' }">中</span>
          </span>
        </button>
        <button
          type="button"
          class="eqt-intro-panel__close-btn"
          :title="t('intro.close')"
          @click="close"
        >×</button>
      </div>

      <div ref="contentEl" class="eqt-intro-panel__content">
        <template v-if="displayedLang === 'zh'">
          <div v-if="introHtml" v-html="introHtml" />
          <div v-else class="eqt-intro-panel__empty">{{ t('intro.empty') }}</div>
        </template>
        <template v-else>
          <div v-if="wikiEntry" class="eqt-intro-panel__wiki">
            <div
              v-for="(variant, i) in wikiEntry.variants"
              :key="i"
              class="eqt-intro-panel__wiki-variant"
            >
              <div class="eqt-intro-panel__wiki-variant-num" v-if="wikiEntry.variants.length > 1">{{ i + 1 }}</div>
              <dl class="eqt-intro-panel__wiki-fields">
                <template v-for="(val, key) in variant" :key="key">
                  <dt>{{ key }}</dt>
                  <dd>{{ val }}</dd>
                </template>
              </dl>
            </div>
            <dl
              v-if="Object.keys(wikiEntry.shared).length"
              class="eqt-intro-panel__wiki-fields eqt-intro-panel__wiki-shared"
            >
              <template v-for="(val, key) in wikiEntry.shared" :key="key">
                <dt>{{ key }}</dt>
                <dd>{{ val }}</dd>
              </template>
            </dl>
            <a
              v-if="wikiUrl"
              class="eqt-intro-panel__wiki-source"
              :href="wikiUrl"
              target="_blank"
              rel="noopener noreferrer"
            >via ehwiki.org</a>
          </div>
          <div v-else class="eqt-intro-panel__empty">{{ t('intro.empty') }}</div>
          <div v-if="extraImages.length" class="eqt-intro-panel__wiki-images">
            <img
              v-for="(src, i) in extraImages"
              :key="i"
              :src="src"
              alt=""
              referrerpolicy="no-referrer"
            />
          </div>
        </template>
      </div>

      <div
        v-if="linksHtml"
        class="eqt-intro-panel__links"
        v-html="linksHtml"
      />
    </div>
  </Teleport>
</template>
