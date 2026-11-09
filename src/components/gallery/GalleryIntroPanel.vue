<script setup lang="ts">
import TagIntroPanel from '@/components/TagIntroPanel.vue'
import { useGalleryIntroPanel } from '@/composables/useIntroPanel'

const panel = useGalleryIntroPanel()
const { openTag } = panel
</script>

<template>
  <Teleport to="#gd5" :disabled="!openTag">
    <TagIntroPanel :panel="panel" />
  </Teleport>
</template>
