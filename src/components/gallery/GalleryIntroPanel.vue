<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import TagIntroPanel from '@/components/TagIntroPanel.vue'
import { setGalleryIntroTarget, useGalleryIntroPanel } from '@/composables/useIntroPanel'
import { useGalleryLayout } from '@/composables/useGalleryLayout'

const panel = useGalleryIntroPanel()
const { openTag } = panel
const { introTarget } = useGalleryLayout()
setGalleryIntroTarget(introTarget)
onBeforeUnmount(() => setGalleryIntroTarget(null))
</script>

<template>
  <!-- defer：閱讀器面板的目標跟這個元件在同一輪渲染才長出來 -->
  <Teleport :to="introTarget" :disabled="!openTag" defer>
    <TagIntroPanel :panel="panel" />
  </Teleport>
</template>
