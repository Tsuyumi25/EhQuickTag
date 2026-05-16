<script setup lang="ts">
import { ref, computed } from 'vue'
import { TagState, type QuickTag } from '@/types'

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

// --- search text parsing ---

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
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

// --- edit mode: drag reorder ---

const dragIndex = ref(-1)

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index
  event.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

function onDrop(index: number) {
  if (dragIndex.value !== -1 && dragIndex.value !== index) {
    emit('reorder', dragIndex.value, index)
  }
  dragIndex.value = -1
}

function onDragEnd() {
  dragIndex.value = -1
}
</script>

<template>
  <div class="eqt-tag-bar">
    <button
      v-for="(qt, index) in tags"
      :key="qt.tag"
      class="eqt-tag-bar__btn"
      :class="[
        editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(qt.tag)],
        { 'eqt-tag-bar__btn--dragging': editing && dragIndex === index },
      ]"
      type="button"
      :draggable="editing"
      @click="editing ? emit('configure', qt.tag) : onLeftClick(qt.tag)"
      @contextmenu.prevent="!editing && onRightClick($event, qt.tag)"
      @dragstart="onDragStart(index, $event)"
      @dragover="onDragOver"
      @drop="onDrop(index)"
      @dragend="onDragEnd"
    >
      {{ qt.label || qt.tag }}
    </button>

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

  &__btn {
    padding: 2px 8px;
    border: 1px solid #8a8271;
    border-radius: 3px;
    background: transparent;
    color: #5c0d12;
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
    transition: background 0.15s, border-color 0.15s, color 0.15s;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
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
        background: rgba(0, 0, 0, 0.08);
      }
    }

    &--dragging {
      opacity: 0.4;
    }
  }

  &__ctrl {
    padding: 2px 6px;
    border: 1px solid #8a8271;
    border-radius: 3px;
    background: transparent;
    color: #5c0d12;
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
}
</style>
