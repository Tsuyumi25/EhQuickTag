<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClipboard, useTimeoutFn } from '@vueuse/core'
import { Copy, Download, Check } from '@lucide/vue'
import type { Line } from '@/types'
import { isValidLine, fontFamily, fontWeight } from '@/services/store'
import { t } from '@/composables/useI18n'
import { currentTagStyleClass } from '@/composables/useTagStyle'

const props = defineProps<{
  mode: 'normal' | 'deleted' | 'corrupted'
  name: string
  initialText: string
  corruptedReason?: string
}>()

const emit = defineEmits<{
  save: [lines: Line[]]
  restore: []
  purge: []
}>()

const editorText = ref(props.initialText)
const editorError = ref('')
const editorCopied = ref(false)
const { copy: clipboardCopy } = useClipboard({ legacy: true })
const { start: startCopiedTimer } = useTimeoutFn(() => { editorCopied.value = false }, 1500, { immediate: false })

const editorPreview = computed<Line[] | null>(() => {
  try {
    const parsed: unknown = JSON.parse(editorText.value)
    if (!Array.isArray(parsed) || !parsed.every(isValidLine)) return null
    return parsed
  } catch { return null }
})

function onEditorSave() {
  if (props.mode !== 'normal') return
  try {
    const parsed: unknown = JSON.parse(editorText.value)
    if (!Array.isArray(parsed) || !parsed.every(isValidLine)) {
      editorError.value = t('settings.editorInvalidShape')
      return
    }
    editorError.value = ''
    emit('save', parsed)
  } catch (err) {
    editorError.value = (err as Error).message
  }
}

async function onEditorCopy() {
  await clipboardCopy(editorText.value)
  editorCopied.value = true
  startCopiedTimer()
}

function onEditorExport() {
  const blob = new Blob([editorText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `EhQuickTag-${props.name}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="eqt-json-editor">
    <div class="eqt-json-editor__header">
      <h4 class="eqt-json-editor__title">{{ name }}</h4>
      <div class="eqt-json-editor__toolbar">
        <button class="eqt-json-editor__tool-btn" type="button" :title="editorCopied ? t('settings.editorCopied') : t('settings.editorCopy')" @click="onEditorCopy">
          <Check v-if="editorCopied" :size="14" />
          <Copy v-else :size="14" />
        </button>
        <button class="eqt-json-editor__tool-btn" type="button" :title="t('settings.editorExport')" @click="onEditorExport">
          <Download :size="14" />
        </button>
      </div>
    </div>

    <div
      v-if="editorPreview"
      class="eqt-settings__font-preview eqt-json-editor__preview"
      :class="currentTagStyleClass"
      :style="{ fontFamily: fontFamily || 'inherit', fontWeight: fontWeight || 'inherit' }"
    >
      <template v-for="(line, li) in editorPreview" :key="li">
        <div v-if="line.kind === 'buttons' && line.buttons.length" class="eqt-settings__preview-line">
          <span
            v-for="(b, ti) in line.buttons"
            :key="ti"
            class="eqt-settings__preview-tag"
            :class="{ 'eqt-settings__preview-tag--url': b.kind === 'url' }"
          >{{ b.label || (b.kind === 'tag' ? b.tags.join(', ') : b.url) || t('settings.emptyTag') }}</span>
        </div>
      </template>
    </div>

    <textarea
      v-model="editorText"
      class="eqt-json-editor__textarea"
      spellcheck="false"
      autocomplete="off"
      :readonly="mode !== 'normal'"
    />

    <p v-if="editorError" class="eqt-json-editor__error">{{ t('settings.editorJsonError', { message: editorError }) }}</p>

    <div v-if="mode === 'corrupted'" class="eqt-popup__actions">
      <p v-if="corruptedReason" class="eqt-json-editor__corrupted-reason">{{ t('settings.corruptedReason', { reason: corruptedReason }) }}</p>
      <button class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('purge')">{{ t('settings.purgeProfile') }}</button>
    </div>
    <div v-else-if="mode === 'deleted'" class="eqt-popup__actions" style="justify-content: center">
      <button class="eqt-popup__btn eqt-popup__btn--green" type="button" @click="emit('restore')">{{ t('settings.restoreProfile') }}</button>
      <button class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('purge')">{{ t('settings.purgeProfile') }}</button>
    </div>
    <div v-else class="eqt-popup__actions">
      <div class="eqt-popup__spacer" />
      <button class="eqt-popup__btn eqt-popup__btn--green" type="button" @click="onEditorSave">{{ t('settings.save') }}</button>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-json-editor {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__title {
    margin: 0;
    font-size: 13px;
    font-weight: bold;
  }

  &__toolbar {
    display: flex;
    gap: 4px;
  }

  &__tool-btn {
    @include btn-filled;
    width: 28px;
    height: 28px;
    padding: 0;
    // 還原 popup container 的 13px
    font-size: var(--eqt-fs-lg);
  }

  &__preview {
    margin-bottom: 8px;
    flex-shrink: 0;
    background: var(--eqt-bg);
  }

  &__textarea {
    flex: 1;
    min-height: 0;
    padding: 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg);
    color: var(--eqt-text);

    .eqt-dark & {
      background: var(--eqt-bg-elevated);
    }

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

  // 損壞 profile 的失敗原因——擠在 corrupted footer 的「永久刪除」左邊。
  // flex:1 + min-width:0 讓 reason 吃滿剩餘空間、過長自然換行（white-space
  // 走預設 normal）；general sibling combinator 給後面的 button 加
  // flex-shrink:0 確保按鈕文字永遠完整、不被 reason 推爆。
  &__corrupted-reason {
    flex: 1;
    min-width: 0;
    margin: 0;
    color: #c33;
    font-size: 12px;

    ~ .eqt-popup__btn {
      flex-shrink: 0;
    }
  }
}
</style>
