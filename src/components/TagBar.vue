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
  profileName: string
  profileIdx: number
  profileCount: number
  prevProfileName: string
  nextProfileName: string
}>()

const emit = defineEmits<{
  'update:searchText': [value: string]
  'configure': [lineIdx: number, tagIdx: number]
  'add': []
  'addUrl': []
  'move': [fromLine: number, fromIdx: number, toLine: number, toIdx: number]
  'moveLine': [from: number, to: number]
  'deleteLine': [lineIdx: number]
  'addLine': []
  'settings': []
  'prevProfile': []
  'nextProfile': []
  'renameProfile': [name: string]
  'createProfile': [name: string]
  'deleteProfile': []
}>()

const editing = ref(false)
const linesEl = ref<HTMLElement | null>(null)
const rowEls = ref<HTMLElement[]>([])

// --- profile carousel ---

const onCreationPage = ref(false)
const renamingProfile = ref(false)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function onPrev() {
  if (onCreationPage.value) {
    onCreationPage.value = false
  } else {
    emit('prevProfile')
  }
}

function onNext() {
  if (props.profileIdx === props.profileCount - 1) {
    onCreationPage.value = true
  } else {
    emit('nextProfile')
  }
}

function startRenameOrCreate() {
  renameValue.value = onCreationPage.value ? '' : props.profileName
  renamingProfile.value = true
  nextTick(() => renameInput.value?.select())
}

function finishRenameOrCreate() {
  const trimmed = renameValue.value.trim()
  if (onCreationPage.value) {
    if (trimmed) {
      emit('createProfile', trimmed)
      onCreationPage.value = false
    }
  } else if (trimmed && trimmed !== props.profileName) {
    emit('renameProfile', trimmed)
  }
  renamingProfile.value = false
}

// --- Sortable lifecycle ---

let sortableInstances: Sortable[] = []
let domSnapshots = new Map<HTMLElement, Node[]>()
let lineSortableInstance: Sortable | null = null
let lineDomSnapshot: Node[] = []

function activateSortables() {
  // Line-level sortable (reorder entire rows via handle)
  if (linesEl.value) {
    lineSortableInstance = new Sortable(linesEl.value, {
      handle: '.eqt-tag-bar__handle',
      draggable: '.eqt-tag-bar__line-wrap',
      animation: 150,
      ghostClass: 'eqt-tag-bar__line-wrap--ghost',
      onStart: () => {
        lineDomSnapshot = [...linesEl.value!.childNodes]
      },
      onEnd: (evt) => {
        const container = linesEl.value!
        while (container.firstChild) container.removeChild(container.firstChild)
        for (const node of lineDomSnapshot) container.appendChild(node)

        if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
          const from = evt.oldIndex - 1  // offset: profile-row is first child
          const to = evt.newIndex - 1
          if (from !== to) emit('moveLine', from, to)
        }
      },
    })
  }

  // Tag-level sortables (cross-row drag)
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
  try { lineSortableInstance?.destroy() } catch { /* ignore */ }
  lineSortableInstance = null
  lineDomSnapshot = []

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

let mutatingLines = false

function rebuildSortablesAround(action: () => void) {
  if (mutatingLines) return
  mutatingLines = true
  deactivateSortables()
  try { action() } catch (e) { mutatingLines = false; throw e }
  nextTick(() => {
    activateSortables()
    mutatingLines = false
  })
}

function onAddLine() {
  rebuildSortablesAround(() => emit('addLine'))
}

