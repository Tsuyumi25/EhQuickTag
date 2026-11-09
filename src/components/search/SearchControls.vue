<script setup lang="ts">
import { ref, watch } from 'vue'
import { BrushCleaning, Search, X } from '@lucide/vue'
import { searchPanelShowZh as showZh, enableHistory } from '@/services/store'
import { clearSearch, clearHistory, recordSubmitAndFlush } from '@/services/search/searchSession'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { usePageSearch } from '@/composables/usePageSearch'
import { t } from '@/composables/useI18n'

// 共用 controls：lang toggle / clearHistory / addToSearch / clearSearch / search。
// caller 用 prop 控制顯示哪些——SearchPanel 全顯示、SearchPopup 顯示 lang toggle
// + clearSearch + search（不要 addToSearch 因為自己就是 add 模式、不要
// clearHistory 因為 popup 內沒 history 視覺呈現）。
defineProps<{
  showLangToggle?: boolean
  showClearHistory?: boolean
  showAddToSearch?: boolean
  showClearSearch?: boolean
  showSearch?: boolean
}>()

const emit = defineEmits<{
  addToSearch: []
  search: []
}>()

// resolvedMode 決定 lang toggle 顯示與否——auto 模式（跟 UI locale 走）就沒
// toggle 動作可做，只在 user 明確 opt-in 'toggle' mode 時才出現按鈕
const { resolvedMode } = useDisplayConfig()

function toggleLang(): void { showZh.value = !showZh.value }

// 搜尋做成連結：中鍵、Ctrl 點、右鍵選單都能開新分頁。href 讀的是原生表單，分類與進階選項
// 不是 reactive，游標移上去、focus、按下時各重讀一次，送出去的永遠是當下的表單
const pageSearch = usePageSearch()
const searchHref = ref('')
function refreshHref(): void { searchHref.value = pageSearch.href() }
watch(pageSearch.searchText, refreshHref, { immediate: true })

function opensElsewhere(e: MouseEvent): boolean {
  return e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey
}

// 在原頁送出時先把當前 A 推進 H + sync flush GM storage：form.submit() 同步 navigate，
// 不 await 的話 cacheSet async write 會跟 navigate 競賽（finding #3）。
// 開到別的分頁時原頁還在，flush 只是把 100ms debounce 提前，交給瀏覽器照連結開
async function onSearchClick(e: MouseEvent): Promise<void> {
  if (!pageSearch.inPlace || opensElsewhere(e)) {
    void recordSubmitAndFlush()
    return
  }
  e.preventDefault()
  await recordSubmitAndFlush()
  emit('search')
}

function onSearchAuxClick(e: MouseEvent): void {
  if (e.button === 1) void recordSubmitAndFlush()
}
</script>

<template>
  <div class="eqt-search-controls">
    <div class="eqt-search-controls__group">
      <button
        v-if="showLangToggle && resolvedMode === 'toggle'"
        class="eqt-search-controls__lang-toggle"
        type="button"
        :title="t('tagbar.toggleLang')"
        @click="toggleLang"
      ><span :class="{ 'eqt-search-controls__lang-hidden': !showZh }">中文</span><span :class="{ 'eqt-search-controls__lang-hidden': showZh }">EN</span></button>
      <button
        v-if="showClearHistory && enableHistory"
        class="eqt-search-controls__text-btn"
        type="button"
        data-testid="clear-history"
        @click="clearHistory"
      ><BrushCleaning aria-hidden="true" /><span>{{ t('tagbar.clearHistory') }}</span></button>
    </div>
    <button
      v-if="showAddToSearch"
      class="eqt-search-controls__add"
      type="button"
      :title="t('tagbar.browseTag')"
      @click="$emit('addToSearch')"
    ><span class="eqt-search-controls__add-icon">+</span><span class="eqt-search-controls__add-label">{{ t('tagbar.browseTag') }}</span></button>
    <div class="eqt-search-controls__group">
      <button
        v-if="showClearSearch"
        class="eqt-search-controls__text-btn"
        type="button"
        data-testid="clear-search"
        @click="clearSearch"
      ><X aria-hidden="true" /><span>{{ t('tagbar.clearSearch') }}</span></button>
      <a
        v-if="showSearch"
        class="eqt-search-controls__text-btn"
        data-testid="search-submit"
        :href="searchHref"
        :target="pageSearch.inPlace ? undefined : '_blank'"
        rel="noopener"
        @mouseenter="refreshHref"
        @focus="refreshHref"
        @mousedown="refreshHref"
        @click="onSearchClick"
        @auxclick="onSearchAuxClick"
      ><Search aria-hidden="true" /><span>{{ t('tagbar.search') }}</span></a>
    </div>
  </div>
</template>

<style lang="scss">
@use '../../styles/buttons' as *;

// 工具列：左群組 / 中間 addToSearch 撐滿剩餘寬度 / 右群組。
// addToSearch 不顯示時自然剩兩 group，space-between 把它們推到兩端
.eqt-search-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eqt-search-controls__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.eqt-search-controls__lang-toggle {
  @include btn-toned;
  display: inline-grid;
  justify-items: center;
  height: 36px;
  padding: 0 10px;
  line-height: 1;

  > span {
    grid-area: 1 / 1;
  }
}

.eqt-search-controls__lang-hidden {
  visibility: hidden;
}

// 「瀏覽標籤」按鈕：兩側 control group 之間撐滿剩餘寬度——SearchPanel 場景下
// 這是打開 SearchPopup 的主要入口，視覺上做大方便瞄準。
// 「+」icon 用 22px 當視覺主角；label 12px 跟旁邊 text-btn 字級對齊
.eqt-search-controls__add {
  @include btn-toned;
  flex: 1;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  line-height: 1;
  white-space: nowrap;
}

.eqt-search-controls__add-icon {
  font-size: 22px;
}

.eqt-search-controls__add-label {
  font-size: 12px;
}

// 文字按鈕：跟 __add / __lang-toggle 同高，寬度跟著圖示 + 文字 + 水平 padding
.eqt-search-controls__text-btn {
  @include btn-toned;
  height: 36px;
  padding: 0 10px;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;

  > svg {
    width: var(--eqt-fs-md);
    height: var(--eqt-fs-md);
    flex-shrink: 0;
  }
}
</style>
