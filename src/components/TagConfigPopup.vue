<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { QuickTag } from '@/types'

const props = defineProps<{
  tag: QuickTag
}>()

const emit = defineEmits<{
  'save': [value: QuickTag]
  'delete': []
  'close': []
}>()

const form = reactive({ tag: '', label: '' })

watch(() => props.tag, (t) => {
  form.tag = t.tag
  form.label = t.label ?? ''
}, { immediate: true })

function onSave() {
  if (!form.tag.trim()) return
  emit('save', { tag: form.tag.trim(), label: form.label.trim() || undefined })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'Enter') onSave()
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')" @keydown="onKeydown">
    <div class="eqt-popup">
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">Tag</label>
        <input
          v-model="form.tag"
          class="eqt-popup__input"
          placeholder="female:stockings"
          @keydown="onKeydown"
        />
      </div>
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">Label</label>
        <input
          v-model="form.label"
          class="eqt-popup__input"
          placeholder="（留空則顯示 tag 原文）"
          @keydown="onKeydown"
        />
      </div>
      <div class="eqt-popup__actions">
        <button class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          刪除
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          取消
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          儲存
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.eqt-popup {
  background: #edebdf;
  border: 1px solid #8a8271;
  border-radius: 6px;
  padding: 16px;
  min-width: 300px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  font-size: 13px;
  color: #34353b;

  &__field {
    margin-bottom: 10px;
  }

  &__label {
    display: block;
    margin-bottom: 3px;
    font-weight: bold;
    font-size: 12px;
  }

  &__input {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid #8a8271;
    border-radius: 3px;
    font-size: 13px;
    background: #fff;
    color: #34353b;
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: #4a7c59;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
  }

  &__spacer {
    flex: 1;
  }

  &__btn {
    padding: 4px 12px;
    border: 1px solid #8a8271;
    border-radius: 3px;
    background: #ddd8c8;
    color: #34353b;
    cursor: pointer;
    font-size: 12px;

    &:hover {
      background: #cfc9b5;
    }

    &--primary {
      background: #4a7c59;
      border-color: #3d6b4a;
      color: #fff;

      &:hover {
        background: #3d6b4a;
      }
    }

    &--delete {
      background: #8c3333;
      border-color: #743030;
      color: #fff;

      &:hover {
        background: #743030;
      }
    }
  }
}
</style>
