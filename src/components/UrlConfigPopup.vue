<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { GM_xmlhttpRequest } from '$'
import { hasGMXHR } from '@/services/gmStorage'
import type { QuickTag } from '@/types'

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
const fetchingTitle = ref(false)

watch(() => props.tag, (t) => {
  label.value = t.label ?? ''
  url.value = t.url ?? ''
}, { immediate: true })

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    onSave()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  abortFetch?.abort()
})

let abortFetch: { abort(): void } | null = null

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
  emit('save', { tag: '', url: trimmedUrl, label: label.value.trim() || undefined })
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')">
    <div class="eqt-popup eqt-popup--url">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">顯示名稱</label>
        <input
          v-model="label"
          class="eqt-popup__input"
          placeholder="（留空則顯示網址）"
        />
      </div>

      <hr class="eqt-popup__divider" />

      <div class="eqt-popup__field">
        <label class="eqt-popup__label">網址</label>
        <div class="eqt-popup__url-row">
          <input
            v-model="url"
            class="eqt-popup__input"
            placeholder="https://..."
          />
          <button
            class="eqt-popup__btn"
            type="button"
            :disabled="fetchingTitle || !url.trim()"
            @click="fetchTitle"
          >{{ fetchingTitle ? '取得中…' : '取得標題' }}</button>
        </div>
      </div>

      <div class="eqt-popup__actions">
        <button v-if="!isAdd" class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          刪除
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          取消 <kbd class="eqt-popup__kbd">Esc</kbd>
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          儲存 <kbd class="eqt-popup__kbd">Ctrl+Enter</kbd>
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
  }
}
</style>
