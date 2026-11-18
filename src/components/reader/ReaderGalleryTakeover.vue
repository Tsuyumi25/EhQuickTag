<script setup lang="ts">
// 浮層裡那份原生 .gm 的標籤區，跟 /g/ 頁一樣由 GalleryTagList 接管；host 由這裡注入。
// 新增標籤的 picker、介紹面板照預設去找 .gm / #gd1 / #gd3 / #gd5，MPV 頁上只有這一份
import { provide } from 'vue'
import GalleryTagList from '@/components/gallery/GalleryTagList.vue'
import { createGalleryHost, GALLERY_HOST } from '@/composables/useEhGalleryHost'
import { GALLERY_SETTINGS_TAB } from '@/services/appOverlays'
import type { FetchedGallery } from '@/services/reader/mpvGallery'

const props = defineProps<{ gallery: FetchedGallery }>()

const host = createGalleryHost(props.gallery.gm, props.gallery.url, () => props.gallery.vote)
if (host) provide(GALLERY_HOST, host)
provide(GALLERY_SETTINGS_TAB, 'reader')
</script>

<template>
  <Teleport v-if="host" :to="host.anchor">
    <GalleryTagList />
  </Teleport>
</template>
