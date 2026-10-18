<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import Sortable from 'sortablejs'
import { BrushCleaning, Shapes, X } from '@lucide/vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import SuggestionList from '@/components/SuggestionList.vue'
import { categoryChipStyle } from './categoryChip'
import { RANGE_FIELD_ICONS } from './rangeFieldIcons'
import { RULE_CONDITIONS_GROUP, ruleDragOptions } from './ruleDrag'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { useMyTagsColors } from '@/composables/useMyTagsColors'
import { useMyTagsPalette } from '@/composables/useMyTagsPalette'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { isZhLocale, t } from '@/composables/useI18n'
import { ruleMaterials } from '@/services/appOverlays'
import { CATEGORY_LABELS, GALLERY_CATEGORIES, type GalleryCategory } from '@/services/listing/galleryCategory'
import {
  createCategoryCondition, createGroup, createRangeCondition, createTagCondition, GROUP_MODE_OPERATORS, materialKey,
  type FixedConditionItem, type GroupMode, type MaterialCondition, type RangeField,
} from '@/services/listing/fixedRulePrototype'
import { sortByNamespace } from '@/services/listing/tagGroups'
import { listingMyTagsColorsEnabled } from '@/services/store'
import { DEFAULT_NS_ORDER, entryForTag, getFallbackEntries, tagDbVersion, type TagEntry } from '@/services/tags/tagDb'

// 素材與找標籤是同一份清單：左欄「全部」依序列出產生器、帶回來的素材與標籤，「素材」只列前兩種，
// 其他 namespace 只列標籤。產生器與標籤拖出去是新的一份，素材拖出去就用掉
type Generator =
  | { id: RangeField; kind: 'range' }
  | { id: GroupMode; kind: 'group' }
  | { id: GalleryCategory; kind: 'category' }
const GENERATORS: Generator[] = [
  { id: 'all', kind: 'group' }, { id: 'any', kind: 'group' },
  { id: 'rating', kind: 'range' }, { id: 'pages', kind: 'range' },
  ...GALLERY_CATEGORIES.map(id => ({ id, kind: 'category' }) as const),
]
const RANGE_ICONS: Record<RangeField, Component> = RANGE_FIELD_ICONS

const query = ref('')
const namespace = ref<string | null>(null)
const materialsOnly = ref(false)
const selectedIdx = ref(-1)
const panel = ref<HTMLElement | null>(null)
const list = ref<InstanceType<typeof SuggestionList> | null>(null)
const leading = ref<HTMLElement | null>(null)
const namespaces = computed(() => (namespace.value ? [namespace.value] : undefined))
// 空白查詢時給熱門標籤，清單一打開就有東西可挑
const { suggestions } = useTagSuggestions({
  query: () => query.value,
  namespaces: () => namespaces.value,
  emptyFallback: () => getFallbackEntries({ namespaces: namespaces.value }),
})
const palette = useMyTagsPalette()
const chipStyle = useMyTagsColors()
const { zhDisplay } = useDisplayConfig()
const showMaterials = computed(() => materialsOnly.value || namespace.value === null)

// 只看有 My Tags 顏色的標籤：清單換成 My Tags 本身，照 My Tags 的順序，查詢字串只做包含比對
const onlyColored = ref(false)
const coloredEntries = computed(() => {
  void tagDbVersion.value
  const needle = query.value.trim().toLowerCase()
  return Object.keys(palette.value ?? {}).map(entryForTag).filter(entry =>
    (!namespace.value || entry.ns === namespace.value)
    && (!needle || entry.fullTag.includes(needle) || entry.rawLow.includes(needle) || entry.nameLow.includes(needle)))
})
const shown = computed(() => {
  if (materialsOnly.value) return []
  return onlyColored.value ? coloredEntries.value : suggestions.value
})

function styleOf(entry: TagEntry) {
  const colors = listingMyTagsColorsEnabled.value || onlyColored.value ? palette.value?.[entry.fullTag] : undefined
  return colors ? chipStyle(colors) : undefined
}

// 素材從不同圖庫、不同時候帶回來，照帶回來的順序會東一個西一個；照 namespace 排，上傳者在標籤後面
const MATERIAL_NS_ORDER: readonly string[] = [...DEFAULT_NS_ORDER, 'uploader']

const materialRows = computed(() => {
  void tagDbVersion.value
  const rows = ruleMaterials.value.map((material) => {
    if (material.kind === 'uploader') {
      const full = `uploader:${material.uploader}`
      return { material, ns: 'uploader', namespace: t('rulePagePrototype.uploader'), name: material.uploader, full, style: undefined }
    }
    const entry = entryForTag(material.tag)
    return {
      material, ns: entry.ns, namespace: t('ns.' + entry.ns), name: isZhLocale() ? zhDisplay(entry.name) : entry.raw,
      full: material.tag, style: styleOf(entry),
    }
  })
  return sortByNamespace(rows, row => row.ns, MATERIAL_NS_ORDER)
})

