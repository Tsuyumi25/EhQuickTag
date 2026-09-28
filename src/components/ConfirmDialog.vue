<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { t } from '@/composables/useI18n'
import { confirmRequest } from '@/services/confirmDialog'

function onOpenChange(open: boolean): void {
  if (!open) confirmRequest.value?.resolve(false)
}
</script>

<template>
  <AlertDialogRoot :open="!!confirmRequest" @update:open="onOpenChange">
    <!-- 送進 #eqt-app：box model reset、translate="no" 和字型設定都在那裡 -->
    <AlertDialogPortal to="#eqt-app">
      <AlertDialogOverlay class="eqt-confirm__overlay" />
      <AlertDialogContent v-if="confirmRequest" class="eqt-confirm">
        <AlertDialogTitle class="eqt-confirm__title">{{ t('confirm.title') }}</AlertDialogTitle>
        <AlertDialogDescription class="eqt-confirm__message">{{ confirmRequest.message }}</AlertDialogDescription>
        <!-- 取消排在前面：焦點預設落在第一個按鈕，按 Enter 不會直接刪掉 -->
        <div class="eqt-confirm__actions">
          <AlertDialogCancel class="eqt-confirm__cancel">{{ t('confirm.keep') }}</AlertDialogCancel>
          <!-- 不用 AlertDialogAction：它的關閉會先觸發 update:open，把這次當成取消 -->
          <button
            type="button"
            class="eqt-confirm__action"
            @click="confirmRequest?.resolve(true)"
          >{{ confirmRequest.confirmLabel }}</button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

.eqt-confirm__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--eqt-z-popover);
  background: var(--eqt-overlay);
}

.eqt-confirm {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: var(--eqt-z-popover);
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(24rem, 90vw);
  padding: 1.25rem;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-md);
  background: var(--eqt-bg);
  box-shadow: var(--eqt-shadow);
  color: var(--eqt-text);

  &__title {
    margin: 0;
    font-size: var(--eqt-fs-lg);
  }

  // EH 的 g.css 對 h2 / p 另設字型，這裡要跟著面板走
  &__title,
  &__message {
    font-family: inherit;
  }

  &__message {
    margin: 0;
    font-size: var(--eqt-fs-md);
    white-space: pre-line;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  &__cancel {
    @include btn-toned;
    padding: 4px 12px;
  }

  &__action {
    @include btn-danger;
    padding: 4px 12px;
  }
}
</style>
