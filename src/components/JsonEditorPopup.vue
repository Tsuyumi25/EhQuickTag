<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Copy, Download, Upload, Check } from '@lucide/vue'

const props = defineProps<{
  modelValue: string
  title?: string
}>()

const emit = defineEmits<{
  save: [value: string]
  close: []
}>()

const text = ref(props.modelValue)
const error = ref('')
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

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
  clearTimeout(copiedTimer)
})

async function onCopy() {
  try {
    await navigator.clipboard.writeText(text.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text.value
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1500)
}

function onExport() {
  const blob = new Blob([text.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `eh-quick-tag-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      try {
        const parsed = JSON.parse(content)
        text.value = JSON.stringify(parsed, null, 2)
        error.value = ''
      } catch (err) {
        error.value = (err as Error).message
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function onSave() {
  try {
    JSON.parse(text.value)
    error.value = ''
    emit('save', text.value)
  } catch (err) {
    error.value = (err as Error).message
  }
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')">
    <div class="eqt-popup eqt-json-editor">
      <div class="eqt-json-editor__header">
        <h3 class="eqt-json-editor__title">{{ title ?? 'JSON 編輯器' }}</h3>
        <div class="eqt-json-editor__toolbar">
          <button class="eqt-json-editor__tool-btn" type="button" :title="copied ? '已複製' : '複製'" @click="onCopy">
            <Check v-if="copied" :size="14" />
            <Copy v-else :size="14" />
          </button>
          <button class="eqt-json-editor__tool-btn" type="button" title="匯出檔案" @click="onExport">
            <Download :size="14" />
          </button>
          <button class="eqt-json-editor__tool-btn" type="button" title="匯入檔案" @click="onImport">
            <Upload :size="14" />
          </button>
        </div>
      </div>

      <textarea
        v-model="text"
        class="eqt-json-editor__textarea"
        spellcheck="false"
        autocomplete="off"
      />

      <p v-if="error" class="eqt-json-editor__error">JSON 格式錯誤：{{ error }}</p>

      <div class="eqt-popup__actions">
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
.eqt-json-editor {
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  &__title {
    margin: 0;
    font-size: 15px;
    font-weight: bold;
  }

  &__toolbar {
    display: flex;
    gap: 4px;
  }

  &__tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-btn-hover);
    }
  }

  &__textarea {
    flex: 1;
    min-height: 0;
    padding: 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    tab-size: 2;
    resize: none;
    white-space: pre;
    overflow: auto;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }
  }

  &__error {
    margin: 6px 0 0;
    padding: 4px 8px;
    font-size: 12px;
    color: #c33;
    background: rgba(204, 51, 51, 0.08);
    border-radius: 3px;
  }
}
</style>
