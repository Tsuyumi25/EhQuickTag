<script setup lang="ts">
import { computed } from 'vue'
import { parseTerm, serializeTerm } from '@/services/searchSyntax'
import { tokenize, setTagState, removeTag, getNextRightClickState } from '@/services/tagState'
import { nsOrder } from '@/services/store'
import { t } from '@/composables/useI18n'
import { TagState } from '@/types'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  addToSearch: []
}>()

interface TermInfo {
  raw: string         // search 裡原本的 token（含前綴）
  positive: string    // 撥掉 - / ~ 後的 canonical 形式，給 setTagState 當「身份種子」用
  state: TagState
  displayFull: string   // 完整 token（misc 列用）
  displayShort: string  // 撥掉 namespace 的精簡形（namespace 分組列用）
  parseError: boolean
}

interface TermGroup {
  key: string         // namespace name 或 '__misc__'
  label: string       // 列首顯示文字
  terms: TermInfo[]
}

const MISC_KEY = '__misc__'

const STATE_ORDER: Record<TagState, number> = {
  [TagState.Include]: 0,
  [TagState.Or]:      1,
  [TagState.Exclude]: 2,
  [TagState.Off]:     3,
}

// 把 searchText tokenize → parseTerm → bucket by namespace。
// 同 namespace 內按 state 排序（Include 在前，Or 中，Exclude 後）。
// 列順序：照 nsOrder，沒列在 nsOrder 的 namespace 隨後，misc 永遠最後。
const groups = computed<TermGroup[]>(() => {
  const buckets = new Map<string, TermInfo[]>()

  for (const tok of tokenize(props.modelValue)) {
    const parsed = parseTerm(tok)
    const state = tok.startsWith('-') ? TagState.Exclude
                : tok.startsWith('~') ? TagState.Or
                : TagState.Include
    const positive = parsed.parseError
      ? tok
      : serializeTerm({ ...parsed, prefix: null })

    const groupKey = parsed.parseError || !parsed.namespace ? MISC_KEY : parsed.namespace

    const displayShort = parsed.namespace && !parsed.parseError
      ? serializeTerm({ ...parsed, namespace: null, namespaceRaw: null })
      : tok

    const term: TermInfo = {
      raw: tok,
      positive,
      state,
      displayFull: tok,
      displayShort,
      parseError: !!parsed.parseError,
    }

    if (!buckets.has(groupKey)) buckets.set(groupKey, [])
    buckets.get(groupKey)!.push(term)
  }

  for (const arr of buckets.values()) {
    arr.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])
  }

  const result: TermGroup[] = []
  for (const ns of nsOrder.value) {
    if (buckets.has(ns)) {
      result.push({ key: ns, label: t(`ns.${ns}`), terms: buckets.get(ns)! })
      buckets.delete(ns)
    }
  }
  for (const [key, terms] of buckets) {
    if (key === MISC_KEY) continue
    result.push({ key, label: key, terms })
  }
  if (buckets.has(MISC_KEY)) {
    result.push({ key: MISC_KEY, label: t('tagbar.miscRow'), terms: buckets.get(MISC_KEY)! })
  }

  return result
})

const STATE_CLASS: Record<TagState, string | null> = {
  [TagState.Include]: 'eqt-search-panel__button--include',
  [TagState.Or]:      'eqt-search-panel__button--or',
  [TagState.Exclude]: 'eqt-search-panel__button--exclude',
  [TagState.Off]:     null,
}

function applyTermState(term: TermInfo, next: TagState): void {
  const tags = [term.positive]
  if (next === TagState.Off) {
    emit('update:modelValue', removeTag(props.modelValue, tags))
  } else {
    emit('update:modelValue', setTagState(props.modelValue, tags, next))
  }
}

function onTermClick(term: TermInfo): void {
  const next = term.state === TagState.Include ? TagState.Off : TagState.Include
  applyTermState(term, next)
}

