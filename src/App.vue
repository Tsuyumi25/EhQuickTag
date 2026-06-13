<script setup lang="ts">
import { ref, computed, watch, onMounted, provide } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import UrlConfigPopup from '@/components/UrlConfigPopup.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import AddTagPopup from '@/components/AddTagPopup.vue'
import { GM_openInTab } from '$'
import type { Button, TagButton, UrlButton } from '@/types'
import { useSessionTerms, SearchSessionKey } from '@/composables/useSessionTerms'
import { lines, useNhWeight, fontFamily, fontWeight, profiles, activeProfileIdx, switchProfile, renameProfile, createProfile, deleteProfile, newTabActive, nsFormat, defaultExactMatch, tagDbMirror, tagDbTtlDays, type DblClickAction } from '@/services/store'
import { loadTagDb } from '@/services/tagDb'
import { useEhFormHost } from '@/composables/useEhFormHost'

// === 初始 search box 同步 + session 狀態機共用 ===
//
// useEhFormHost 拉到 setup 階段（過去是 onMounted）——這樣 searchText 在
// useSessionTerms setup 之前就拿到 native input 的值，useSessionTerms 抓的
// initialSubmittedIds snapshot 才會是「mount 那刻 URL 帶的 search」而非空字串
//
// userscript 在 DOMContentLoaded 後 inject，main.ts 也 await loadStore 後才
// createApp.mount → setup 跑時 #f_search 一定存在；ehFormHost 只在某些非
// EH 頁面（不該注入的情況）會回 null
const ehFormHost = useEhFormHost()
const searchInput = ehFormHost?.input ?? null
const searchText = ref(searchInput?.value ?? '')
const anchorReady = ref(ehFormHost !== null)

const session = useSessionTerms({
  modelValue: () => searchText.value,
  emitUpdate: (v) => { searchText.value = v },
})
provide(SearchSessionKey, session)

// 自訂字體 var 設在 anchor 元素而非 documentElement 上——這樣只有 #eqt-bar-anchor
// 子樹（TagBar 整顆）能看到，#eqt-app（所有 popup 的 root）不會受影響。
// preview 區（appearance tab 跟 JSON editor 內）走 inline style 直接讀 ref，
// 也不依賴這個 var。
function applyFontVars(): void {
  const el = ehFormHost?.anchor
  if (!el) return
  if (fontFamily.value) el.style.setProperty('--eqt-font-family', fontFamily.value)
  else el.style.removeProperty('--eqt-font-family')
  if (fontWeight.value) el.style.setProperty('--eqt-font-weight', fontWeight.value)
  else el.style.removeProperty('--eqt-font-weight')
}

watch([fontFamily, fontWeight], applyFontVars)

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
const showAddPopup = ref(false)

function onAddToSearch() {
  showAddPopup.value = true
}

// AddTagPopup 不再需要 prop 傳 sessionTerms / dismiss-terms callback——
// 直接從 inject(SearchSessionKey) 拿 session（跟 SearchPanel / TagBar 同源）

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
//
// addEventListener / loadTagDb 都不依賴 Vue mount，可以 setup 階段就跑——
// 但 applyFontVars 改 anchor 上的 CSS var，anchor 已在 useEhFormHost 內建好，
// 也能 setup 階段套。保留 onMounted 只跑一次是因為 watch([fontFamily, fontWeight])
// 不 immediate，得手動觸發一次

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchText.value = searchInput.value
  })
}

loadTagDb({ mirror: tagDbMirror.value, ttlDays: tagDbTtlDays.value })

onMounted(() => {
  applyFontVars()
})

// 純轉接層：template @controls-width 沒辦法直接綁 ehFormHost?.setControlsWidth
// （Vue template 不接受 optional chain 當 handler），所以包一層 fn 收 null guard
function onControlsWidth(width: number): void {
  ehFormHost?.setControlsWidth(width)
}

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
      @add-to-search="onAddToSearch"
      @search="onSearch"
      @controls-width="onControlsWidth"
    />
  </Teleport>

  <TagConfigPopup
    v-if="tagPopupValue"
    :tag="tagPopupValue"
    :line-color="editingLineColor"
    :is-add="pendingAdd"
    :use-nh-weight="useNhWeight"
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
    @close="showSettings = false"
  />

  <AddTagPopup
    v-if="showAddPopup"
    v-model="searchText"
    @close="showAddPopup = false"
  />
</template>
