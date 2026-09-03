<script setup lang="ts">
import { ref, computed, inject, provide, watch, nextTick } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset, type Placement, type ReferenceElement } from '@floating-ui/vue'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'

const props = defineProps<{
  open: boolean
  anchorEl: HTMLElement | null
  // 右鍵開啟時選單要落在游標上，而不是按鈕邊緣。記游標相對錨點左上角的
  // 偏移即可：錨點會隨頁面捲動，偏移不會，兩者相加永遠是當下的正確位置。
  pointerOffset?: { x: number, y: number } | null
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

// 錨點一律綁到實際存在的元素，不抄下它當時的座標：抄下來的數字不會隨頁面
// 捲動更新，autoUpdate 每次重算都拿同一個過期答案再疊上新的捲動位移，選單
// 就會逐格漂離目標、看起來像釘在畫面上。
// 游標點也走同一條路——contextElement 讓 floating-ui 知道這個矩形衍生自誰，
// 裁切偵測與位置更新才找得到正確的祖先。
const anchor = computed<ReferenceElement | null>(() => {
  const el = props.anchorEl
  if (!el) return null

  const offsets = props.pointerOffset
  if (!offsets) return el

  return {
    getBoundingClientRect: () => {
      const rect = el.getBoundingClientRect()
      const x = rect.left + offsets.x
      const y = rect.top + offsets.y
      return { x, y, width: 0, height: 0, top: y, left: x, right: x, bottom: y }
    },
    contextElement: el,
  }
})

// flip / shift 是開啟那一刻的碰撞閃避，不該在捲動時繼續作用：錨點捲向視窗
// 邊緣時 shift 會把選單一路往回推，選單於是卡在邊緣、看起來黏住畫面。
// 捲動觸發重算的有兩條路，兩條都要關——ancestorScroll 聽捲動事件，
// layoutShift 用 IntersectionObserver 監看錨點移動，只關前者仍會重算。
// 選單自身尺寸變化（drill-down 換頁）不受影響，那時重新閃避才是對的。
const { floatingStyles } = useFloating(anchor, menuEl, {
  placement: () => props.placement ?? 'bottom-start',
  middleware: [offset(2), flip(), shift({ padding: 8 })],
  whileElementsMounted: (reference, floating, update) =>
    autoUpdate(reference, floating, update, { ancestorScroll: false, layoutShift: false }),
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

// 開啟（或錨點換人 = 在別處重開）時，dialog 模式把焦點主動送進 popup，
// 讓鍵盤使用者不必從觸發器一路 Tab 到 Teleport 尾端。
watch(() => [props.open, props.anchorEl] as const, async ([open]) => {
  if (!open || !props.autoFocus) return
  await nextTick()
  menuEl.value?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true })
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
    <!-- teleport 到 body 後脫離 #eqt-app 的 translate=no 保護圈，要自己補，
         否則選單文字會被外部翻譯插件改寫 -->
    <div
      v-if="open"
      ref="menuEl"
      :style="floatingStyles"
      class="eqt-context-menu"
      translate="no"
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
