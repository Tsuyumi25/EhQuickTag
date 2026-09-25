<script setup lang="ts">
import TagBar from '@/components/TagBar.vue'
import GalleryTagList from '@/components/gallery/GalleryTagList.vue'
import MyTagsPanel from '@/components/mytags/MyTagsPanel.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import SearchPopup from '@/components/search/SearchPopup.vue'
import { useEhFormHost } from '@/composables/useEhFormHost'
import { useEhGalleryHost } from '@/composables/useEhGalleryHost'
import { useEhMyTagsHost } from '@/composables/useEhMyTagsHost'
import { usePageSearch } from '@/composables/usePageSearch'
import { showSettings, initialSettingsTab, showSearchPopup } from '@/services/appOverlays'
import { taggingEnhancerEnabled } from '@/services/store'

const formHost = useEhFormHost()
const galleryHost = taggingEnhancerEnabled.value ? useEhGalleryHost() : null
const myTagsHost = useEhMyTagsHost()
const { searchText, search } = usePageSearch()
</script>

<template>
  <Teleport v-if="formHost" :to="formHost.anchor">
    <TagBar />
  </Teleport>

  <Teleport v-else-if="galleryHost" :to="galleryHost.anchor">
    <GalleryTagList />
  </Teleport>

  <Teleport v-else-if="myTagsHost" :to="myTagsHost.anchor">
    <MyTagsPanel />
  </Teleport>

  <SettingsPopup
    v-if="showSettings"
    :initial-tab="initialSettingsTab"
    @close="showSettings = false"
  />

  <SearchPopup
    v-if="showSearchPopup"
    v-model="searchText"
    @search="search"
    @close="showSearchPopup = false"
  />
</template>