function generatorLabel(generator: Generator): string {
  if (generator.kind === 'group') return GROUP_MODE_OPERATORS[generator.id]
  if (generator.kind === 'category') return CATEGORY_LABELS[generator.id]
  return t(`rulePagePrototype.${generator.id}`)
}

// 只列素材時打字，是要找標籤：換回「全部」，結果才看得到
function onInput() {
  materialsOnly.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && query.value) {
    // 規則頁在 window 上聽 Escape 關整頁；有字的時候先只清掉查詢
    event.stopPropagation()
    query.value = ''
  }
}

// 清單的列都是一般 DOM，不是 vuedraggable 的項目。條件區是 vuedraggable 4.1：收下項目時從
// item._underlying_vm_ 取資料，所以拖曳開始時照同一個約定把要放進去的東西掛上去
type DraggedItem = HTMLElement & { _underlying_vm_?: FixedConditionItem }

function conditionOf(row: HTMLElement): FixedConditionItem | undefined {
  const { source, id } = row.dataset
  if (source === 'group') return createGroup(id as GroupMode)
  if (source === 'range') return createRangeCondition(id as RangeField)
  if (source === 'category') return createCategoryCondition(id as GalleryCategory)
  if (source === 'material') return ruleMaterials.value.find(material => String(material.id) === id)
  const tag = row.querySelector('.eqt-popup__suggestion-tag')?.textContent
  return tag ? createTagCondition(tag) : undefined
}

function rowSortable(el: HTMLElement): Sortable {
  return Sortable.create(el, {
    animation: ruleDragOptions.animation,
    forceFallback: ruleDragOptions.forceFallback,
    fallbackTolerance: ruleDragOptions.fallbackTolerance,
    ghostClass: ruleDragOptions.ghostClass,
    filter: '.eqt-rule-page__material-remove',
    preventOnFilter: false,
    group: { name: RULE_CONDITIONS_GROUP, pull: 'clone', put: false },
    sort: false,
    draggable: '.eqt-popup__suggestion',
    // 條件區與群組深度的檢查靠這兩個屬性判斷收不收；列是清單自己 render 的 DOM，放開就拿掉
    onChoose: ({ item }) => {
      const { source, id } = item.dataset
      const material = source === 'material' ? ruleMaterials.value.find(entry => String(entry.id) === id) : undefined
      item.dataset.kind = source === 'group' || source === 'range' || source === 'category' ? source : material?.kind ?? 'tag'
      item.dataset.height = source === 'group' ? '1' : '0'
    },
    onUnchoose: ({ item }) => {
      delete item.dataset.kind
      delete item.dataset.height
    },
    onStart: ({ item }) => { (item as DraggedItem)._underlying_vm_ = conditionOf(item) },
    // 目標收下資料後會把列從自己那邊拿掉；放回 Sortable 留在原處的複本位置，DOM 才會跟清單的 render 結果一致。
    // 素材被拖走就用掉
    onRemove: ({ item, clone }) => {
      clone.replaceWith(item)
      const condition = (item as DraggedItem)._underlying_vm_
      if (item.dataset.source !== 'material' || !condition) return
      const index = ruleMaterials.value.indexOf(condition as MaterialCondition)
      if (index >= 0) ruleMaterials.value.splice(index, 1)
    },
    onEnd: ({ item }) => { delete (item as DraggedItem)._underlying_vm_ },
  })
}

let listSortable: Sortable | null = null
let leadingSortable: Sortable | null = null
let panelSortable: Sortable | null = null

// 產生器與素材的列只在「全部」與「素材」底下 render，換回來時重新接上
watch(leading, el => {
  leadingSortable?.destroy()
  leadingSortable = el ? rowSortable(el) : null
})

