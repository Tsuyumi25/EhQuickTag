<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import UrlConfigPopup from '@/components/UrlConfigPopup.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import { GM_openInTab } from '$'
import { tagLines, useNhWeight, nsOrder, disabledNs, fontFamily, fontWeight, profiles, activeProfileIdx, switchProfile, renameProfile, createProfile, deleteProfile, newTabActive, type DblClickAction } from '@/services/store'

const effectiveNsOrder = computed(() => nsOrder.value.filter(ns => !disabledNs.value.has(ns)))

watch([fontFamily, fontWeight], () => {
  const root = document.documentElement
  if (fontFamily.value) root.style.setProperty('--eqt-font-family', fontFamily.value)
  else root.style.removeProperty('--eqt-font-family')
  if (fontWeight.value) root.style.setProperty('--eqt-font-weight', fontWeight.value)
  else root.style.removeProperty('--eqt-font-weight')
}, { immediate: true })

const prevProfileName = computed(() => {
  const idx = activeProfileIdx.value - 1
  return idx >= 0 ? profiles[idx].name : ''
})

const nextProfileName = computed(() => {
  const idx = activeProfileIdx.value + 1
  return idx < profiles.length ? profiles[idx].name : ''
})

function onPrevProfile() {
  switchProfile(activeProfileIdx.value - 1)
}

function onNextProfile() {
  switchProfile(activeProfileIdx.value + 1)
}

function onRenameProfile(name: string) {
  renameProfile(activeProfileIdx.value, name)
}

function onCreateProfile(name: string) {
  createProfile(name)
}

function onDeleteProfile() {
  deleteProfile(activeProfileIdx.value)
}

const searchText = ref('')
const anchorReady = ref(false)
let searchInput: HTMLInputElement | null = null

// --- tag config popup ---

const editingLine = ref(-1)
const editingIdx = ref(-1)
const pendingAdd = ref(false)
const showTagPopup = ref(false)
const showUrlPopup = ref(false)

function onConfigure(lineIdx: number, tagIdx: number) {
  editingLine.value = lineIdx
  editingIdx.value = tagIdx
  pendingAdd.value = false
  const qt = tagLines[lineIdx][tagIdx]
  if (qt.url) {
    showUrlPopup.value = true
  } else {
    showTagPopup.value = true
  }
}

function onAdd(type: 'tag' | 'url' = 'tag') {
  const lastIdx = tagLines.length - 1
  tagLines[lastIdx].push(type === 'url' ? { tag: '', url: '', label: '' } : { tag: '', label: '' })
  editingLine.value = lastIdx
  editingIdx.value = tagLines[lastIdx].length - 1
  pendingAdd.value = true
  if (type === 'url') showUrlPopup.value = true
  else showTagPopup.value = true
}

function onSave(updated: import('@/types').QuickTag) {
  tagLines[editingLine.value][editingIdx.value] = updated
  pendingAdd.value = false
  showTagPopup.value = false
  showUrlPopup.value = false
}

function onDelete() {
  tagLines[editingLine.value].splice(editingIdx.value, 1)
  pendingAdd.value = false
  showTagPopup.value = false
  showUrlPopup.value = false
}

function onClose() {
  if (pendingAdd.value) {
    tagLines[editingLine.value].splice(editingIdx.value, 1)
    pendingAdd.value = false
  }
  showTagPopup.value = false
  showUrlPopup.value = false
}

// --- settings popup ---

const showSettings = ref(false)

function onSearch(action: DblClickAction) {
  if (!searchInput?.form) return
  if (action === 'searchNewTab') {
    const url = new URL(searchInput.form.action || window.location.href)
    new FormData(searchInput.form).forEach((v, k) => url.searchParams.set(k, v as string))
    GM_openInTab(url.href, { active: newTabActive.value })
  } else {
    searchInput.form.submit()
  }
}

// --- search box sync ---

onMounted(() => {
  searchInput = document.querySelector<HTMLInputElement>('#f_search')
  if (!searchInput) return

  searchText.value = searchInput.value

  searchInput.addEventListener('input', () => {
    searchText.value = searchInput!.value
  })

  const anchor = document.createElement('div')
  anchor.id = 'eqt-bar-anchor'
  searchInput.parentElement!.appendChild(anchor)
  anchorReady.value = true
})

watch(searchText, (val) => {
  if (searchInput && searchInput.value !== val) {
    searchInput.value = val
  }
})
</script>

<template>
  <Teleport v-if="anchorReady" to="#eqt-bar-anchor">
    <TagBar
      :profile-name="profiles[activeProfileIdx]?.name ?? ''"
      :profile-idx="activeProfileIdx"
      :profile-count="profiles.length"
      :prev-profile-name="prevProfileName"
      :next-profile-name="nextProfileName"
      v-model:search-text="searchText"
      @configure="onConfigure"
      @add="onAdd('tag')"
      @add-url="onAdd('url')"
      @prev-profile="onPrevProfile"
      @next-profile="onNextProfile"
      @rename-profile="onRenameProfile"
      @create-profile="onCreateProfile"
      @delete-profile="onDeleteProfile"
      @settings="showSettings = true"
      @search="onSearch"
    />
  </Teleport>

  <TagConfigPopup
    v-if="showTagPopup"
    :tag="tagLines[editingLine][editingIdx]"
    :is-add="pendingAdd"
    :use-nh-weight="useNhWeight"
    :ns-order="effectiveNsOrder"
    @save="onSave"
    @delete="onDelete"
    @close="onClose"
  />

  <UrlConfigPopup
    v-if="showUrlPopup"
    :tag="tagLines[editingLine][editingIdx]"
    :is-add="pendingAdd"
    @save="onSave"
    @delete="onDelete"
    @close="onClose"
  />

  <SettingsPopup
    v-if="showSettings"
    v-model:use-nh-weight="useNhWeight"
    :ns-order="nsOrder"
    :disabled-ns="disabledNs"
    @update:ns-order="nsOrder = $event"
    @update:disabled-ns="disabledNs = $event"
    @close="showSettings = false"
  />
</template>
