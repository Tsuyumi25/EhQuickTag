<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import type { QuickTag } from '@/types'

const tags = reactive<QuickTag[]>([
  { tag: 'language:chinese', label: 'Chinese' },
  { tag: 'language:japanese', label: 'Japanese' },
  { tag: 'language:english', label: 'English' },
])

const searchText = ref('')
const anchorReady = ref(false)
let searchInput: HTMLInputElement | null = null

// --- popup state ---

const editingIndex = ref(-1)
const isAdding = ref(false)
const showPopup = ref(false)

function onConfigure(tag: string) {
  const idx = tags.findIndex(t => t.tag === tag)
  if (idx === -1) return
  editingIndex.value = idx
  isAdding.value = false
  showPopup.value = true
}

function onAdd() {
  editingIndex.value = tags.length
  tags.push({ tag: '', label: '' })
  isAdding.value = true
  showPopup.value = true
}

function onSave(updated: QuickTag) {
  tags[editingIndex.value] = updated
  isAdding.value = false
  showPopup.value = false
}

function onDelete() {
  tags.splice(editingIndex.value, 1)
  isAdding.value = false
  showPopup.value = false
}

function onClose() {
  if (isAdding.value) {
    tags.splice(editingIndex.value, 1)
    isAdding.value = false
  }
  showPopup.value = false
}

function onReorder(from: number, to: number) {
  const [item] = tags.splice(from, 1)
  tags.splice(to, 0, item)
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
  const inputRow = searchInput.parentElement!
  inputRow.parentElement!.insertBefore(anchor, inputRow)
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
    />
  </Teleport>

  <TagConfigPopup
    v-if="showPopup"
    :tag="tags[editingIndex]"
    @save="onSave"
    @delete="onDelete"
    @close="onClose"
  />
</template>
