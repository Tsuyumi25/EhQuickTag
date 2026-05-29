<script setup lang="ts">
import { ref, inject, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset } from '@floating-ui/vue'
import { Palette, X } from '@lucide/vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'
import { t } from '@/composables/useI18n'

defineProps<{
  modelValue: string | undefined
  title?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>()

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)

const { floatingStyles } = useFloating(triggerEl, popupEl, {
  placement: 'bottom-start',
  middleware: [offset(4), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

onClickOutside(popupEl, () => { open.value = false }, { ignore: [triggerEl] })

// 在 parent popup 裡使用時，自己向 parent 登記「這個 teleport 出去的浮層 el
// 屬於 popup 一部分」，避免 parent 的 onClickOutside 誤判點浮層 = 點外面。
// open 切換時 popupEl 變 null/element，watch 自動清掉舊 el。
const registerIgnore = inject<PopupIgnoreRegister | undefined>(POPUP_IGNORE_KEY, undefined)
let unregister: (() => void) | null = null
watch(popupEl, (el) => {
  if (unregister) { unregister(); unregister = null }
  if (el && registerIgnore) unregister = registerIgnore(el)
})

function clearColor() {
  emit('update:modelValue', undefined)
  open.value = false
}
</script>

<template>
  <button
    ref="triggerEl"
    v-bind="$attrs"
    type="button"
    class="eqt-line-color__trigger"
    :style="modelValue ? { color: modelValue } : undefined"
    :title="title ?? t('tagbar.lineColor')"
    @click="open = !open"
  >
    <Palette :size="12" />
  </button>
  <Teleport to="body">
    <div v-if="open" ref="popupEl" class="eqt-line-color__popup" :style="floatingStyles">
      <ColorPicker :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />
      <button type="button" class="eqt-line-color__clear" @click="clearColor">
        <X :size="12" /> {{ t('tagbar.lineColorClear') }}
      </button>
    </div>
  </Teleport>
</template>

<style lang="scss">
.eqt-line-color {
  &__trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--eqt-row-h);
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;

    &:hover {
      color: var(--eqt-text-secondary);
    }
  }

  &__popup {
    z-index: 100000;
    padding: 8px;
    background: var(--eqt-bg);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 12px;

    &:hover {
      background: var(--eqt-bg-hover);
    }
  }
}
</style>
