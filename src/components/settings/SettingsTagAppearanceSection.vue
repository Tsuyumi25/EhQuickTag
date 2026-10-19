<script setup lang="ts">
import { computed } from 'vue'
import { Palette } from '@lucide/vue'
import { t } from '@/composables/useI18n'
import TagChip from '@/components/TagChip.vue'
import { tagColors } from '@/services/mytags/mytagsColors'
import {
  taggingEnhancerEnabled, myTagsEnhancerEnabled,
  galleryMyTagsColorsEnabled, galleryMyTagsScoresEnabled, galleryMyTagsMarksEnabled,
  myTagsGalleryColorsEnabled, myTagsGalleryScoresEnabled, myTagsGalleryMarksEnabled,
  listingTagsEnabled, listingMyTagsColorsEnabled, listingMyTagsScoresEnabled, listingMyTagsMarksEnabled,
} from '@/services/store'

const props = defineProps<{ scene: 'listing' | 'gallery' | 'mytags' }>()
const scopes = {
  listing: {
    enabled: listingTagsEnabled,
    colors: listingMyTagsColorsEnabled,
    scores: listingMyTagsScoresEnabled,
    marks: listingMyTagsMarksEnabled,
  },
  gallery: {
    enabled: taggingEnhancerEnabled,
    colors: galleryMyTagsColorsEnabled,
    scores: galleryMyTagsScoresEnabled,
    marks: galleryMyTagsMarksEnabled,
  },
  mytags: {
    enabled: myTagsEnhancerEnabled,
    colors: myTagsGalleryColorsEnabled,
    scores: myTagsGalleryScoresEnabled,
    marks: myTagsGalleryMarksEnabled,
  },
}
const scope = computed(() => scopes[props.scene])
const samples = [
  { weight: 10, hidden: false, watch: true },
  { weight: -10, hidden: false, watch: false },
  { weight: 0, hidden: true, watch: false },
].map(sample => ({
  ...sample,
  colors: tagColors({ color: '', setColor: '', ...sample }),
}))
</script>

<template>
  <section class="eqt-settings__section">
    <h4 class="eqt-settings__subtitle"><Palette :size="14" /> {{ t('settings.tagAppearance') }}</h4>
    <div class="eqt-settings__appearance-toggles">
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="scope.colors.value"
          :disabled="!scope.enabled.value"
          @change="scope.colors.value = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.appearanceColors') }}</span>
      </label>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="scope.scores.value"
          :disabled="!scope.enabled.value"
          @change="scope.scores.value = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.appearanceScores') }}</span>
      </label>
      <label class="eqt-settings__row">
        <input
          type="checkbox"
          :checked="scope.marks.value"
          :disabled="!scope.enabled.value"
          @change="scope.marks.value = ($event.target as HTMLInputElement).checked"
        />
        <span class="eqt-settings__label">{{ t('settings.appearanceMarks') }}</span>
      </label>
    </div>
    <div class="eqt-settings__tag-preview" role="group" :aria-label="t('settings.preview')">
      <TagChip
        v-for="(sample, index) in samples"
        :key="index"
        :full="`preview:sample-${index}`"
        :display="t('settings.appearanceExample', { n: index + 1 })"
        :colors="scope.colors.value ? sample.colors : undefined"
        :weight="sample.weight"
        :hidden="sample.hidden"
        :watch="sample.watch"
        :show-score="scope.scores.value"
        :show-marks="scope.marks.value"
      />
    </div>
  </section>
</template>

<style lang="scss">
.eqt-settings__appearance-toggles {
  display: flex;
  flex-wrap: wrap;
  column-gap: 16px;
}

.eqt-settings__tag-preview {
  display: flex;
  flex-wrap: wrap;
  margin-top: 4px;
  // chip 自己帶 5px 的下邊距，底部不再另加
  padding: 4px 4px 0;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: var(--eqt-radius-sm);
  font-size: var(--eqt-fs-md);
}
</style>