onMounted(() => {
  const rows = (list.value?.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.eqt-suggestion-list__rows')
  if (rows) listSortable = rowSortable(rows)

  // 從條件區拖回來的標籤，放在這塊面板的哪裡都算放回素材。清單的列不收東西，事件一路冒到這裡；
  // 這裡沒有項目，Sortable 會把拖曳中的元素暫時接到面板最後面，放開時再拿掉、換成素材
  if (!panel.value) return
  panelSortable = Sortable.create(panel.value, {
    forceFallback: ruleDragOptions.forceFallback,
    draggable: '.eqt-rule-page__panel-slot',
    group: {
      name: RULE_CONDITIONS_GROUP,
      pull: false,
      put: (_to, from, dragged) => (dragged.dataset.kind === 'tag' || dragged.dataset.kind === 'uploader') && !panel.value?.contains(from.el),
    },
    onAdd: ({ item }) => {
      const condition = (item as DraggedItem)._underlying_vm_
      item.remove()
      if (condition?.kind !== 'tag' && condition?.kind !== 'uploader') return
      const key = materialKey(condition)
      if (!ruleMaterials.value.some(material => materialKey(material) === key)) ruleMaterials.value.push(condition)
    },
  })
})

onBeforeUnmount(() => {
  listSortable?.destroy()
  leadingSortable?.destroy()
  panelSortable?.destroy()
})
</script>

<template>
  <section ref="panel" class="eqt-rule-page__finder" :aria-label="t('rulePagePrototype.materials')">
    <header class="eqt-rule-page__finder-head">
      <h2><Shapes class="eqt-rule-page__icon" />{{ t('rulePagePrototype.materials') }}</h2>
      <label class="eqt-rule-page__enabled">
        <input v-model="onlyColored" type="checkbox" :disabled="!palette" />
        {{ t('rulePagePrototype.onlyMyTagsColored') }}
      </label>
      <button
        type="button" class="eqt-rule-page__tool eqt-rule-page__tool--icon" :disabled="!ruleMaterials.length"
        :title="t('rulePagePrototype.clearMaterials')" :aria-label="t('rulePagePrototype.clearMaterials')"
        @click="ruleMaterials.splice(0)"
      ><BrushCleaning class="eqt-rule-page__icon" /></button>
    </header>
    <input
      v-model="query" class="eqt-rule-page__input"
      :placeholder="t('rulePagePrototype.findTag')" :aria-label="t('rulePagePrototype.findTag')"
      autocomplete="off" spellcheck="false" @input="onInput" @keydown="onKeydown"
    />
    <div class="eqt-rule-page__finder-body">
      <NamespaceFilter
        v-model="namespace" v-model:picked="materialsOnly"
        :picked-label="t('rulePagePrototype.materials')"
      />
      <SuggestionList
        ref="list" class="eqt-rule-page__finder-list"
        :suggestions="shown" :selected-idx="selectedIdx" :style-of="styleOf"
        :ns-list="namespaces" @update:selected-idx="selectedIdx = $event"
      >
        <template v-if="showMaterials" #leading>
          <div ref="leading">
            <div
              v-for="generator in GENERATORS" :key="generator.id"
              class="eqt-popup__suggestion eqt-rule-page__generator" :data-source="generator.kind" :data-id="generator.id"
            >
              <span class="eqt-popup__suggestion-ns">{{ t(`rulePagePrototype.generator.${generator.kind}`) }}：</span>
              <span class="eqt-popup__suggestion-name">
                <span
                  v-if="generator.kind === 'group'" class="eqt-rule-page__segment" :class="`eqt-rule-page__segment--${generator.id}`"
                >{{ generatorLabel(generator) }}</span>
                <span
                  v-else-if="generator.kind === 'category'" class="eqt-rule-page__category-pill" :style="categoryChipStyle(generator.id)"
                >{{ generatorLabel(generator) }}</span>
                <template v-else>
                  <component :is="RANGE_ICONS[generator.id]" class="eqt-rule-page__icon" />{{ generatorLabel(generator) }}
                </template>
              </span>
              <span class="eqt-popup__suggestion-tag" />
            </div>
            <!-- 素材用含有／不含的色條標出極性，也跟拖出一份的標籤分開 -->
            <div
              v-for="row in materialRows" :key="row.material.id"
              class="eqt-popup__suggestion eqt-rule-page__material"
              :class="[
                row.material.exclude ? 'eqt-popup__suggestion--exclude' : 'eqt-popup__suggestion--include',
                { 'eqt-popup__suggestion--styled': !!row.style },
              ]"
              :style="row.style" data-source="material" :data-id="row.material.id"
            >
              <span class="eqt-popup__suggestion-ns">{{ row.namespace }}：</span>
              <span class="eqt-popup__suggestion-name">{{ row.material.exclude ? '−' : '' }}{{ row.name }}</span>
              <span class="eqt-popup__suggestion-tag">
                {{ row.full }}
                <button
                  type="button" class="eqt-rule-page__material-remove"
                  :title="t('rulePrototype.removeCondition')" :aria-label="t('rulePrototype.removeCondition')"
                  @click="ruleMaterials.splice(ruleMaterials.indexOf(row.material), 1)"
                ><X /></button>
              </span>
            </div>
          </div>
        </template>
      </SuggestionList>
    </div>
  </section>
</template>
