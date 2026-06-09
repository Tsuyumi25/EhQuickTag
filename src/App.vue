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
import { lines, useNhWeight, nsOrder, disabledNs, fontFamily, fontWeight, profiles, activeProfileIdx, switchProfile, renameProfile, createProfile, deleteProfile, newTabActive, nsFormat, defaultExactMatch, tagDbMirror, tagDbTtlDays, showNativeSearch, type DblClickAction } from '@/services/store'
import { loadTagDb } from '@/services/tagDb'

const effectiveNsOrder = computed(() => {
  const disabled = new Set(disabledNs.value)
  return nsOrder.value.filter(ns => !disabled.has(ns))
})

// 自訂字體 var 設在 anchor 元素而非 documentElement 上——這樣只有 #eqt-bar-anchor
// 子樹（TagBar 整顆）能看到，#eqt-app（所有 popup 的 root）不會受影響。
// preview 區（appearance tab 跟 JSON editor 內）走 inline style 直接讀 ref，
// 也不依賴這個 var。
let anchorEl: HTMLElement | null = null

function applyFontVars(): void {
  if (!anchorEl) return
  if (fontFamily.value) anchorEl.style.setProperty('--eqt-font-family', fontFamily.value)
  else anchorEl.style.removeProperty('--eqt-font-family')
  if (fontWeight.value) anchorEl.style.setProperty('--eqt-font-weight', fontWeight.value)
  else anchorEl.style.removeProperty('--eqt-font-weight')
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
// EH 原生 Search / Clear 按鈕。EH 自己是 <input type="submit/button">；EH 漢化
// 腳本（EHS / EH Syringe）會把 input 換成 <button ehs-input> 但保留 type——所以
// 統一用 type 作 selector、不挑 tag name 也不靠英文 value 字串
let searchSubmitEl: HTMLElement | null = null
let searchClearEl: HTMLElement | null = null

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
  searchInput = document.querySelector<HTMLInputElement>('#f_search')
  if (!searchInput) return

  searchText.value = searchInput.value

  searchInput.addEventListener('input', () => {
    searchText.value = searchInput!.value
  })

  const anchor = document.createElement('div')
  anchor.id = 'eqt-bar-anchor'
  // 擋外部翻譯插件（如 EH 翻譯腳本）污染我們已經 i18n 過的按鈕文字。
  // main.ts 的 #eqt-app 已經有同樣 attribute、但 TagBar 走 Teleport 到
  // 這個 anchor、anchor 掛在 EH form 下面、繼承不到那條保護。各自獨立補上
  anchor.setAttribute('translate', 'no')
  const parent = searchInput.parentElement!
  parent.appendChild(anchor)
  anchorEl = anchor
  // EH 原生 Search / Clear 按鈕：用 type 鎖定（form 內 #f_search 的 sibling div
  // 只有一個 type="submit" + 一個 type="button"），跨原生 / EHS 漢化情境穩定。
  // 抓不到 → console.warn 留 debug 線索（未來 EH 改排版時打開 console 可看到）
  searchSubmitEl = parent.querySelector<HTMLElement>(':scope > [type="submit"]')
  searchClearEl = parent.querySelector<HTMLElement>(':scope > [type="button"]')
  if (!searchSubmitEl) console.warn('[eqt] EH search submit button not found — layout may have changed')
  if (!searchClearEl) console.warn('[eqt] EH search clear button not found — layout may have changed')
  applyFontVars()  // 初次 apply：watch 不 immediate，由這裡套上當前 fontFamily/Weight
  applyNativeSearchVisibility()  // 同上，套上當前 showNativeSearch
  anchorReady.value = true
})

watch(searchText, (val) => {
  if (searchInput && searchInput.value !== val) {
    searchInput.value = val
  }
})

// 原生搜尋區顯示開關：切 #f_search + 兩顆 EH 原生按鈕（Search / Clear）的
// display。submit 走 form action 不受影響——使用者就算把整個原生區藏起來、
// TagBar 雙擊送出搜尋仍然會 work。
// 初次 apply 由 onMounted 內 anchor 設好後手動呼叫（onMounted 之前三個 ref 還是 null）
function applyNativeSearchVisibility(): void {
  const display = showNativeSearch.value ? '' : 'none'
  if (searchInput) searchInput.style.display = display
  if (searchSubmitEl) searchSubmitEl.style.display = display
  if (searchClearEl) searchClearEl.style.display = display
}
watch(showNativeSearch, applyNativeSearchVisibility)
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

  <AddTagPopup
    v-if="showAddPopup"
    @pick="onPickAddTag"
    @close="showAddPopup = false"
  />
</template>
