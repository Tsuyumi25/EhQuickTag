<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import { tags, useNhWeight, nsOrder, disabledNs } from '@/services/store'

const effectiveNsOrder = computed(() => nsOrder.value.filter(ns => !disabledNs.value.has(ns)))
const searchText = ref('')
const anchorReady = ref(false)
let searchInput: HTMLInputElement | null = null

// --- tag config popup ---

const editingIndex = ref(-1)
const pendingAdd = ref(false)
const showPopup = ref(false)

function onConfigure(tag: string) {
  const idx = tags.findIndex(t => t.tag === tag)
  if (idx === -1) return
  editingIndex.value = idx
  pendingAdd.value = false
  showPopup.value = true
}

function onAdd() {
  editingIndex.value = tags.length
  tags.push({ tag: '', label: '' })
  pendingAdd.value = true
  showPopup.value = true
}

function onSave(updated: import('@/types').QuickTag) {
  tags[editingIndex.value] = updated
  pendingAdd.value = false
  showPopup.value = false
}

function onDelete() {
  tags.splice(editingIndex.value, 1)
  pendingAdd.value = false
  showPopup.value = false
}

function onClose() {
  if (pendingAdd.value) {
    tags.splice(editingIndex.value, 1)
    pendingAdd.value = false
  }
  showPopup.value = false
}

function onReorder(from: number, to: number) {
  const [item] = tags.splice(from, 1)
  tags.splice(to, 0, item)
}

// --- settings popup ---

const showSettings = ref(false)

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
      :tags="tags"
      v-model:search-text="searchText"
      @configure="onConfigure"
      @add="onAdd"
      @reorder="onReorder"
      @settings="showSettings = true"
    />
  </Teleport>

  <TagConfigPopup
    v-if="showPopup"
    :tag="tags[editingIndex]"
    :use-nh-weight="useNhWeight"
    :ns-order="effectiveNsOrder"
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
