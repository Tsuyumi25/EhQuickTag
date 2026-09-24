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
import type { TagState } from '@/services/mytagsEdits'
import type { TagImpact } from '@/services/mytagsScore'

type NewTagSubmission = NewTagInput & { tagSet: string }

const props = defineProps<{
  full: string
  state: TagState
  targetSet: string
  sourceSet: string | null
  sets: TagSetRef[]
  impact: TagImpact
  setColors: Record<string, string>
  busy: boolean
  focusRequest: number
  previewed: boolean
}>()

const emit = defineEmits<{
  'update:targetSet': [value: string]
  'update:full': [value: string]
  patch: [change: Partial<TagState>]
  pick: [entry: TagEntry]
  create: [submission: NewTagSubmission]
  move: [target: string]
  preview: []
  confirm: []
}>()

const query = ref('')
const name = ref(props.full)
watch(() => props.full, (full) => {
  if (name.value.trim() !== full) name.value = full
})
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

const selectedSet = computed(() => props.sets.find((set) => set.value === props.targetSet))
const existing = computed(() => props.sourceSet !== null)
const setFull = computed(() => (selectedSet.value?.used ?? 0) >= TAGSET_CAPACITY)
const normalizedColor = computed(() => normalizeTagColor(props.state.color))
const colorInvalid = computed(() => normalizedColor.value === null)
const canCreate = computed(() => (
  !existing.value
  && !!props.full
  && !setFull.value
  && !colorInvalid.value
  && !props.busy
))
const canMove = computed(() => (
  existing.value
  && props.targetSet !== props.sourceSet
  && !setFull.value
  && !props.busy
))

function commit(): void {
  if (existing.value) {
    if (canMove.value) emit('move', props.targetSet)
    return
  }
  if (!canCreate.value || normalizedColor.value === null) return
  emit('create', {
    full: props.full,
    tagSet: props.targetSet,
    ...props.state,
    color: normalizedColor.value,
  })
}
</script>

<template>
  <section class="eqt-tag-catalog eqt-taglist">
    <div
      class="eqt-tag-catalog__draft"
      :class="{ 'eqt-tag-catalog__draft--previewed': previewed }"
    >
      <MyTagsTagBody
        :full="full"
        :state="state"
        :set-color="setColors[sourceSet ?? targetSet] ?? ''"
        :impact="impact"
        show-impact
        @patch="emit('patch', $event)"
      >
        <template #tag>
          <input
            v-model="name"
            class="eqt-taglist__input eqt-tag-catalog__name"
            type="text"
            :aria-label="t('manage.newTag')"
            :placeholder="t('manage.newTag')"
            autocomplete="off"
            spellcheck="false"
            @input="emit('update:full', name.trim())"
            @focus="emit('preview')"
            @keydown.enter.prevent="!$event.isComposing && full && emit('confirm')"
          >
        </template>
      </MyTagsTagBody>

      <div class="eqt-tag-catalog__create-row">
        <select
          class="eqt-panel__setpick"
          :value="targetSet"
          :aria-label="t(existing ? 'manage.moveTarget' : 'manage.targetSet')"
          @change="emit('update:targetSet', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="set in sets"
            :key="set.value"
            :value="set.value"
            :disabled="(set.used ?? 0) >= TAGSET_CAPACITY && set.value !== sourceSet"
          >{{ set.name }} · {{ set.used ?? '?' }}/{{ TAGSET_CAPACITY }}</option>
        </select>
        <button
          type="button"
          class="eqt-tag-catalog__create eqt-panel__btn eqt-panel__btn--primary"
          :disabled="existing ? !canMove : !canCreate"
          @click="commit"
        >{{ busy ? t('panel.working') : t(existing ? 'manage.moveTag' : 'taglist.addTag') }}</button>
      </div>

      <p v-if="full && setFull && targetSet !== sourceSet" class="eqt-tag-catalog__error">
        {{ t('manage.setFull') }}
      </p>
      <p v-else-if="full && !existing && colorInvalid" class="eqt-tag-catalog__error">
        {{ t('manage.colorInvalid') }}
      </p>
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

    &--previewed {
      background: var(--eqt-bg-active);
    }
  }

  &__name {
    flex: 1;
    min-width: 0;
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
