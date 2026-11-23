<script setup lang="ts">
import { computed, ref, shallowRef, watch, type CSSProperties } from 'vue'
import { entryForTag, getFallbackEntries, type TagEntry } from '@/services/tags/tagDb'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import MyTagsDraft from '@/components/mytags/MyTagsDraft.vue'
import type { NewTagInput, TagSetRef } from '@/composables/useEhMyTagsHost'
import type { TagState } from '@/services/mytags/mytagsEdits'
import type { TagImpact } from '@/services/mytags/mytagsScore'

type NewTagSubmission = NewTagInput & { tagSet: string }

const props = defineProps<{
  full: string
  state: TagState
  targetSet: string
  sourceSet: string | null
  sets: TagSetRef[]
  impact: TagImpact
  setColors: Record<string, string>
  styleOf: (entry: TagEntry) => CSSProperties | undefined
  busy: boolean
  previewed: boolean
  /** 從圖庫頁帶過來的標籤；有的話「選中」篩選一開始就打開 */
  picked: string[]
}>()

const emit = defineEmits<{
  'update:targetSet': [value: string]
  'update:full': [value: string]
  patch: [change: Partial<TagState>]
  pick: [entry: TagEntry]
  create: [submission: NewTagSubmission]
  move: [target: string]
  remove: []
  preview: []
  confirm: []
}>()

const query = ref('')
const selectedIdx = ref(0)
const fallbackEntries = shallowRef<TagEntry[]>([])
const selectedNs = ref<string | null>(null)
const popupNsList = computed(() => selectedNs.value ? [selectedNs.value] : undefined)

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  namespaces: () => selectedNs.value ? [selectedNs.value] : undefined,
  emptyFallback: () => fallbackEntries.value,
})

const pickedMode = ref(false)
watch(() => props.picked, (tags) => {
  pickedMode.value = tags.length > 0
}, { immediate: true })

// 圖庫上的標籤不一定在字典裡，也不必走字典搜尋：數量就那幾個，直接比對名稱和翻譯
const pickedEntries = computed(() => {
  if (!dbReady.value) return []
  const q = query.value.trim().toLowerCase()
  return props.picked
    .map(entryForTag)
    .filter((entry) => !q || entry.fullTag.toLowerCase().includes(q) || entry.nameLow.includes(q))
})
const candidates = computed(() => pickedMode.value ? pickedEntries.value : suggestions.value)

watch(candidates, () => { selectedIdx.value = 0 })
watch(
  dbReady,
  (ready) => {
    if (!ready) return
    if (!fallbackEntries.value.length) fallbackEntries.value = getFallbackEntries()
  },
  { immediate: true },
)
watch(selectedNs, () => {
  if (!dbReady.value) return
  fallbackEntries.value = getFallbackEntries({
    namespaces: selectedNs.value ? [selectedNs.value] : undefined,
  })
})


function pick(entry: TagEntry): void {
  emit('pick', entry)
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (selectedIdx.value < candidates.value.length - 1) selectedIdx.value++
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (event.key === 'Enter') {
    const entry = candidates.value[selectedIdx.value]
    if (!entry) return
    event.preventDefault()
    pick(entry)
  }
}
</script>

<template>
  <section class="eqt-tag-catalog eqt-taglist">
    <MyTagsDraft
      :full="full"
      :state="state"
      :target-set="targetSet"
      :source-set="sourceSet"
      :sets="sets"
      :set-colors="setColors"
      :busy="busy"
      :impact="impact"
      show-impact
      :previewed="previewed"
      @update:target-set="emit('update:targetSet', $event)"
      @update:full="emit('update:full', $event)"
      @patch="emit('patch', $event)"
      @create="emit('create', $event)"
      @move="emit('move', $event)"
      @remove="emit('remove')"
      @preview="emit('preview')"
      @confirm="emit('confirm')"
    />

    <div class="eqt-tag-catalog__browser">
      <NamespaceFilter
        v-model="selectedNs"
        v-model:picked="pickedMode"
        :picked-count="picked.length"
      />

      <div class="eqt-tag-catalog__candidates">
        <div class="eqt-tag-catalog__search">
          <input
            v-model="query"
            class="eqt-tag-catalog__search-input"
            type="text"
            :placeholder="dbReady ? t('manage.searchPlaceholder') : t('tagConfig.loadingPlaceholder')"
            :disabled="!dbReady"
            autocomplete="off"
            spellcheck="false"
            @keydown="onSearchKeydown"
          >
        </div>

        <SuggestionList
          v-if="candidates.length"
          class="eqt-tag-catalog__results"
          :suggestions="candidates"
          :selected-idx="selectedIdx"
          :ns-list="pickedMode ? undefined : popupNsList"
          :style-of="styleOf"
          @update:selected-idx="selectedIdx = $event"
          @pick="pick"
        />
        <p v-else-if="dbReady" class="eqt-tag-catalog__empty">{{ t('tagConfig.noResult') }}</p>
      </div>
    </div>
  </section>
</template>

<style lang="scss">

.eqt-tag-catalog {
  display: flex;
  flex-direction: column;
  gap: calc(var(--eqt-checkbox-size) / 3);
  min-width: 0;
  min-height: 0;

  &__browser {
    display: flex;
    flex: 1 1 auto;
    gap: calc(var(--eqt-checkbox-size) / 3);
    min-width: 0;
    min-height: 0;
  }

  &__candidates {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: calc(var(--eqt-checkbox-size) / 4);
    min-width: 0;
    min-height: 0;
  }

  &__search {
    flex: 0 0 auto;
  }

  &__search-input {
    width: 100%;
    height: var(--eqt-checkbox-size);
    box-sizing: border-box;
    padding: 0 calc(var(--eqt-checkbox-size) / 3);
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: var(--eqt-radius-sm);
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    font: inherit;
    font-size: var(--eqt-fs-md);
  }

  &__results {
    flex: 1 1 auto;
    min-height: 0;
  }

  &__empty {
    margin: 0;
    padding: calc(var(--eqt-checkbox-size) / 2);
    color: var(--eqt-text-hint);
    text-align: center;
  }
}
</style>
