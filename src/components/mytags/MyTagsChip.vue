<script setup lang="ts">
import { computed } from 'vue'
import { useTagLabel } from '@/composables/useTagLabel'

const props = defineProps<{
  full: string
  weight: number
  hidden: boolean
  /** EH 算好的配色，直接套上去讓外觀跟 /mytags 上的完全一致。
   *  刻意不叫 `style`——那是 Vue 的特殊屬性，宣告成 prop 之後仍會以
   *  fallthrough attribute 的身分再套一次到根元素上 */
  tagStyle?: { color: string; borderColor: string; background: string }
  /** 目前被選為篩選條件 */
  active?: boolean
  /** 顯示命名空間前綴。組合列裡跨 ns 混排，不標會分不出來 */
  showNs?: boolean
  /** EH 的標籤層級。畫廊頁抓回來的標籤帶這個，/mytags 的清單沒有 */
  tier?: 'gt' | 'gtl' | 'gtw'
  /** 沒有權重可言的場合（畫廊頁上不在清單裡的標籤）就不要印那個數字 */
  noWeight?: boolean
}>()

defineEmits<{ pick: [] }>()

const { label } = useTagLabel()
const view = computed(() => label.value(props.full))
const text = computed(() =>
  props.showNs ? `${view.value.nsLabel}:${view.value.display}` : view.value.display)
</script>

<template>
  <span
    class="eqt-gallery-chip eqt-tagchip"
    :class="{
      [`eqt-gallery-chip--${tier ?? 'gt'}`]: true,
      'eqt-tagchip--on': active,
      'eqt-tagchip--neg': weight < 0 && !hidden,
      'eqt-tagchip--hidden': hidden,
      'eqt-tagchip--colored': !!tagStyle,
    }"
    :style="tagStyle"
    :title="full"
  >
    <button type="button" class="eqt-gallery-chip__body" @click="$emit('pick')">
      <img v-if="view.iconUrl" :src="view.iconUrl" class="eqt-tag-icon" alt="">{{ text }}
    </button>
    <span v-if="!noWeight" class="eqt-tagchip__weight">
      {{ hidden ? '⛔' : (weight > 0 ? `+${weight}` : weight) }}
    </span>
  </span>
</template>
