<script setup lang="ts">
import { ref, computed, inject, provide, watch, nextTick } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset, type Placement, type VirtualElement } from '@floating-ui/vue'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  anchorWidth?: number
  anchorHeight?: number
  placement?: Placement
  ignore?: Array<HTMLElement | null>
  autoFocus?: boolean
  ariaRole?: 'menu' | 'dialog'
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const menuEl = ref<HTMLElement | null>(null)

// 錨點不是 DOM 元素而是 caller 提供的座標／矩形——右鍵入口使用零尺寸游標點，
// overflow button 則帶實際寬高，讓 flip 到另一側時仍保留按鈕邊界與 offset。
const anchor = computed<VirtualElement>(() => ({
  getBoundingClientRect: () => ({
    x: props.x, y: props.y,
    width: props.anchorWidth ?? 0,
    height: props.anchorHeight ?? 0,
    top: props.y,
    left: props.x,
    right: props.x + (props.anchorWidth ?? 0),
    bottom: props.y + (props.anchorHeight ?? 0),
  }),
}))

const { floatingStyles } = useFloating(anchor, menuEl, {
  placement: () => props.placement ?? 'bottom-start',
  middleware: [offset(2), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

function close(): void {
  emit('update:open', false)
}

const childIgnoreList = ref<HTMLElement[]>([])
provide<PopupIgnoreRegister>(POPUP_IGNORE_KEY, (el) => {
  childIgnoreList.value = [...childIgnoreList.value, el]
  return () => {
    childIgnoreList.value = childIgnoreList.value.filter(item => item !== el)
  }
})
const outsideIgnoreList = computed(() => [
  ...childIgnoreList.value,
  ...(props.ignore ?? []).filter((el): el is HTMLElement => el !== null),
])
onClickOutside(menuEl, close, { ignore: outsideIgnoreList })

// 開啟（或座標變動 = 在別處重開）時，dialog 模式把焦點主動送進 popup，
// 讓鍵盤使用者不必從觸發器一路 Tab 到 Teleport 尾端。
watch(() => [props.open, props.x, props.y] as const, async ([open]) => {
  if (!open || !props.autoFocus) return
  await nextTick()
  menuEl.value?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')?.focus()
}, { immediate: true })

// capture + stopPropagation：外層 popup（usePopupBehavior）也在 document 聽
// keydown，Escape 若走到那邊會連 parent popup 一起關。capture phase 在
// document 的 bubble 訪問之前，stopPropagation 能整段擋下
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (!props.open || e.key !== 'Escape') return
  close()
  e.preventDefault()
  e.stopPropagation()
}, { capture: true })

// 在 parent popup 裡使用時向其登記 teleport 出去的 el，避免 parent 的
// onClickOutside 把「點選單」誤判成「點外面」（同 AnchoredPopover 的機制）
const registerIgnore = inject<PopupIgnoreRegister | undefined>(POPUP_IGNORE_KEY, undefined)
let unregister: (() => void) | null = null
watch(menuEl, (el) => {
  if (unregister) { unregister(); unregister = null }
  if (el && registerIgnore) unregister = registerIgnore(el)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuEl"
      :style="floatingStyles"
      class="eqt-context-menu"
      :role="ariaRole ?? 'menu'"
      :aria-label="ariaLabel"
      @contextmenu.prevent
    >
      <slot />
    </div>
  </Teleport>
</template>

<style lang="scss">
.eqt-context-menu {
  z-index: var(--eqt-z-popover);
  min-width: 140px;
  padding: 4px;
  // 不用 --eqt-bg-elevated：light theme 那是純白、脫離 EH 米色系。--eqt-bg-btn
  // 在 light 是次要米色、dark 剛好就是 elevated 同值，兩邊都落在主題色上
  background: var(--eqt-bg-btn);
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-md);
  box-shadow: var(--eqt-shadow-popover);
  font-size: var(--eqt-fs-md);
  color: var(--eqt-text);

  &__item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border: none;
    border-radius: var(--eqt-radius-sm);
    background: none;
    color: inherit;
    font-size: inherit;
    text-align: left;
    cursor: pointer;

    &--danger {
      color: var(--eqt-danger);

      &:hover:not(:disabled) {
        background: var(--eqt-danger-bg-hover);
      }
    }

    &:hover:not(:disabled) {
      background: var(--eqt-bg-btn-hover);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  &__icon {
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    white-space: nowrap;
  }

  &__separator {
    height: 1px;
    margin: 4px 2px;
    background: var(--eqt-divider);
  }
}
</style>
