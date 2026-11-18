<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useEqtToast } from '@/composables/useEqtToast'
import { loadTagDb, getFallbackEntries, type TagEntry } from '@/services/tags/tagDb'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import { TagState } from '@/types'
import { STATE_OF_PICK } from '@/services/search/tagState'
import { pickOf, type Selection } from '@/services/tagPick'
import { useGalleryLayout } from '@/composables/useGalleryLayout'

const toast = useEqtToast()

// Gallery 「新增」picker 的 inline 變體：Teleport 進圖庫外框，absolute 蓋住左欄。
// 蓋哪裡由 useGalleryLayout 決定：/g/ 上是封面下半到 meta 區，閱讀器面板自己給
const props = defineProps<{
  // gallery taglist 的 selection（key = nsRaw，跟 entry.fullTag 同格式）；四種狀態照實顯示，
  // 按法跟刷選的 cohort 都靠這個認出「是哪顆鍵開的」
  selection: ReadonlyMap<string, Selection>
}>()

const emit = defineEmits<{
  // mode：按下的鍵在設定裡的動作（Enter 算 +1）。落點規則跟 taglist 上點同一顆 chip 一樣
  pick: [entry: TagEntry, mode: Selection]
  close: []
}>()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const selectedIdx = ref(0)
const fallbackEntries = shallowRef<TagEntry[]>([])

const selectedNs = ref<string | null>(null)
const popupNsList = computed(() => selectedNs.value ? [selectedNs.value] : undefined)


const layout = useGalleryLayout()
const panelRect = ref({ left: 0, top: 0, width: 0, height: 0 })

function recomputePanelRect(): void {
  const rect = layout.addRect()
  if (rect) panelRect.value = rect
}

useEventListener(window, 'resize', recomputePanelRect)

// Esc 關閉：input lose focus 時 panel-level @keydown 收不到，掛到 document
// 才能保證隨時生效（click-outside 仍然鎖死、只有 × 按鈕跟 Esc 能關）
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
})

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  namespaces: () => selectedNs.value ? [selectedNs.value] : undefined,
  emptyFallback: () => fallbackEntries.value,
})

watch(suggestions, () => { selectedIdx.value = 0 })

watch(selectedNs, () => {
  if (!dbReady.value) return
  fallbackEntries.value = getFallbackEntries({
    namespaces: selectedNs.value ? [selectedNs.value] : undefined,
  })
})

// 開啟時藏掉底下的 #gd1 / #gd3（保留 layout 空間給 panel rect 量測），關閉時還原
const BODY_OPEN_CLASS = 'eqt-gallery-add-inline-open'

onMounted(async () => {
  document.body.classList.add(BODY_OPEN_CLASS)
  recomputePanelRect()
  try {
    await loadTagDb()
    fallbackEntries.value = getFallbackEntries()
  } catch (e) {
    toast.error(t('gallery.tagDbLoadFailed'))
    console.error('loadTagDb failed', e)
  }
  inputEl.value?.focus()
})

onBeforeUnmount(() => {
  document.body.classList.remove(BODY_OPEN_CLASS)
})

function entryStateOf(entry: TagEntry): TagState {
  return STATE_OF_PICK[pickOf(props.selection.get(entry.fullTag))]
}

function onPick(entry: TagEntry, mode: Selection): void {
  emit('pick', entry, mode)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const entry = suggestions.value[selectedIdx.value]
    if (entry) onPick(entry, 'positive')
  }
}
</script>

<template>
  <Teleport :to="layout.addTarget">
    <div
      ref="panelEl"
      class="eqt-gallery-add-inline"
      :style="{
        left: panelRect.left + 'px',
        top: panelRect.top + 'px',
        width: panelRect.width + 'px',
        height: panelRect.height + 'px',
      }"
      @keydown="onKeydown"
    >
      <NamespaceFilter v-model="selectedNs" />

      <div class="eqt-gallery-add-inline__main">
        <div class="eqt-gallery-add-inline__title">
          <input
            ref="inputEl"
            v-model="query"
            class="eqt-gallery-add-inline__input"
            type="text"
            :placeholder="t('tagConfig.searchPlaceholder')"
            autocomplete="off"
            spellcheck="false"
          />
          <button
            type="button"
            class="eqt-gallery-add-inline__close-btn"
            :title="t('settings.close')"
            @click="emit('close')"
          >×</button>
        </div>

        <SuggestionList
          v-if="suggestions.length"
          class="eqt-gallery-add-inline__list"
          :suggestions="suggestions"
          :selected-idx="selectedIdx"
          :state-of="entryStateOf"
          :ns-list="popupNsList"
          @update:selected-idx="selectedIdx = $event"
          @select="onPick"
        />
        <div v-else-if="dbReady" class="eqt-gallery-add-inline__empty">
          {{ t('tagConfig.noResult') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

// 用 .gm 當 positioning context（native 沒設 position，補 relative 不影響原 layout）
.gm {
  position: relative;
}

// 開啟時藏 #gd1 / #gd3：visibility:hidden 保留 layout（不能 display:none、否則
// rect 量測會塌掉）
body.eqt-gallery-add-inline-open {
  #gd1, #gd3 { visibility: hidden; }
}

.eqt-gallery-add-inline {
  position: absolute;
  // top / left / width / height 都由 :style inline 帶（runtime 量 native rect）
  z-index: 10;
  // teleport 出 #eqt-bar-anchor 範圍、theme.scss 的 border-box reset 沒套到，
  // 自己宣告一次以免 padding 把 height 撐爆 r3.bottom
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  background: #edebdf;
  overflow: hidden;
  gap: 6px;
  text-align: left;
  font-family: verdana, sans-serif;
  font-size: 9pt;
  color: inherit;


  // 右側主區：input + suggestion list 垂直排
  &__main {
    flex: auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    flex: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 2px 0 3px;
    border-bottom: 1px solid #5c0d12;
    gap: 4px;
  }

  &__input {
    flex: auto;
    min-width: 0;
    border: 1px solid var(--eqt-border);
    background: var(--eqt-bg);
    color: var(--eqt-text);
    padding: 2px 4px;
    font-size: 9pt;
    font-family: inherit;
  }

  &__close-btn {
    flex: none;
    background: transparent;
    border: none;
    cursor: pointer;
    user-select: none;
    color: inherit;
    font-size: 16px;
    line-height: 24px;
    width: 20px;
    text-align: center;
    padding: 0;
    opacity: 0.8;

    &:hover { opacity: 1; }
  }

  &__list {
    flex: auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  &__empty {
    padding: 12px;
    color: var(--eqt-text-hint);
    font-size: var(--eqt-fs-md);
    text-align: center;
  }
}

// ExHentai dark：跟 intro panel 同套
.eqt-dark .eqt-gallery-add-inline {
  background: #4f535b;
  color: #e7e7e7;

  .eqt-gallery-add-inline__title { border-bottom: 1px solid #000; }
}
</style>
