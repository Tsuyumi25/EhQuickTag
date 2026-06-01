<script setup lang="ts">
import { ref, watch, computed, onScopeDispose } from 'vue'
import { GM_xmlhttpRequest } from '$'
import { hasGMXHR } from '@/services/gmStorage'
import ContentEditable from 'vue-contenteditable'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import type { UrlButton } from '@/types'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  tag: UrlButton
  lineColor?: string
  isAdd?: boolean
}>()

const emit = defineEmits<{
  'save': [value: UrlButton]
  'delete': []
  'close': []
}>()

const label = ref('')
const color = ref<string | undefined>(undefined)
const effectiveColor = computed(() => color.value ?? props.lineColor)

const url = ref('')
const urlMode = ref<'eh' | 'full'>('eh')
const fetchingTitle = ref(false)
const popupEl = ref<HTMLElement | null>(null)

const EH_DOMAINS = ['e-hentai.org', 'exhentai.org']

function detectMode(raw: string): { mode: 'eh' | 'full'; path: string } {
  if (!raw || raw.startsWith('?') || raw.startsWith('/')) {
    return { mode: 'eh', path: raw }
  }
  try {
    const u = new URL(raw, 'https://e-hentai.org')
    if (EH_DOMAINS.includes(u.hostname)) {
      return { mode: 'eh', path: u.pathname + u.search }
    }
  } catch { /* not a valid URL */ }
  return { mode: 'full', path: raw }
}

watch(() => props.tag, (t) => {
  label.value = t.label ?? ''
  color.value = t.color
  const detected = detectMode(t.url ?? '')
  urlMode.value = detected.mode
  url.value = detected.path
}, { immediate: true })

// 註：t.url 是 required，但「新增」流程會傳一個 url='' 的 draft 進來，所以仍要 ?? ''

let abortFetch: { abort(): void } | null = null
onScopeDispose(() => abortFetch?.abort())

usePopupBehavior({
  popupEl,
  onClose: () => emit('close'),
  onSave,
})

function fetchTitle() {
  const trimmed = url.value.trim()
  if (!trimmed || !hasGMXHR) return

  abortFetch?.abort()
  fetchingTitle.value = true
  abortFetch = GM_xmlhttpRequest({
    method: 'GET',
    url: trimmed,
    headers: { Range: 'bytes=0-8191' },
    timeout: 10_000,
    onload: (res) => {
      fetchingTitle.value = false
      abortFetch = null
      if (res.status !== 200 && res.status !== 206) return
      const chunk = res.responseText.slice(0, 8192)
      const match = chunk.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (match) {
        label.value = match[1].trim()
      }
    },
    onerror: () => { fetchingTitle.value = false; abortFetch = null },
    ontimeout: () => { fetchingTitle.value = false; abortFetch = null },
  })
}

function onSave() {
  const trimmedUrl = url.value.trim()
  if (!trimmedUrl) return
  const finalUrl = urlMode.value === 'eh' ? detectMode(trimmedUrl).path : trimmedUrl
  emit('save', { kind: 'url', url: finalUrl, label: label.value.trim() || undefined, color: color.value })
}
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup eqt-popup--url">
      <div class="eqt-popup__body">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('urlConfig.displayName') }}</label>
        <div class="eqt-popup__field-row" :class="currentTagStyleClass">
          <ContentEditable
            tag="span"
            :model-value="label"
            @update:model-value="(v: string) => label = v === '\n' ? '' : v"
            :contenteditable="'plaintext-only'"
            class="eqt-popup__name-input"
            spellcheck="false"
            :data-placeholder="t('urlConfig.displayNameHint')"
            :style="effectiveColor ? { '--line-color': effectiveColor } : undefined"
            no-nl
          />
          <LineColorSwatch
            v-model="color"
            :title="t('common.itemColor')"
          />
        </div>
      </div>

      <hr class="eqt-popup__divider" />

      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('urlConfig.url') }}</label>
        <div class="eqt-popup__url-row">
          <select
            v-model="urlMode"
            class="eqt-popup__url-prefix"
          >
            <option value="eh">e[-x]hentai.org</option>
            <option value="full">{{ t('urlConfig.fullUrl') }}</option>
          </select>
          <input
            v-model="url"
            class="eqt-popup__input"
            :placeholder="urlMode === 'eh' ? '/?f_cats=991' : 'https://...'"
          />
          <button
            v-if="urlMode === 'full'"
            class="eqt-popup__btn"
            type="button"
            :disabled="fetchingTitle || !url.trim()"
            @click="fetchTitle"
          >{{ fetchingTitle ? t('urlConfig.fetching') : t('urlConfig.fetchTitle') }}</button>
        </div>
      </div>

      <div class="eqt-popup__actions">
        <button v-if="!isAdd" class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          {{ t('urlConfig.delete') }}
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          {{ t('urlConfig.cancel') }} <kbd class="eqt-popup__kbd">Esc</kbd>
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          {{ t('urlConfig.save') }} <kbd class="eqt-popup__kbd">Ctrl+Enter</kbd>
        </button>
      </div>
      </div>
    </div>
  </div>
</template>

