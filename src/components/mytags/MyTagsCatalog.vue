<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { getFallbackEntries, type TagEntry } from '@/services/tagDb'
import { useTagSuggestions } from '@/composables/useTagSuggestions'
import { t } from '@/composables/useI18n'
import SuggestionList from '@/components/SuggestionList.vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import MyTagsTagBody from '@/components/mytags/MyTagsTagBody.vue'
import { TAGSET_CAPACITY, type NewTagInput, type TagSetRef } from '@/composables/useEhMyTagsHost'
import { normalizeTagColor } from '@/services/mytagsColors'
import type { TagImpact } from '@/services/mytagsScore'

type NewTagDraft = NewTagInput & { tagSet: string }

const props = defineProps<{
  draft: NewTagDraft
  sets: TagSetRef[]
  impact: TagImpact
  setColors: Record<string, string>
  existingTags: ReadonlySet<string>
  busy: boolean
  focusRequest: number
}>()

const emit = defineEmits<{
  'update:draft': [draft: NewTagDraft]
  pick: [entry: TagEntry]
  create: [draft: NewTagDraft]
}>()

const query = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const selectedIdx = ref(0)
const fallbackEntries = shallowRef<TagEntry[]>([])
const selectedNs = ref<string | null>(null)
const popupNsList = computed(() => selectedNs.value ? [selectedNs.value] : undefined)

const { dbReady, suggestions } = useTagSuggestions({
  query: () => query.value,
  namespaces: () => selectedNs.value ? [selectedNs.value] : undefined,
  emptyFallback: () => fallbackEntries.value,
})

watch(suggestions, () => { selectedIdx.value = 0 })
watch(
  () => [props.focusRequest, dbReady.value] as const,
  ([request, ready]) => {
    if (!ready) return
    if (!fallbackEntries.value.length) fallbackEntries.value = getFallbackEntries()
    if (request) void nextTick(() => inputEl.value?.focus())
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
    if (selectedIdx.value < suggestions.value.length - 1) selectedIdx.value++
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (selectedIdx.value > 0) selectedIdx.value--
  } else if (event.key === 'Enter') {
    const entry = suggestions.value[selectedIdx.value]
    if (!entry) return
    event.preventDefault()
    pick(entry)
  }
}

function patch(patch: Partial<NewTagDraft>): void {
  const next = { ...props.draft, ...patch }
  if (patch.watch) next.hidden = false
  if (patch.hidden) next.watch = false
  emit('update:draft', next)
}

const selectedSet = computed(() => props.sets.find((set) => set.value === props.draft.tagSet))
const setFull = computed(() => (selectedSet.value?.used ?? 0) >= TAGSET_CAPACITY)
const alreadyAdded = computed(() => !!props.draft.full && props.existingTags.has(props.draft.full))
const normalizedColor = computed(() => normalizeTagColor(props.draft.color))
const colorInvalid = computed(() => normalizedColor.value === null)
const canCreate = computed(() => (
  !!props.draft.full
  && !alreadyAdded.value
  && !setFull.value
  && !colorInvalid.value
  && !props.busy
))

function create(): void {
  if (!canCreate.value || normalizedColor.value === null) return
  emit('create', { ...props.draft, color: normalizedColor.value })
}
</script>

<template>
  <section class="eqt-tag-catalog eqt-taglist">
    <div class="eqt-tag-catalog__draft">
      <MyTagsTagBody
        :full="draft.full"
        :state="draft"
        :set-color="setColors[draft.tagSet] ?? ''"
        :impact="impact"
        show-impact
        @patch="patch"
      />

      <div class="eqt-tag-catalog__create-row">
        <select
          class="eqt-panel__setpick"
          :value="draft.tagSet"
          :aria-label="t('manage.targetSet')"
          @change="patch({ tagSet: ($event.target as HTMLSelectElement).value })"
        >
          <option
            v-for="set in sets"
            :key="set.value"
            :value="set.value"
            :disabled="(set.used ?? 0) >= TAGSET_CAPACITY"
          >{{ set.name }} · {{ set.used ?? '?' }}/{{ TAGSET_CAPACITY }}</option>
        </select>
        <button
          type="button"
          class="eqt-tag-catalog__create eqt-panel__btn eqt-panel__btn--primary"
          :disabled="!canCreate"
          @click="create"
        >{{ busy ? t('panel.working') : t('taglist.addTag') }}</button>
      </div>

      <p v-if="draft.full && alreadyAdded" class="eqt-tag-catalog__error">{{ t('manage.alreadyAdded') }}</p>
      <p v-else-if="draft.full && setFull" class="eqt-tag-catalog__error">{{ t('manage.setFull') }}</p>
      <p v-else-if="draft.full && colorInvalid" class="eqt-tag-catalog__error">{{ t('manage.colorInvalid') }}</p>
    </div>

    <div class="eqt-tag-catalog__browser">
      <NamespaceFilter v-model="selectedNs" />

      <div class="eqt-tag-catalog__candidates">
        <div class="eqt-tag-catalog__search">
          <input
            ref="inputEl"
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
          v-if="suggestions.length"
          class="eqt-tag-catalog__results"
          :suggestions="suggestions"
          :selected-idx="selectedIdx"
          :ns-list="popupNsList"
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

  &__draft {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: calc(var(--eqt-checkbox-size) / 4);
    padding: calc(var(--eqt-checkbox-size) / 3);
    border: var(--eqt-border-width) solid var(--eqt-divider);
    border-radius: var(--eqt-radius-md);
    background: var(--eqt-bg-stripe);
  }


  &__create-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: calc(var(--eqt-checkbox-size) / 4);
    align-items: stretch;

    > .eqt-panel__setpick {
      width: 100%;
      height: calc(var(--eqt-checkbox-size) + var(--eqt-border-width) * 2);
      box-sizing: border-box;
    }
  }

  &__create {
    height: calc(var(--eqt-checkbox-size) + var(--eqt-border-width) * 2);
    padding: 0 calc(var(--eqt-checkbox-size) / 3);
    font-size: var(--eqt-fs-xs);
    box-sizing: border-box;
  }

  &__error {
    margin: 0;
    color: var(--eqt-danger);
    font-size: var(--eqt-fs-xs);
  }

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
