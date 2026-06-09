<script setup lang="ts">
import { ref, inject, watch, toRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useFloating, autoUpdate, flip, shift, offset, type Placement } from '@floating-ui/vue'
import { POPUP_IGNORE_KEY, type PopupIgnoreRegister } from '@/composables/usePopupBehavior'

// 共用 floating popover 殼：
//   - Teleport 到 body（避開 parent overflow / stacking context）
//   - floating-ui 對齊 anchor element，autoUpdate 跟著捲動 / 縮放
//   - 點外部關閉（anchor 本身被排除在「外部」之外）
//   - 自動向 parent popup 註冊 ignoreList（POPUP_IGNORE_KEY），避免 parent
//     的 onClickOutside 誤判「點到 teleport 出去的浮層 = 點外面」
//
// 設計取捨：trigger button 留在 caller（樣式 / icon / 狀態各家不同），
// 這個元件只管「相對誰浮起來、怎麼關」。anchor 以 prop 傳入。

const props = withDefaults(defineProps<{
  open: boolean
  anchor: HTMLElement | null
  placement?: Placement
}>(), {
  placement: 'bottom-start',
})

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const popupEl = ref<HTMLElement | null>(null)
// 把 prop 包成 ref——useFloating / onClickOutside 都要 MaybeRef，不吃 plain getter
const anchorRef = toRef(props, 'anchor')

const { floatingStyles } = useFloating(
  anchorRef,
  popupEl,
  {
    placement: () => props.placement,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  },
)

onClickOutside(popupEl, () => emit('update:open', false), {
  ignore: [anchorRef],
})

// 在 parent popup 裡使用時，自己向 parent 登記「這個 teleport 出去的浮層 el
// 屬於 popup 一部分」，避免 parent 的 onClickOutside 誤判點浮層 = 點外面。
// open 切換時 popupEl 變 null/element，watch 自動清掉舊 el。
const registerIgnore = inject<PopupIgnoreRegister | undefined>(POPUP_IGNORE_KEY, undefined)
let unregister: (() => void) | null = null
watch(popupEl, (el) => {
  if (unregister) { unregister(); unregister = null }
  if (el && registerIgnore) unregister = registerIgnore(el)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" ref="popupEl" :style="floatingStyles" class="eqt-anchored-popover">
      <slot />
    </div>
  </Teleport>
</template>

<style lang="scss">
// floating-ui 把 position / top / left 用 inline :style 寫進來，class 只負責
// z-index——讓所有 anchored popover 統一站在同一 stacking level
.eqt-anchored-popover {
  z-index: var(--eqt-z-popover);
}
</style>
