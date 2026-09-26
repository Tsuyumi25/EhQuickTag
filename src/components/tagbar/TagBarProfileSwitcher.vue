<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { ChevronLeft, ChevronRight, Trash2 } from '@lucide/vue'
import { profiles, activeProfileIdx, switchProfile, renameProfile, createProfile, deleteProfile } from '@/services/store'
import { t } from '@/composables/useI18n'

defineProps<{ editing: boolean }>()
const onCreationPage = defineModel<boolean>('onCreationPage', { required: true })

const prevProfileName = computed(() => {
  const idx = activeProfileIdx.value - 1
  return idx >= 0 ? profiles[idx].name : ''
})

const nextProfileName = computed(() => {
  const idx = activeProfileIdx.value + 1
  return idx < profiles.length ? profiles[idx].name : ''
})
const renamingProfile = ref(false)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const profileName = computed(() => profiles[activeProfileIdx.value]?.name ?? '')

function onPrev() {
  if (onCreationPage.value) {
    onCreationPage.value = false
  } else {
    switchProfile(activeProfileIdx.value - 1)
  }
}

function onNext() {
  if (activeProfileIdx.value === profiles.length - 1) {
    onCreationPage.value = true
  } else {
    switchProfile(activeProfileIdx.value + 1)
  }
}

function startRenameOrCreate() {
  renameValue.value = onCreationPage.value ? '' : profileName.value
  renamingProfile.value = true
  nextTick(() => renameInput.value?.select())
}

function finishRenameOrCreate() {
  const trimmed = renameValue.value.trim()
  if (onCreationPage.value) {
    if (trimmed) {
      createProfile(trimmed)
      onCreationPage.value = false
    }
  } else if (trimmed && trimmed !== profileName.value) {
    renameProfile(activeProfileIdx.value, trimmed)
  }
  renamingProfile.value = false
}
</script>

<template>
  <div class="eqt-tag-bar__profile-row">
    <slot />
    <button
      class="eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--prev"
      type="button"
      :disabled="activeProfileIdx === 0 && !onCreationPage"
      @click="onPrev"
    >{{ onCreationPage ? profileName : prevProfileName }} <ChevronLeft :size="12" /></button>
    <input
      v-if="renamingProfile"
      ref="renameInput"
      v-model="renameValue"
      class="eqt-tag-bar__profile-input"
      @keydown.enter="finishRenameOrCreate"
      @keydown.escape="renamingProfile = false"
      @blur="finishRenameOrCreate"
    />
    <div v-else class="eqt-tag-bar__profile-split">
      <button
        class="eqt-tag-bar__profile-split-name"
        type="button"
        @click="startRenameOrCreate"
      >{{ onCreationPage ? t('tagbar.newProfile') : profileName }}</button>
      <button
        class="eqt-tag-bar__profile-split-delete"
        :class="{ 'eqt-tag-bar__profile-split-delete--hidden': !editing || onCreationPage }"
        type="button"
        :tabindex="(!editing || onCreationPage) ? -1 : undefined"
        :disabled="profiles.length <= 1"
        @click="deleteProfile(activeProfileIdx)"
      ><Trash2 :size="12" /></button>
    </div>
    <button
      class="eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--next"
      type="button"
      :disabled="onCreationPage"
      @click="onNext"
    ><ChevronRight :size="12" /> {{ onCreationPage ? '' : nextProfileName }}</button>
  </div>
</template>
