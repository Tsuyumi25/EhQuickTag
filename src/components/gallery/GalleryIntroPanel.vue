<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Teleport } from 'vue'
import { t } from '@/composables/useI18n'
import { useIntroPanel } from '@/composables/useIntroPanel'

const { openTag, entry, introHtml, linksHtml, iconUrl, close, cjkDisplay } = useIntroPanel()

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
          <span v-if="entry" class="eqt-intro-panel__name-cn">
            <img v-if="iconUrl" :src="iconUrl" class="eqt-intro-panel__name-icon" alt="" referrerpolicy="no-referrer" />{{ cjkDisplay(entry.name) }}
          </span>
          <code class="eqt-intro-panel__name-key">{{ openTag.nsRaw }}</code>
        </div>
        <button
          type="button"
          class="eqt-intro-panel__close-btn"
          :title="t('intro.close')"
          @click="close"
        >×</button>
      </div>

      <div ref="contentEl" class="eqt-intro-panel__content">
        <div v-if="introHtml" v-html="introHtml" />
        <div v-else class="eqt-intro-panel__empty">{{ t('intro.empty') }}</div>
      </div>

      <div
        v-if="linksHtml"
        class="eqt-intro-panel__links"
        v-html="linksHtml"
      />
    </div>
  </Teleport>
</template>
