<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import TagBar from '@/components/TagBar.vue'
import TagConfigPopup from '@/components/TagConfigPopup.vue'
import UrlConfigPopup from '@/components/UrlConfigPopup.vue'
import SettingsPopup from '@/components/SettingsPopup.vue'
import AddTagPopup from '@/components/AddTagPopup.vue'
import { nsToShort } from '@/composables/useSearchTerm'
import { setTagState } from '@/services/tagState'
import { TagState } from '@/types'
import type { TagEntry } from '@/services/tagDb'
import { GM_openInTab } from '$'
import type { Button, TagButton, UrlButton } from '@/types'
import { lines, useNhWeight, fontFamily, fontWeight, profiles, activeProfileIdx, switchProfile, renameProfile, createProfile, deleteProfile, newTabActive, nsFormat, defaultExactMatch, tagDbMirror, tagDbTtlDays, type DblClickAction } from '@/services/store'
import { loadTagDb } from '@/services/tagDb'
import { useEhFormHost, type EhFormHost } from '@/composables/useEhFormHost'

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

const searchText = ref('')
const anchorReady = ref(false)
let searchInput: HTMLInputElement | null = null
let ehFormHost: EhFormHost | null = null

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

function onPickAddTag(entry: TagEntry) {
  // 跟 SearchTermEditor.applySuggestionPick 同套規則：尊重 nsFormat 跟 defaultExactMatch
  const ns = nsFormat.value === 'short' ? (nsToShort(entry.ns) ?? entry.ns) : entry.ns
  const suffix = defaultExactMatch.value ? '$' : ''
  const tagPart = entry.raw.includes(' ') ? `"${entry.raw}${suffix}"` : `${entry.raw}${suffix}`
  const token = `${ns}:${tagPart}`
  // 走 setTagState 是身份戳語意：search 已有同身份 token（不論前綴/後綴）就 in-place
  // 覆蓋成新 view，沒有就補尾巴。直接字串 concat 會產生同身份重複 → 破壞
  // identityIndex 的唯一性 invariant，buttons 跟 chips 會跟著當掉。
  searchText.value = setTagState(searchText.value, [token], TagState.Include)
  showAddPopup.value = false
}

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
  ehFormHost = useEhFormHost()
  if (!ehFormHost) return

  searchInput = ehFormHost.input
  searchText.value = searchInput.value
  searchInput.addEventListener('input', () => {
    searchText.value = searchInput!.value
  })

  applyFontVars()  // 初次 apply：watch 不 immediate，由這裡套上當前 fontFamily/Weight
  anchorReady.value = true
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
    @pick="onPickAddTag"
    @close="showAddPopup = false"
  />
</template>
