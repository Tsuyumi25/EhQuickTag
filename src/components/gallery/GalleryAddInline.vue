<script setup lang="ts">
import { ref, shallowRef, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { loadTagDb, getFallbackEntries, DEFAULT_NS_ORDER, type TagEntry } from '@/services/tagDb'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import { TagState } from '@/types'

// Gallery 「新增」picker 的 inline 變體：Teleport 到 .gm（gallery 外層容器），
// absolute 覆蓋視覺左欄。座標 mount 時量 native rect：
//   - left：#gd1 的左邊
//   - top / right / bottom：#gd3 的上 / 右 / 下
// 涵蓋 #gd1 下半（封面圖下半部）+ #gd3（meta 區），保留 #gd2 title bar 不蓋。
// 比硬寫尺寸 robust——native responsive 改 width 也跟得上
const props = defineProps<{
  pickedIds: ReadonlySet<string>
}>()

const emit = defineEmits<{
  // mode: 左鍵 / Enter = positive (+1)、右鍵 = negative (-1)。對齊 taglist
  // 「左 +1 / 右 -1」操作模型，picker 額外限制 min=0（禁止 0 → -1）
  pick: [entry: TagEntry, mode: 'positive' | 'negative']
  close: []
}>()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const selectedIdx = ref(0)
const fallbackEntries = shallowRef<TagEntry[]>([])

const selectedNs = ref<string | null>(null)
const SEARCH_NS_LIST = DEFAULT_NS_ORDER.filter(ns => ns !== 'temp')
const popupNsList = computed(() => selectedNs.value ? [selectedNs.value] : undefined)

function toggleNs(ns: string): void {
  selectedNs.value = selectedNs.value === ns ? null : ns
}

const panelRect = ref({ left: 0, top: 0, width: 0, height: 0 })

// panel 對外圍 native 元素的 margin：左 / 上 / 下 各 6px，右側貼齊 #gd3.right
// 不留 margin（右側就是 #gd4 chips 區、視覺上不需要再隔開）
const PANEL_MARGIN = 6

function recomputePanelRect(): void {
  const gd1 = document.getElementById('gd1')
  const gd3 = document.getElementById('gd3')
  const gm = document.querySelector('.gm')
  if (!gd1 || !gd3 || !gm) return
  const r1 = gd1.getBoundingClientRect()
  const r3 = gd3.getBoundingClientRect()
  const rGm = gm.getBoundingClientRect()
  panelRect.value = {
    left: r1.left - rGm.left + PANEL_MARGIN,
    top: r3.top - rGm.top + PANEL_MARGIN,
    width: r3.right - r1.left - PANEL_MARGIN,
    height: r3.bottom - r3.top - 2 * PANEL_MARGIN,
  }
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
  await loadTagDb()
  fallbackEntries.value = getFallbackEntries()
  inputEl.value?.focus()
})

onBeforeUnmount(() => {
  document.body.classList.remove(BODY_OPEN_CLASS)
})

function entryStateOf(entry: TagEntry): TagState {
  return props.pickedIds.has(entry.fullTag) ? TagState.Include : TagState.Off
}

function onPick(entry: TagEntry, mode: 'positive' | 'negative' = 'positive'): void {
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
  <Teleport to=".gm">
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
      <aside
        class="eqt-gallery-add-inline__ns-filter"
        role="group"
        :aria-label="t('nsFilter.label')"
      >
        <button
          type="button"
          class="eqt-gallery-add-inline__ns-btn"
          :class="{ 'is-active': selectedNs === null }"
          @click="selectedNs = null"
        >
          {{ t('nsFilter.all') }}
        </button>
        <button
          v-for="ns in SEARCH_NS_LIST"
          :key="ns"
          type="button"
          class="eqt-gallery-add-inline__ns-btn"
          :class="{ 'is-active': selectedNs === ns }"
          :title="t('ns.' + ns)"
          @click="toggleNs(ns)"
        >
          {{ t('ns.' + ns) }}
        </button>
      </aside>

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
          @pick="onPick($event, 'positive')"
          @ctxmenu="onPick($event, 'negative')"
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

  // 左側 ns 篩選 sidebar、單列直排、寬度按最寬 ns label 縮
  &__ns-filter {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex-shrink: 0;
    overflow-y: auto;
  }

  &__ns-btn {
    @include btn-toned;
    padding: 1px 6px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 9pt;

    &.is-active {
      background: var(--eqt-bg-active);
      border-color: var(--eqt-text);
    }
  }

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
