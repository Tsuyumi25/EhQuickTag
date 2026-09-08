<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { EhMyTagsHost } from '@/composables/useEhMyTagsHost'

const props = defineProps<{ host: EhMyTagsHost }>()
const target = ref<HTMLElement | null>(null)

// #nb / #lb 帶著 EH 自己的 handler 與現場狀態；這個 adapter 只負責借位置給原節點。
onMounted(() => {
  if (target.value) props.host.mountEhTopbar(target.value)
})
onBeforeUnmount(() => props.host.restoreEhTopbar())
</script>

<template>
  <div id="eqt-eh-topbar" ref="target" class="eqt-panel__eh-topbar" />
</template>
