<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import UrlConfigPopup from '@/components/UrlConfigPopup.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import { GM_openInTab } from '$'
import type { Button, TagButton, UrlButton } from '@/types'
import { lines, useNhWeight, nsOrder, disabledNs, fontFamily, fontWeight, profiles, activeProfileIdx, switchProfile, renameProfile, createProfile, deleteProfile, newTabActive, nsFormat, defaultExactMatch, tagDbMirror, tagDbTtlDays, type DblClickAction } from '@/services/store'
import { loadTagDb } from '@/services/tagDb'

const effectiveNsOrder = computed(() => {
  const disabled = new Set(disabledNs.value)
  return nsOrder.value.filter(ns => !disabled.has(ns))
})

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

// --- tag / url config popup ---

const editingLine = ref(-1)
const editingIdx = ref(-1)
const pendingAdd = ref(false)
const showTagPopup = ref(false)
const showUrlPopup = ref(false)

// 兩個 draft ref 各自對應 popup——避免同一 ref 帶 union type 在 v-bind 上需要 cast
const draftTagButton = ref<TagButton>({ kind: 'tag', tags: [] })
const draftUrlButton = ref<UrlButton>({ kind: 'url', url: '' })

function onConfigure(lineIdx: number, tagIdx: number) {
  editingLine.value = lineIdx
  editingIdx.value = tagIdx
  pendingAdd.value = false
  const line = lines[lineIdx]
  if (line.kind !== 'buttons') return
  const b = line.buttons[tagIdx]
  if (b.kind === 'url') showUrlPopup.value = true
  else showTagPopup.value = true
}

function onAdd(type: 'tag' | 'url' = 'tag') {
  if (type === 'url') draftUrlButton.value = { kind: 'url', url: '', label: '' }
  else draftTagButton.value = { kind: 'tag', tags: [], label: '' }
  // 末行不是 ButtonLine 時 push 一個新空行——SeparatorLine 不能容納 button，
  // 也避免在末行是 separator 時新 button 被塞到看不見的位置
  const last = lines[lines.length - 1]
  if (!last || last.kind !== 'buttons') {
    lines.push({ kind: 'buttons', buttons: [] })
  }
  editingLine.value = lines.length - 1
  pendingAdd.value = true
  if (type === 'url') showUrlPopup.value = true
  else showTagPopup.value = true
}

function onSave(updated: Button) {
  const line = lines[editingLine.value]
  if (line.kind !== 'buttons') return
  if (pendingAdd.value) line.buttons.push(updated)
  else line.buttons[editingIdx.value] = updated
  pendingAdd.value = false
  showTagPopup.value = false
  showUrlPopup.value = false
}

function onDelete() {
  const line = lines[editingLine.value]
  if (line.kind === 'buttons') line.buttons.splice(editingIdx.value, 1)
  pendingAdd.value = false
  showTagPopup.value = false
  showUrlPopup.value = false
}

function onClose() {
  pendingAdd.value = false
  showTagPopup.value = false
  showUrlPopup.value = false
}

// 給 popup binding 用的 computed——既處理 add 模式的 draft，也處理 edit 模式
// narrow 到正確 button kind。computed return null 時 popup 不渲染。
const tagPopupValue = computed<TagButton | null>(() => {
  if (!showTagPopup.value) return null
  if (pendingAdd.value) return draftTagButton.value
  const line = lines[editingLine.value]
  if (!line || line.kind !== 'buttons') return null
  const b = line.buttons[editingIdx.value]
  return b && b.kind === 'tag' ? b : null
})

const urlPopupValue = computed<UrlButton | null>(() => {
  if (!showUrlPopup.value) return null
  if (pendingAdd.value) return draftUrlButton.value
  const line = lines[editingLine.value]
  if (!line || line.kind !== 'buttons') return null
  const b = line.buttons[editingIdx.value]
  return b && b.kind === 'url' ? b : null
})

const editingLineColor = computed(() => {
  const line = lines[editingLine.value]
  return line?.kind === 'buttons' ? line.color : undefined
})

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
  loadTagDb({ mirror: tagDbMirror.value, ttlDays: tagDbTtlDays.value })
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
    v-if="tagPopupValue"
    :tag="tagPopupValue"
    :line-color="editingLineColor"
    :is-add="pendingAdd"
    :use-nh-weight="useNhWeight"
    :ns-order="effectiveNsOrder"
    :ns-format="nsFormat"
    :default-exact-match="defaultExactMatch"
    @save="onSave"
    @delete="onDelete"
    @close="onClose"
  />

  <UrlConfigPopup
    v-if="urlPopupValue"
    :tag="urlPopupValue"
    :line-color="editingLineColor"
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
