<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import Sortable from 'sortablejs'
import { TagState, type QuickTag, splitMultiTag } from '@/types'

const STATE_CLASS: Record<TagState, string | null> = {
  [TagState.Include]: 'eqt-tag-bar__btn--include',
  [TagState.Or]:      'eqt-tag-bar__btn--or',
  [TagState.Exclude]: 'eqt-tag-bar__btn--exclude',
  [TagState.Off]:     null,
}

const props = defineProps<{
  tagLines: QuickTag[][]
  searchText: string
}>()

const emit = defineEmits<{
  'update:searchText': [value: string]
  'configure': [lineIdx: number, tagIdx: number]
  'add': []
  'move': [fromLine: number, fromIdx: number, toLine: number, toIdx: number]
  'addLine': []
  'settings': []
}>()

const editing = ref(false)
const rowEls = ref<HTMLElement[]>([])

// --- Sortable lifecycle ---

let sortableInstances: Sortable[] = []
let domSnapshots = new Map<HTMLElement, Node[]>()

function activateSortables() {
  for (const el of rowEls.value) {
    sortableInstances.push(new Sortable(el, {
      group: 'eqt-tags',
      animation: 150,
      ghostClass: 'eqt-tag-bar__btn--ghost',
      chosenClass: 'eqt-tag-bar__btn--chosen',
      dragClass: 'eqt-tag-bar__btn--drag',
      onStart: () => {
        domSnapshots.clear()
        for (const rowEl of rowEls.value) {
          domSnapshots.set(rowEl, [...rowEl.childNodes])
        }
      },
      onEnd: (evt) => {
        // Restore only the containers involved in the drag
        const targets = new Set([evt.from, evt.to].filter(Boolean))
        for (const container of targets) {
          const nodes = domSnapshots.get(container as HTMLElement)
          if (!nodes) continue
          while (container.firstChild) container.removeChild(container.firstChild)
          for (const node of nodes) container.appendChild(node)
        }

        if (evt.from && evt.to && evt.oldIndex !== undefined && evt.newIndex !== undefined) {
          const fromLine = Number(evt.from.dataset.line)
          const toLine = Number(evt.to.dataset.line)
          if (fromLine !== toLine || evt.oldIndex !== evt.newIndex) {
            emit('move', fromLine, evt.oldIndex, toLine, evt.newIndex)
          }
        }
      },
    }))
  }
}

function deactivateSortables() {
  for (const s of sortableInstances) {
    try { s.destroy() } catch { /* ignore corrupted instance */ }
  }
  sortableInstances = []
  domSnapshots.clear()
}

watch(editing, (isEditing) => {
  if (isEditing) nextTick(activateSortables)
  else deactivateSortables()
})

onUnmounted(deactivateSortables)

let addingLine = false
function onAddLine() {
  if (addingLine) return
  addingLine = true
  deactivateSortables()
  emit('addLine')
  nextTick(() => {
    activateSortables()
    addingLine = false
  })
}

// --- search text parsing ---

const TOKEN_RE = /[^"\s]*"[^"]*"[^\s]*|[^\s"]+/g

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

const tokenSet = computed(() => new Set(tokenize(props.searchText)))

function getState(tag: string): TagState {
  const tokens = tokenSet.value
  const parts = splitMultiTag(tag)
  if (!parts.length) return TagState.Off

  if (parts.every(p => tokens.has(`-${p}`))) return TagState.Exclude
  if (parts.every(p => tokens.has(`~${p}`))) return TagState.Or
  if (parts.every(p => tokens.has(p))) return TagState.Include
  return TagState.Off
}

function removeTag(text: string, tag: string): string {
  const tokens = tokenize(text)
  const forms = new Set(splitMultiTag(tag).flatMap(p => [p, `~${p}`, `-${p}`]))
  return tokens.filter(t => !forms.has(t)).join(' ')
}

function addTag(text: string, tag: string, state: TagState): string {
  const tokens = tokenize(text)

  for (const p of splitMultiTag(tag)) {
    if (state === TagState.Include) tokens.push(p)
    else if (state === TagState.Or) tokens.push(`~${p}`)
    else if (state === TagState.Exclude) tokens.push(`-${p}`)
  }

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
    <div class="eqt-tag-bar__lines">
      <div
        v-for="(line, li) in tagLines"
        :key="li"
        ref="rowEls"
        :data-line="li"
        class="eqt-tag-bar__line"
      >
        <button
          v-for="(qt, ti) in line"
          :key="qt.tag"
          :data-id="qt.tag"
          class="eqt-tag-bar__btn"
          :class="editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(qt.tag)]"
          type="button"
          @click="editing ? emit('configure', li, ti) : onLeftClick(qt.tag)"
          @contextmenu.prevent="!editing && onRightClick($event, qt.tag)"
        >
          {{ qt.label || qt.tag }}
        </button>
      </div>
    </div>

    <div class="eqt-tag-bar__controls">
      <button
        v-if="editing"
        class="eqt-tag-bar__ctrl"
        type="button"
        title="新增行"
        @click="onAddLine"
      >+行</button>

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
  </div>
</template>

<style lang="scss">
.eqt-tag-bar {
  padding: 6px 0;

  &__lines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0 12px;
  }

  &__line {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 24px;
  }

  &__controls {
    display: flex;
    gap: 4px;
    margin-top: 4px;
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
