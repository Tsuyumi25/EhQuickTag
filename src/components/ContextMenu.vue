<script lang="ts">
import type { Component } from 'vue'

export interface ContextMenuItem {
  kind: 'item'
  key: string
  label: string
  icon?: Component
  disabled?: boolean
  danger?: boolean
}

export interface ContextMenuSeparator {
  kind: 'separator'
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator
</script>

<script setup lang="ts">
import { ref, computed, inject, provide, watch } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset, type Placement, type VirtualElement } from '@floating-ui/vue'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  anchorWidth?: number
  anchorHeight?: number
  entries: ContextMenuEntry[]
  placement?: Placement
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [key: string]
  enter: []
  leave: []
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

function selectItem(item: ContextMenuItem): void {
  if (item.disabled) return
  emit('select', item.key)
  close()
}

const childIgnoreList: HTMLElement[] = []
provide<PopupIgnoreRegister>(POPUP_IGNORE_KEY, (el) => {
  childIgnoreList.push(el)
  return () => {
    const idx = childIgnoreList.indexOf(el)
    if (idx >= 0) childIgnoreList.splice(idx, 1)
  }
})
onClickOutside(menuEl, close, { ignore: childIgnoreList })

// --- 鍵盤導覽 ---

const activeIdx = ref(-1)

const isEnabled = (e: ContextMenuEntry) => e.kind === 'item' && !e.disabled

// 開啟（或座標變動 = 在別處重開）時重置高亮
watch(() => [props.open, props.x, props.y], () => { activeIdx.value = -1 })

function move(dir: 1 | -1): void {
  const n = props.entries.length
  if (!props.entries.some(isEnabled)) return
  let i = activeIdx.value
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n
    if (isEnabled(props.entries[i])) { activeIdx.value = i; return }
  }
}

function moveEdge(dir: 1 | -1): void {
  activeIdx.value = dir === 1 ? -1 : props.entries.length
  move(dir)
}

// capture + stopPropagation：外層 popup（usePopupBehavior）也在 document 聽
// keydown，Escape 若走到那邊會連 parent popup 一起關。capture phase 在
// document 的 bubble 訪問之前，stopPropagation 能整段擋下
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (!props.open) return
  // 嵌入內容（slot 裡的 color picker、輸入框等）拿著 focus 時，Enter/Space/
  // 方向鍵都是它的——選單導覽只在 focus 不在嵌入 widget 上時接手。Escape
  // 永遠歸選單（任何狀態都能關）。shadow DOM 內的事件 target 會 retarget
  // 到 host element，contains 照常成立
  const target = e.target as HTMLElement | null
  const inEmbedded = !!target && !!menuEl.value?.contains(target)
    && !target.classList?.contains('eqt-context-menu__item')
  if (inEmbedded && e.key !== 'Escape') return
  switch (e.key) {
    case 'Escape': close(); break
    case 'ArrowDown': move(1); break
    case 'ArrowUp': move(-1); break
    case 'Home': moveEdge(1); break
    case 'End': moveEdge(-1); break
    case 'Enter':
    case ' ': {
      const entry = props.entries[activeIdx.value]
      if (entry?.kind === 'item') selectItem(entry)
      break
    }
    default: return
  }
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
      @contextmenu.prevent
      @mouseenter="emit('enter')"
      @mouseleave="emit('leave'); activeIdx = -1"
    >
      <template v-for="(entry, i) in entries" :key="i">
        <div v-if="entry.kind === 'separator'" class="eqt-context-menu__separator" />
        <button
          v-else
          type="button"
          class="eqt-context-menu__item"
          :class="{
            'eqt-context-menu__item--active': i === activeIdx,
            'eqt-context-menu__item--danger': entry.danger,
          }"
          :disabled="entry.disabled"
          @mouseenter="activeIdx = i"
          @click="selectItem(entry)"
        >
          <component :is="entry.icon" v-if="entry.icon" :size="14" class="eqt-context-menu__icon" />
          <span class="eqt-context-menu__label">{{ entry.label }}</span>
        </button>
      </template>
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

    // 高亮走 --active class 而非 :hover——鍵盤導覽和滑鼠 hover 共用同一個
    // activeIdx 來源，不會出現「hover 一項 + 鍵盤高亮另一項」的雙高亮
    &--active {
      background: var(--eqt-bg-btn-hover);
    }

    &--danger {
      color: var(--eqt-danger);

      &.eqt-context-menu__item--active,
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
