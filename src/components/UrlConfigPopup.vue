<script setup lang="ts">
import { ref, watch, onScopeDispose } from 'vue'
import { onClickOutside, useScrollLock, useEventListener } from '@vueuse/core'
import { GM_xmlhttpRequest } from '$'
import { hasGMXHR } from '@/services/gmStorage'
import type { QuickTag } from '@/types'
import { t } from '@/composables/useI18n'

const props = defineProps<{
  tag: QuickTag
  isAdd?: boolean
}>()

const emit = defineEmits<{
  'save': [value: QuickTag]
  'delete': []
  'close': []
}>()

const label = ref('')
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
  const detected = detectMode(t.url ?? '')
  urlMode.value = detected.mode
  url.value = detected.path
}, { immediate: true })

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    onSave()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

let abortFetch: { abort(): void } | null = null
onScopeDispose(() => abortFetch?.abort())

onClickOutside(popupEl, () => emit('close'))
useScrollLock(document.body, true)
useEventListener(document, 'keydown', onGlobalKeydown)

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
  emit('save', { tag: '', url: finalUrl, label: label.value.trim() || undefined })
}
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup eqt-popup--url">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('urlConfig.displayName') }}</label>
        <input
          v-model="label"
          class="eqt-popup__input"
          :placeholder="t('urlConfig.displayNameHint')"
        />
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
</template>

<style lang="scss">
.eqt-popup--url {
  min-height: auto;
}

.eqt-popup__url-row {
  display: flex;
  gap: 6px;

  .eqt-popup__input {
    flex: 1;
    min-width: 0;
  }
}

.eqt-popup__url-prefix {
  padding: 4px 6px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 3px;
  font-size: 13px;
  background: var(--eqt-bg-elevated);
  color: var(--eqt-text);
  flex-shrink: 0;

  &:focus {
    outline: none;
    border-color: var(--eqt-border-focus);
  }
}
</style>
