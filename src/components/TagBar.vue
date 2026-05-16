<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { TagState, type QuickTag } from '@/types'
import { useSortable } from '@/composables/useSortable'

const STATE_CLASS: Record<TagState, string | null> = {
  [TagState.Include]: 'eqt-tag-bar__btn--include',
  [TagState.Or]:      'eqt-tag-bar__btn--or',
  [TagState.Exclude]: 'eqt-tag-bar__btn--exclude',
  [TagState.Off]:     null,
}

const props = defineProps<{
  tags: QuickTag[]
  searchText: string
}>()

const emit = defineEmits<{
  'update:searchText': [value: string]
  'configure': [tag: string]
  'add': []
  'reorder': [from: number, to: number]
  'settings': []
}>()

const editing = ref(false)
const tagListEl = ref<HTMLElement | null>(null)

// --- Sortable lifecycle ---

const { activate: activateSortable, deactivate: deactivateSortable } = useSortable(tagListEl, {
  animation: 150,
  ghostClass: 'eqt-tag-bar__btn--ghost',
  chosenClass: 'eqt-tag-bar__btn--chosen',
  dragClass: 'eqt-tag-bar__btn--drag',
  onEnd: (evt) => {
    if (evt.oldIndex !== undefined && evt.newIndex !== undefined && evt.oldIndex !== evt.newIndex) {
      emit('reorder', evt.oldIndex, evt.newIndex)
    }
  },
})

watch(editing, (isEditing) => {
  if (isEditing) activateSortable()
  else deactivateSortable()
})

// --- search text parsing ---

const TOKEN_RE = /[^"\s]*"[^"]*"[^\s]*|[^\s"]+/g

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

const tokenSet = computed(() => new Set(tokenize(props.searchText)))

function getState(tag: string): TagState {
  const tokens = tokenSet.value
  if (tokens.has(`-${tag}`)) return TagState.Exclude
  if (tokens.has(`~${tag}`)) return TagState.Or
  if (tokens.has(tag)) return TagState.Include
  return TagState.Off
}

function removeTag(text: string, tag: string): string {
  const tokens = tokenize(text)
  const forms = [tag, `~${tag}`, `-${tag}`]
  return tokens.filter(t => !forms.includes(t)).join(' ')
}

function addTag(text: string, tag: string, state: TagState): string {
  const tokens = tokenize(text)

  if (state === TagState.Include) tokens.push(tag)
  else if (state === TagState.Or) tokens.push(`~${tag}`)
  else if (state === TagState.Exclude) tokens.push(`-${tag}`)

  return tokens.join(' ')
}

// --- normal mode handlers ---

function onLeftClick(tag: string) {
  const state = getState(tag)
  const cleaned = removeTag(props.searchText, tag)

  emit(
    'update:searchText',
    state === TagState.Off ? addTag(cleaned, tag, TagState.Include) : cleaned,
  )
}

const MODIFIER_CYCLE: Record<number, TagState> = {
  [TagState.Off]: TagState.Or,
  [TagState.Include]: TagState.Or,
  [TagState.Or]: TagState.Exclude,
  [TagState.Exclude]: TagState.Or,
}

function onRightClick(event: MouseEvent, tag: string) {
  event.preventDefault()

  const state = getState(tag)
  const next = MODIFIER_CYCLE[state]
  const cleaned = removeTag(props.searchText, tag)
  emit('update:searchText', addTag(cleaned, tag, next))
}
</script>

<template>
  <div class="eqt-tag-bar">
    <div ref="tagListEl" class="eqt-tag-bar__list">
      <button
        v-for="qt in tags"
        :key="qt.tag"
        :data-id="qt.tag"
        class="eqt-tag-bar__btn"
        :class="editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(qt.tag)]"
        type="button"
        @click="editing ? emit('configure', qt.tag) : onLeftClick(qt.tag)"
        @contextmenu.prevent="!editing && onRightClick($event, qt.tag)"
      >
        {{ qt.label || qt.tag }}
      </button>
    </div>

    <button
      class="eqt-tag-bar__ctrl"
      type="button"
      title="新增標籤"
      @click="emit('add')"
    >+</button>

    <button
      class="eqt-tag-bar__ctrl"
      type="button"
      :title="editing ? '完成編輯' : '編輯標籤'"
      @click="editing = !editing"
    >{{ editing ? '✓' : '✎' }}</button>

    <button
      class="eqt-tag-bar__ctrl"
      type="button"
      title="設定"
      @click="emit('settings')"
    >⚙</button>
  </div>
</template>

<style lang="scss">
.eqt-tag-bar {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 0;

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__btn {
    padding: 2px 8px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
    transition: background 0.15s, border-color 0.15s, color 0.15s;

    &:hover {
      background: var(--eqt-bg-hover);
    }

    &--include {
      background: #4a7c59;
      border-color: #3d6b4a;
      color: #fff;

      &:hover {
        background: #3d6b4a;
      }
    }

    &--or {
      background: #b8860b;
      border-color: #9a7209;
      color: #fff;

      &:hover {
        background: #9a7209;
      }
    }

    &--exclude {
      background: #8c3333;
      border-color: #743030;
      color: #fff;
      text-decoration: line-through;

      &:hover {
        background: #743030;
      }
    }

    &--editing {
      border-style: dashed;
      cursor: grab;

      &:hover {
        background: var(--eqt-bg-hover);
      }
    }

    &--ghost {
      opacity: 0.4;
    }

    &--chosen {
      cursor: grabbing;
    }

    &--drag {
      opacity: 0.8;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  }

  &__ctrl {
    padding: 2px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;

    &:hover {
      background: var(--eqt-bg-hover);
    }
  }
}
</style>
