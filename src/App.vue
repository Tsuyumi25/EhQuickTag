<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import { tagLines, useNhWeight, nsOrder, disabledNs } from '@/services/store'

const effectiveNsOrder = computed(() => nsOrder.value.filter(ns => !disabledNs.value.has(ns)))
const searchText = ref('')
const anchorReady = ref(false)
let searchInput: HTMLInputElement | null = null

// --- tag config popup ---

const editingLine = ref(-1)
const editingIdx = ref(-1)
const pendingAdd = ref(false)
const showPopup = ref(false)

function onConfigure(lineIdx: number, tagIdx: number) {
  editingLine.value = lineIdx
  editingIdx.value = tagIdx
  pendingAdd.value = false
  showPopup.value = true
}

function onAdd() {
  const lastIdx = tagLines.length - 1
  tagLines[lastIdx].push({ tag: '', label: '' })
  editingLine.value = lastIdx
  editingIdx.value = tagLines[lastIdx].length - 1
  pendingAdd.value = true
  showPopup.value = true
}

function onSave(updated: import('@/types').QuickTag) {
  tagLines[editingLine.value][editingIdx.value] = updated
  pendingAdd.value = false
  showPopup.value = false
}

function onDelete() {
  tagLines[editingLine.value].splice(editingIdx.value, 1)
  pendingAdd.value = false
  showPopup.value = false
}

function onClose() {
  if (pendingAdd.value) {
    tagLines[editingLine.value].splice(editingIdx.value, 1)
    pendingAdd.value = false
  }
  showPopup.value = false
}

function onMove(fromLine: number, fromIdx: number, toLine: number, toIdx: number) {
  const [item] = tagLines[fromLine].splice(fromIdx, 1)
  tagLines[toLine].splice(toIdx, 0, item)
}

function onMoveLine(from: number, to: number) {
  const [line] = tagLines.splice(from, 1)
  tagLines.splice(to, 0, line)
}

function onDeleteLine(lineIdx: number) {
  tagLines.splice(lineIdx, 1)
}

function onAddLine() {
  tagLines.push([])
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
      :tag-lines="tagLines"
      v-model:search-text="searchText"
      @configure="onConfigure"
      @add="onAdd"
      @move="onMove"
      @move-line="onMoveLine"
      @delete-line="onDeleteLine"
      @add-line="onAddLine"
      @settings="showSettings = true"
    />
  </Teleport>

  <TagConfigPopup
    v-if="showPopup"
    :tag="tagLines[editingLine][editingIdx]"
    :is-add="pendingAdd"
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
