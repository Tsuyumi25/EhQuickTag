<script setup lang="ts">
const props = defineProps<{
  useNhWeight: boolean
}>()

const emit = defineEmits<{
  'update:useNhWeight': [value: boolean]
  'close': []
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="eqt-popup-overlay" @click.self="emit('close')" @keydown="onKeydown">
    <div class="eqt-popup">
      <h3 class="eqt-popup__title">EH Quick Tag 設定</h3>

      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="props.useNhWeight"
          @change="emit('update:useNhWeight', ($event.target as HTMLInputElement).checked)"
        />
        <span class="eqt-settings__label">使用 nhentai 人氣權重排序</span>
      </label>
      <p class="eqt-settings__hint">
        開啟後，搜尋建議會優先顯示 nhentai 上傳量高的標籤（top 500），其餘按預設公式排序。
      </p>

      <div class="eqt-popup__actions">
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="emit('close')">
          關閉
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-popup__title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: bold;
}

.eqt-settings {
  &__row {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
  }

  &__label {
    user-select: none;
  }

  &__hint {
    margin: 4px 0 0;
    font-size: 11px;
    color: #8a8271;
    line-height: 1.4;
  }
}
</style>