function onTermContextMenu(e: MouseEvent, term: TermInfo): void {
  e.preventDefault()
  const next = getNextRightClickState([term.positive], undefined, term.state)
  if (next === null) return
  applyTermState(term, next)
}

function onTermRemove(term: TermInfo): void {
  if (term.parseError) {
    const remaining = tokenize(props.modelValue).filter(t => t !== term.raw)
    emit('update:modelValue', remaining.join(' '))
    return
  }
  emit('update:modelValue', removeTag(props.modelValue, [term.positive]))
}

function onAddClick(): void {
  emit('addToSearch')
}
</script>

<template>
  <div class="eqt-search-panel">
    <div
      v-for="group in groups"
      :key="group.key"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ group.label }}:</div>
      <div class="eqt-search-panel__cells">
        <span
          v-for="term in group.terms"
          :key="term.raw"
          class="eqt-search-panel__button"
          :class="[
            STATE_CLASS[term.state],
            { 'eqt-search-panel__button--error': term.parseError },
          ]"
          @click="onTermClick(term)"
          @contextmenu="onTermContextMenu($event, term)"
        >
          <span class="eqt-search-panel__button-text">
            {{ group.key === MISC_KEY ? term.displayFull : term.displayShort }}
          </span>
          <button
            class="eqt-search-panel__button-remove"
            type="button"
            tabindex="-1"
            @click.stop="onTermRemove(term)"
          >&times;</button>
        </span>
      </div>
    </div>

    <div class="eqt-search-panel__add-row">
      <button
        class="eqt-search-panel__add"
        type="button"
        title="新增"
        @click="onAddClick"
      >+</button>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-search-panel {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 8px;
  row-gap: 4px;
  align-items: start;
}

.eqt-search-panel__row {
  display: contents;
}

.eqt-search-panel__label {
  color: var(--eqt-text-hint);
  font-size: 12px;
  line-height: var(--eqt-row-h);
  text-align: right;
  white-space: nowrap;
  user-select: none;
}

.eqt-search-panel__cells {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: var(--eqt-row-h);
}

.eqt-search-panel__button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  box-sizing: border-box;
  height: var(--eqt-row-h);
  padding: 0 2px 0 8px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 3px;
  background: var(--eqt-bg-btn);
  color: var(--eqt-text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
  user-select: none;
  transition: var(--eqt-transition-base);

  &:hover {
    background: var(--eqt-bg-hover);
  }

  &--include {
    background: color-mix(in srgb, var(--eqt-status-include) 55%, transparent);
    border-color: var(--eqt-status-include);

    &:hover {
      background: color-mix(in srgb, var(--eqt-status-include) 70%, transparent);
    }
  }

  &--or {
    background: color-mix(in srgb, var(--eqt-status-or) 55%, transparent);
    border-color: var(--eqt-status-or);

    &:hover {
      background: color-mix(in srgb, var(--eqt-status-or) 70%, transparent);
    }
  }

  &--exclude {
    background: color-mix(in srgb, var(--eqt-status-exclude) 55%, transparent);
    border-color: var(--eqt-status-exclude);

    &:hover {
      background: color-mix(in srgb, var(--eqt-status-exclude) 70%, transparent);
    }
  }

  &--error {
    border-color: var(--eqt-danger);
    color: var(--eqt-danger);
    text-decoration: wavy underline var(--eqt-danger);
  }
}

.eqt-search-panel__button-text {
  white-space: nowrap;
}

.eqt-search-panel__button-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;

  &:hover {
    background: var(--eqt-danger-bg-hover);
    color: var(--eqt-danger);
  }
}

// 「+」自成一列、跨兩格、靠右——空狀態下也有固定的「新增入口」
.eqt-search-panel__add-row {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}

.eqt-search-panel__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  transition: var(--eqt-transition-base);

  &:hover {
    border-color: var(--eqt-text-secondary);
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}
</style>