function onDeleteLine(li: number) {
  rebuildSortablesAround(() => emit('deleteLine', li))
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
    <div class="eqt-tag-bar__lines" ref="linesEl">
      <div class="eqt-tag-bar__profile-row">
        <button
          class="eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--prev"
          type="button"
          :disabled="profileIdx === 0 && !onCreationPage"
          @click="onPrev"
        >{{ onCreationPage ? profileName : prevProfileName }} &lsaquo;</button>
        <input
          v-if="renamingProfile"
          ref="renameInput"
          v-model="renameValue"
          class="eqt-tag-bar__profile-input"
          @keydown.enter="finishRenameOrCreate"
          @keydown.escape="renamingProfile = false"
          @blur="finishRenameOrCreate"
        />
        <div v-else class="eqt-tag-bar__profile-split">
          <button
            class="eqt-tag-bar__profile-split-name"
            type="button"
            @click="startRenameOrCreate"
          >{{ onCreationPage ? '點擊並命名創建' : profileName }}</button>
          <button
            class="eqt-tag-bar__profile-split-delete"
            :class="{ 'eqt-tag-bar__profile-split-delete--hidden': !editing || onCreationPage }"
            type="button"
            :tabindex="(!editing || onCreationPage) ? -1 : undefined"
            :disabled="profileCount <= 1"
            @click="emit('deleteProfile')"
          >🗑</button>
        </div>
        <button
          class="eqt-tag-bar__profile-nav eqt-tag-bar__profile-nav--next"
          type="button"
          :disabled="onCreationPage"
          @click="onNext"
        >&rsaquo; {{ onCreationPage ? '' : nextProfileName }}</button>
      </div>
      <template v-if="onCreationPage">
        <div v-for="n in tagLines.length" :key="n" class="eqt-tag-bar__line-wrap">
          <div class="eqt-tag-bar__line"></div>
        </div>
      </template>
      <template v-else>
      <div
        v-for="(line, li) in tagLines"
        :key="li"
        class="eqt-tag-bar__line-wrap"
      >
        <div v-if="editing" class="eqt-tag-bar__handle" title="拖曳排序行">⠿</div>
        <button
          v-if="editing && line.length === 0"
          class="eqt-tag-bar__line-delete"
          type="button"
          title="刪除空行"
          @click="onDeleteLine(li)"
        >🗑</button>
        <div
          ref="rowEls"
          :data-line="li"
          class="eqt-tag-bar__line"
        >
          <template v-for="(qt, ti) in line" :key="qt.tag || qt.url">
            <a
              v-if="qt.url && !editing"
              :href="qt.url"
              :data-id="qt.url"
              class="eqt-tag-bar__btn eqt-tag-bar__btn--url"
            >↗ {{ qt.label || qt.url }}</a>

            <button
              v-else-if="qt.url"
              :data-id="qt.url"
              class="eqt-tag-bar__btn eqt-tag-bar__btn--editing"
              type="button"
              @click="emit('configure', li, ti)"
            >↗ {{ qt.label || qt.url }}</button>

            <button
              v-else
              :data-id="qt.tag"
              class="eqt-tag-bar__btn"
              :class="editing ? 'eqt-tag-bar__btn--editing' : STATE_CLASS[getState(qt.tag)]"
              type="button"
              @click="editing ? emit('configure', li, ti) : onLeftClick(qt.tag)"
              @contextmenu.prevent="!editing && onRightClick($event, qt.tag)"
            >{{ qt.label || qt.tag }}</button>
          </template>
        </div>
      </div>

      </template>
      <div class="eqt-tag-bar__bottom-row">
        <button
          v-if="editing"
          class="eqt-tag-bar__line-add"
          type="button"
          @click="onAddLine"
        >+ 新增行</button>
        <div class="eqt-tag-bar__controls">
          <button
            class="eqt-tag-bar__ctrl"
            type="button"
            @click="emit('add')"
          >+ 新增標籤</button>

          <button
            class="eqt-tag-bar__ctrl"
            type="button"
            @click="emit('addUrl')"
          >↗ 新增網址</button>

          <button
            class="eqt-tag-bar__ctrl eqt-tag-bar__ctrl--toggle"
            type="button"
            @click="editing = !editing"
          ><span :class="{ 'eqt-tag-bar__ctrl-hidden': !editing }">✓ 完成</span><span :class="{ 'eqt-tag-bar__ctrl-hidden': editing }">✎ 編輯</span></button>

          <button
            class="eqt-tag-bar__ctrl"
            type="button"
            @click="emit('settings')"
          >⚙ 設定</button>
        </div>
      </div>
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
    width: 80%;
    margin: 0 auto;
  }

  &__line-wrap {
    display: flex;
    align-items: flex-start;
    gap: 4px;

    &--ghost {
      opacity: 0.4;
    }
  }

  &__handle {
    flex-shrink: 0;
    cursor: grab;
    color: var(--eqt-text-hint);
    font-size: 14px;
    line-height: 24px;
    user-select: none;
    padding: 0 2px;

    &:hover {
      color: var(--eqt-text-secondary);
    }

    &:active {
      cursor: grabbing;
    }
  }

  &__bottom-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__line-add {
    flex: 1;
    min-height: 24px;
    padding: 2px 8px;
    border: var(--eqt-border-width) dashed var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;
    text-align: center;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  &__line-delete {
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 12px;
    line-height: 24px;
    padding: 0 2px;

    &:hover {
      color: #8c3333;
    }
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
    margin-left: auto;
  }

  &__profile-row {
    display: flex;
    align-items: stretch;
    gap: 4px;
  }


  &__profile-nav {
    flex: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 11px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--prev,
    &--next {
      text-align: center;
    }

    &:hover:not(:disabled) {
      background: var(--eqt-bg-hover);
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  &__profile-split {
    flex: 5;
    position: relative;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    min-width: 0;
  }

  &__profile-split-name {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--eqt-text-secondary);
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    line-height: 1.4;
    text-align: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      background: var(--eqt-bg-hover);
    }
  }

  &__profile-split-delete {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    padding: 0 8px;
    border: none;
    border-left: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 0 3px 3px 0;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 11px;
    line-height: 1.4;

    &:hover:not(:disabled) {
      background: rgba(140, 51, 51, 0.15);
      color: #8c3333;
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }

    &--hidden {
      visibility: hidden;
      pointer-events: none;
    }
  }

  &__profile-input {
    flex: 5;
    padding: 2px 8px;
    border: var(--eqt-border-width) solid var(--eqt-border-focus);
    border-radius: 3px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    font-size: 13px;
    font-weight: bold;
    line-height: 1.4;
    text-align: center;
    box-sizing: border-box;

    &:focus {
      outline: none;
    }
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

    &--url {
      text-decoration: none;
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

    &--toggle {
      display: grid;

      > * {
        grid-area: 1 / 1;
      }
    }
  }

  &__ctrl-hidden {
    visibility: hidden;
  }
}
</style>
