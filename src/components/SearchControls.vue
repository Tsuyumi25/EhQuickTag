<script setup lang="ts">
import { inject } from 'vue'
import { searchPanelShowCJK as showCJK, enableHistory } from '@/services/store'
import { SearchSessionKey } from '@/composables/useSessionTerms'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { t } from '@/composables/useI18n'

// 共用 controls：lang toggle / clearHistory / addToSearch / clearSearch / search。
// caller 用 prop 控制顯示哪些——SearchPanel 全顯示、SearchPopup 顯示 lang toggle
// + clearSearch + search（不要 addToSearch 因為自己就是 add 模式、不要
// clearHistory 因為 popup 內沒 history 視覺呈現）。
//
// session 操作（clearSearch / clearHistory / recordSubmitAndFlush）走 inject，
// 跟 caller 持有的同個 useSessionTerms instance
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

const session = inject(SearchSessionKey)
if (!session) throw new Error('SearchControls: SearchSessionKey not provided')
const { clearSearch, clearHistory, recordSubmitAndFlush } = session

// resolvedMode 決定 lang toggle 顯示與否——auto 模式（跟 UI locale 走）就沒
// toggle 動作可做，只在 user 明確 opt-in 'toggle' mode 時才出現按鈕
const { resolvedMode } = useDisplayConfig()

function toggleLang(): void { showCJK.value = !showCJK.value }

// 送出前先把當前 A 推進 H + sync flush GM storage：
//   - navigate 走後新頁面 mount 也會在 loadHistory 補一次，但若不 await flush，
//     form.submit() 同步 navigate 跟 cacheSet async write 會競賽（finding #3）
//   - searchNewTab 路徑當前 tab 不 navigate，flush 也只是把 100ms debounce 提前
//     觸發，無副作用
async function onSearchClick(): Promise<void> {
  await recordSubmitAndFlush()
  emit('search')
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
      ><span :class="{ 'eqt-search-controls__lang-hidden': !showCJK }">中文</span><span :class="{ 'eqt-search-controls__lang-hidden': showCJK }">EN</span></button>
      <button
        v-if="showClearHistory && enableHistory"
        class="eqt-search-controls__text-btn"
        type="button"
        data-testid="clear-history"
        @click="clearHistory"
      >{{ t('tagbar.clearHistory') }}</button>
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
      >{{ t('tagbar.clearSearch') }}</button>
      <button
        v-if="showSearch"
        class="eqt-search-controls__text-btn"
        type="button"
        data-testid="search-submit"
        @click="onSearchClick"
      >{{ t('tagbar.search') }}</button>
    </div>
  </div>
</template>

<style lang="scss">
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
  display: inline-grid;
  align-items: center;
  justify-items: center;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: var(--eqt-transition-base);

  > span {
    grid-area: 1 / 1;
  }

  &:hover {
    color: var(--eqt-text);
    background: var(--eqt-bg-hover);
  }
}

.eqt-search-controls__lang-hidden {
  visibility: hidden;
}

// 「瀏覽標籤」按鈕：兩側 control group 之間撐滿剩餘寬度——SearchPanel 場景下
// 這是打開 SearchPopup 的主要入口，視覺上做大方便瞄準。
// 「+」icon 用 22px 當視覺主角；label 12px 跟旁邊 text-btn 字級對齊
.eqt-search-controls__add {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  transition: var(--eqt-transition-base);

  &:hover {
    color: var(--eqt-text);
    background: var(--eqt-bg-hover);
  }
}

.eqt-search-controls__add-icon {
  font-size: 22px;
}

.eqt-search-controls__add-label {
  font-size: 12px;
}

// 文字按鈕：跟 __add / __lang-toggle 同高，寬度跟著文字 + 水平 padding
.eqt-search-controls__text-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  transition: var(--eqt-transition-base);

  &:hover {
    color: var(--eqt-text);
    background: var(--eqt-bg-hover);
  }
}
</style>
