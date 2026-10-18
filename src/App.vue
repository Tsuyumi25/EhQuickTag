<script setup lang="ts">
import { onMounted } from 'vue'
import TagBar from '@/components/tagbar/TagBar.vue'
import GalleryTagList from '@/components/gallery/GalleryTagList.vue'
import MyTagsPanel from '@/components/mytags/MyTagsPanel.vue'
import ListingRulesPrototype from '@/components/listing/ListingRulesPrototype.vue'
import RulePagePrototype from '@/components/rules/RulePagePrototype.vue'
import { useFixedRuleStore } from '@/composables/useFixedRuleStore'
import SettingsPopup from '@/components/settings/SettingsPopup.vue'
import SearchPopup from '@/components/search/SearchPopup.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useEhFormHost } from '@/composables/useEhFormHost'
import { useEhGalleryHost } from '@/composables/useEhGalleryHost'
import { useEhMyTagsHost } from '@/composables/useEhMyTagsHost'
import { usePageSearch } from '@/composables/usePageSearch'
import { showSettings, initialSettingsTab, showSearchPopup, showRules } from '@/services/appOverlays'
import { taggingEnhancerEnabled, myTagsEnhancerEnabled } from '@/services/store'
import { refreshMyTagsPalette } from '@/services/mytags/mytagsPalette'
import { useEqtToast } from '@/composables/useEqtToast'
import { t } from '@/composables/useI18n'
import { evrInstalled } from '@/utils/evr'

useFixedRuleStore()
const formHost = useEhFormHost()
const galleryHost = taggingEnhancerEnabled.value ? useEhGalleryHost() : null
const myTagsHost = myTagsEnhancerEnabled.value ? useEhMyTagsHost() : null
const pageSearch = usePageSearch()
const toast = useEqtToast()

onMounted(() => {
  if (location.pathname !== '/mytags' || myTagsHost) return
  void refreshMyTagsPalette().catch(() => toast.error(t('gallery.myTagsColorsFailed')))
})
</script>

<template>
  <ListingRulesPrototype v-if="evrInstalled" />
  <RulePagePrototype v-if="showRules" @close="showRules = false" />

  <Teleport v-if="formHost" :to="formHost.anchor">
    <TagBar />
  </Teleport>

  <Teleport v-if="galleryHost" :to="galleryHost.anchor">
    <GalleryTagList />
  </Teleport>

  <Teleport v-if="myTagsHost" :to="myTagsHost.anchor">
    <MyTagsPanel />
  </Teleport>

  <SettingsPopup
    v-if="showSettings"
    :initial-tab="initialSettingsTab"
    @close="showSettings = false"
  />

  <SearchPopup
    v-if="showSearchPopup"
    v-model="pageSearch.searchText.value"
    @search="pageSearch.search"
    @close="showSearchPopup = false"
  />

  <ConfirmDialog />
</template>
