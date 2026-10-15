<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { Search } from '@lucide/vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import SuggestionList from '@/components/SuggestionList.vue'
import { RULE_CONDITIONS_GROUP, ruleDragOptions } from './ruleDrag'
import { useMyTagsColors } from '@/composables/useMyTagsColors'
import { useMyTagsPalette } from '@/composables/useMyTagsPalette'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { t } from '@/composables/useI18n'
import { ruleMaterials } from '@/services/appOverlays'
import { createTagCondition, tagConditionKey, type TagCondition } from '@/services/listing/fixedRulePrototype'
import { galleryMyTagsColorsEnabled } from '@/services/store'
import { entryForTag, getFallbackEntries, tagDbVersion, type TagEntry } from '@/services/tags/tagDb'
import { TagState } from '@/types'

const query = ref('')
const namespace = ref<string | null>(null)
const selectedIdx = ref(0)
const list = ref<InstanceType<typeof SuggestionList> | null>(null)
const namespaces = computed(() => (namespace.value ? [namespace.value] : undefined))
// 空白查詢時給熱門標籤，清單一打開就有東西可挑
const { suggestions } = useTagSuggestions({
  query: () => query.value,
  namespaces: () => namespaces.value,
  emptyFallback: () => getFallbackEntries({ namespaces: namespaces.value }),
})
const materialKeys = computed(() => new Set(ruleMaterials.value.map(tagConditionKey)))
const palette = useMyTagsPalette()
const chipStyle = useMyTagsColors()

// 只看有 My Tags 顏色的標籤：清單換成 My Tags 本身，照 My Tags 的順序，查詢字串只做包含比對
const onlyColored = ref(false)
const coloredEntries = computed(() => {
  void tagDbVersion.value
  const needle = query.value.trim().toLowerCase()
  return Object.keys(palette.value ?? {}).map(entryForTag).filter(entry =>
    (!namespace.value || entry.ns === namespace.value)
    && (!needle || entry.fullTag.includes(needle) || entry.rawLow.includes(needle) || entry.nameLow.includes(needle)))
})
const shown = computed(() => (onlyColored.value ? coloredEntries.value : suggestions.value))
watch(shown, () => { selectedIdx.value = 0 })

function stateOf(entry: TagEntry): TagState {
  if (materialKeys.value.has(tagConditionKey({ tag: entry.fullTag, exclude: false }))) return TagState.Include
  if (materialKeys.value.has(tagConditionKey({ tag: entry.fullTag, exclude: true }))) return TagState.Exclude
  return TagState.Off
}

function styleOf(entry: TagEntry) {
  const colors = galleryMyTagsColorsEnabled.value || onlyColored.value ? palette.value?.[entry.fullTag] : undefined
  return colors ? chipStyle(colors) : undefined
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIdx.value = Math.min(selectedIdx.value + 1, shown.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIdx.value = Math.max(selectedIdx.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const entry = shown.value[selectedIdx.value]
    if (entry && !materialKeys.value.has(tagConditionKey({ tag: entry.fullTag, exclude: false }))) {
      ruleMaterials.value.push(createTagCondition(entry.fullTag))
    }
  } else if (event.key === 'Escape' && query.value) {
    // 規則頁在 window 上聽 Escape 關整頁；有字的時候先只清掉查詢
    event.stopPropagation()
    query.value = ''
  }
}

// 候選清單是 SuggestionList 自己 render 的虛擬捲動，套不上 vuedraggable，直接在它的
// 項目容器上開 Sortable。條件區與素材庫是 vuedraggable 4.1：收下項目時從
// item._underlying_vm_ 取資料，所以拖曳開始時照同一個約定把條件掛上去
type DraggedItem = HTMLElement & { _underlying_vm_?: TagCondition }
let sortable: Sortable | null = null

onMounted(() => {
  const wrapper = (list.value?.$el as HTMLElement | undefined)?.firstElementChild
  if (!(wrapper instanceof HTMLElement)) return
  sortable = Sortable.create(wrapper, {
    animation: ruleDragOptions.animation,
    forceFallback: ruleDragOptions.forceFallback,
    fallbackTolerance: ruleDragOptions.fallbackTolerance,
    ghostClass: ruleDragOptions.ghostClass,
    group: { name: RULE_CONDITIONS_GROUP, pull: 'clone', put: false },
    sort: false,
    draggable: '.eqt-popup__suggestion',
    // 條件區與素材庫靠這兩個屬性判斷收不收；項目是 SuggestionList 的 DOM，放開就拿掉
    onChoose: ({ item }) => {
      item.dataset.kind = 'tag'
      item.dataset.height = '0'
    },
    onUnchoose: ({ item }) => {
      delete item.dataset.kind
      delete item.dataset.height
    },
    onStart: ({ item }) => {
      const tag = item.querySelector('.eqt-popup__suggestion-tag')?.textContent
      if (tag) (item as DraggedItem)._underlying_vm_ = createTagCondition(tag)
    },
    // 目標清單收下資料後會把 item 從自己那邊拿掉；放回 Sortable 留在原處的複本位置，
    // DOM 才會跟 SuggestionList 的 render 結果一致
    onRemove: ({ item, clone }) => clone.replaceWith(item),
    onEnd: ({ item }) => { delete (item as DraggedItem)._underlying_vm_ },
  })
})

onBeforeUnmount(() => sortable?.destroy())
</script>

<template>
  <section class="eqt-rule-page__finder" :aria-label="t('rulePagePrototype.findTag')">
    <header class="eqt-rule-page__finder-head">
      <h2><Search class="eqt-rule-page__icon" />{{ t('rulePagePrototype.findTag') }}</h2>
      <label class="eqt-rule-page__enabled">
        <input v-model="onlyColored" type="checkbox" :disabled="!palette" />
        {{ t('rulePagePrototype.onlyMyTagsColored') }}
      </label>
    </header>
    <input
      v-model="query" class="eqt-rule-page__input"
      :placeholder="t('rulePagePrototype.findTag')" :aria-label="t('rulePagePrototype.findTag')"
      autocomplete="off" spellcheck="false" @keydown="onKeydown"
    />
    <div class="eqt-rule-page__finder-body">
      <NamespaceFilter v-model="namespace" />
      <SuggestionList
        ref="list" class="eqt-rule-page__finder-list"
        :suggestions="shown" :selected-idx="selectedIdx" :state-of="stateOf" :style-of="styleOf"
        :ns-list="namespaces" @update:selected-idx="selectedIdx = $event"
      />
    </div>
  </section>
</template>
