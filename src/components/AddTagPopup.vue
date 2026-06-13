<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { loadTagDb, getFallbackEntries, DEFAULT_NS_ORDER, type TagEntry } from '@/services/tagDb'
import { useNhWeight } from '@/services/store'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'

const emit = defineEmits<{
  pick: [entry: TagEntry]
  close: []
}>()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)
const selectedIdx = ref(0)
const fallbackEntries = ref<TagEntry[]>([])

// 篩選按鈕：單選 + 可清除。null = 不篩選（預設，顯示全部 namespace 的 nh 熱榜）；
// 點一個 ns = 只看該 ns；點同一個 = 取消回 null
const selectedNs = ref<string | null>(null)

function toggleNs(ns: string): void {
  selectedNs.value = selectedNs.value === ns ? null : ns
}

// 跟其他 popup 同套：onClickOutside + Escape + useScrollLock 一條龍，
// 避免 AddTagPopup 開啟時滾輪穿透到背景 EH 列表
usePopupBehavior({ popupEl, onClose: () => emit('close') })

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  useNhWeight: () => useNhWeight.value,
  namespaces: () => selectedNs.value ? [selectedNs.value] : undefined,
  emptyFallback: () => fallbackEntries.value,
})

// suggestions 換新清單時拉回頂端，避免過濾完按 Enter 拿到 undefined / 高亮看不見
watch(suggestions, () => { selectedIdx.value = 0 })

// 篩選按鈕 / useNhWeight 變動：重抓 fallbackEntries（query 結果由 useTagSuggestions
// 內部 watcher 處理）。useNhWeight 必須進這個 watcher，否則設定關閉時 fallback 清單
// 仍會帶 nh 加權順序
watch([selectedNs, useNhWeight], () => {
  if (!dbReady.value) return
  fallbackEntries.value = getFallbackEntries({
    namespaces: selectedNs.value ? [selectedNs.value] : undefined,
    useNhWeight: useNhWeight.value,
  })
})

onMounted(async () => {
  await loadTagDb()
  fallbackEntries.value = getFallbackEntries({ useNhWeight: useNhWeight.value })
  inputEl.value?.focus()
})

// Escape 走 usePopupBehavior 統一處理；這裡只 handle 清單導覽 + Enter pick
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
    if (entry) emit('pick', entry)
  }
}
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup eqt-add-popup" @keydown="onKeydown">
      <aside
        class="eqt-add-popup__ns-filter"
        role="group"
        :aria-label="t('addPopup.nsFilterLabel')"
      >
        <button
          type="button"
          class="eqt-add-popup__ns-btn"
          :class="{ 'is-active': selectedNs === null }"
          @click="selectedNs = null"
        >
          {{ t('addPopup.nsFilterAll') }}
        </button>
        <button
          v-for="ns in DEFAULT_NS_ORDER"
          :key="ns"
          type="button"
          class="eqt-add-popup__ns-btn"
          :class="{ 'is-active': selectedNs === ns }"
          :title="t('ns.' + ns)"
          @click="toggleNs(ns)"
        >
          {{ t('ns.' + ns) }}
        </button>
        <button
          class="eqt-popup__btn eqt-popup__btn--primary eqt-add-popup__close-btn"
          type="button"
          @click="emit('close')"
        >
          {{ t('settings.close') }}
        </button>
      </aside>
      <div class="eqt-add-popup__main">
        <input
          ref="inputEl"
          v-model="query"
          class="eqt-popup__input eqt-add-popup__input"
          type="text"
          :placeholder="t('tagConfig.searchPlaceholder')"
          autocomplete="off"
          spellcheck="false"
        />
        <SuggestionList
          v-if="suggestions.length"
          class="eqt-add-popup__list"
          :suggestions="suggestions"
          :selected-idx="selectedIdx"
          @update:selected-idx="selectedIdx = $event"
          @pick="emit('pick', $event)"
        />
        <div v-else-if="dbReady" class="eqt-add-popup__empty">
          {{ t('tagConfig.noResult') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '../styles/buttons' as *;

// fzf 風 popup：左側 namespace 篩選 sidebar，右側 input + 清單
.eqt-add-popup {
  // 整個 popup 等比例放大——zoom 比 transform: scale 乾淨，會影響 layout 計算所以
  // overlay 置中跟 click 位置不會錯位
  zoom: 1.15;
  display: flex;
  flex-direction: row;
  width: clamp(30rem, 60vw, 52rem);
  min-height: auto;
  max-height: 70vh;
  padding: 10px;
  gap: 10px;
  overflow: hidden;
}

// 左側 sidebar：單列直排，按鈕寬度跟著最寬 namespace label 走，main 區得到更多空間
.eqt-add-popup__ns-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
  overflow-y: auto;
}

// 關閉鍵：margin-top auto 推到底，跟 namespace 按鈕中間留空
.eqt-add-popup__close-btn {
  margin-top: auto;
  flex-shrink: 0;
}

.eqt-add-popup__ns-btn {
  @include btn-toned;
  padding: 2px 6px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  // 選中態：用 bg-active + 加深 border 區分，跟整體統一的中性風格一致
  &.is-active {
    background: var(--eqt-bg-active);
    border-color: var(--eqt-text-secondary);
  }
}

// 右側主區：input + suggestion list 垂直排
.eqt-add-popup__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.eqt-add-popup__input {
  flex-shrink: 0;
}

// SuggestionList 額外給的 flex 撐滿規則——SuggestionList 自帶 background / border /
// overflow-y / text-align，這裡只補「在 flex column 裡撐滿剩餘空間」的部分
.eqt-add-popup__list {
  flex: 1;
  min-height: 0;
}

.eqt-add-popup__empty {
  padding: 12px;
  color: var(--eqt-text-hint);
  font-size: var(--eqt-fs-md);
  text-align: center;
}
</style>
