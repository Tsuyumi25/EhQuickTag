<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { t } from '@/composables/useI18n'
import { useIntroPanel } from '@/composables/useIntroPanel'

const {
  openTag, entry, introHtml, linksHtml, iconUrl, wikiEntry, wikiUrl, extraImages,
  displayedLang, toggleLang, close, zhDisplay,
  preludeExpanded, togglePrelude,
} = useIntroPanel()

const contentEl = ref<HTMLElement | null>(null)
// __content 真的溢出可滾時才 true → 只有這時給它 overscroll-behavior:contain（見 scss）。
// 短內容時不 contain，wheel 才能正常冒泡去滾頁面（否則 cursor 停在 panel 上頁面卡死）。
const contentScrollable = ref(false)

function measureScrollable(): void {
  const el = contentEl.value
  contentScrollable.value = !!el && el.scrollHeight - el.clientHeight > 1
}

// 內容變動（換 tag / 換語言 / prelude 展開）都可能改高度 → 重量。順帶跟 EhSyringe 對齊，
// 對 v-html 內的圖補 referrerPolicy='no-referrer'（避免 EH referrer 觸發 hot-link 防護），
// 圖片載入後高度會變、載完再量一次。
watch(
  [openTag, introHtml, wikiEntry, extraImages, displayedLang, preludeExpanded],
  async () => {
    await nextTick()
    const el = contentEl.value
    if (!el) {
      contentScrollable.value = false
      return
    }
    for (const img of el.querySelectorAll<HTMLImageElement>('img')) {
      img.referrerPolicy = 'no-referrer'
      if (!img.complete) img.addEventListener('load', measureScrollable, { once: true })
    }
    measureScrollable()
  },
  { immediate: true },
)

// panel 尺寸變動（視窗 / gd5 resize）→ clientHeight 變 → 重量
let ro: ResizeObserver | undefined
watch(contentEl, (el) => {
  ro?.disconnect()
  if (el) {
    ro = new ResizeObserver(measureScrollable)
    ro.observe(el)
  }
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <Teleport to="#gd5" :disabled="!openTag">
    <div v-if="openTag" class="eqt-intro-panel">
      <div class="eqt-intro-panel__title">
        <div class="eqt-intro-panel__name">
          <template v-if="displayedLang === 'en'">
            <a
              class="eqt-intro-panel__name-display"
              :href="wikiUrl ?? undefined"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img v-if="iconUrl" :src="iconUrl" class="eqt-intro-panel__name-icon" alt="" referrerpolicy="no-referrer" />{{ openTag.raw }}
            </a>
            <code class="eqt-intro-panel__name-key">{{ openTag.ns }}</code>
          </template>
          <template v-else>
            <span v-if="entry" class="eqt-intro-panel__name-display">
              <img v-if="iconUrl" :src="iconUrl" class="eqt-intro-panel__name-icon" alt="" referrerpolicy="no-referrer" />{{ zhDisplay(entry.name) }}
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

      <div ref="contentEl" class="eqt-intro-panel__content" :class="{ 'is-scrollable': contentScrollable }">
        <template v-if="displayedLang === 'zh'">
          <div v-if="introHtml" v-html="introHtml" />
          <div v-else class="eqt-intro-panel__empty">{{ t('intro.empty') }}</div>
        </template>
        <template v-else>
          <div v-if="wikiEntry" class="eqt-intro-panel__wiki">
            <div
              v-for="(variant, i) in wikiEntry"
              :key="i"
              class="eqt-intro-panel__wiki-variant"
            >
              <div class="eqt-intro-panel__wiki-variant-num" v-if="wikiEntry.length > 1">{{ i + 1 }}</div>
              <div class="eqt-intro-panel__wiki-body">
                <template v-if="variant.prelude">
                  <button
                    type="button"
                    class="eqt-intro-panel__wiki-prelude-toggle"
                    :title="t('intro.togglePrelude')"
                    @click="togglePrelude"
                  >
                    <span class="eqt-intro-panel__wiki-prelude-caret" :class="{ 'is-expanded': preludeExpanded }">▸</span>
                    <span>{{ t('intro.preludeLabel') }}</span>
                  </button>
                  <div
                    v-show="preludeExpanded"
                    class="eqt-intro-panel__wiki-prelude"
                    v-html="variant.prelude"
                  />
                </template>
                <div
                  v-for="(block, j) in variant.blocks"
                  :key="j"
                  class="eqt-intro-panel__wiki-block"
                  v-html="block"
                />
              </div>
            </div>
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
