<script setup lang="ts">
import { reactive, ref, watch, onMounted, nextTick, computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import SearchTermEditor from '@/components/SearchTermEditor.vue'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { useContentEditableName } from '@/composables/useContentEditableName'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { makeRow, type RowState } from '@/composables/useSearchTerm'
import { type QuickTag, type TagMode, splitMultiTag } from '@/types'
import { t, isCJKLocale } from '@/composables/useI18n'
import { loadTagDb } from '@/services/tagDb'

const props = defineProps<{
  tag: QuickTag
  lineColor?: string
  isAdd?: boolean
  useNhWeight?: boolean
  nsOrder?: string[]
  nsFormat?: 'long' | 'short'
  defaultExactMatch?: boolean
}>()

const emit = defineEmits<{
  'save': [value: QuickTag]
  'delete': []
  'close': []
}>()

// --- name + color ---

const { label, nameInputEl, onNameInput, onNameCompositionStart, onNameCompositionEnd } = useContentEditableName()
const color = ref<string | undefined>(undefined)
const effectiveColor = computed(() => color.value ?? props.lineColor)

// --- rows + active focus ---

const rows = reactive<RowState[]>([])
const orEnabled = ref(true)
const excludeEnabled = ref(true)
const activeRow = ref(-1)
const dbReady = ref(false)
const popupEl = ref<HTMLElement | null>(null)
const editorRefs = ref<Array<InstanceType<typeof SearchTermEditor> | null>>([])

watch(() => props.tag, (t) => {
  label.value = t.label ?? ''
  color.value = t.color
  const parts = t.tag ? splitMultiTag(t.tag) : []
  rows.splice(0, rows.length, ...parts.map(makeRow))
  if (props.isAdd || !parts.length) rows.push(makeRow(''))
  const disabled = new Set(t.disabledModes ?? [])
  orEnabled.value = !disabled.has('or')
  excludeEnabled.value = !disabled.has('exclude')
}, { immediate: true })

function addRowAfter(idx: number): void {
  rows.splice(idx + 1, 0, makeRow(''))
  activeRow.value = idx + 1
  nextTick(() => editorRefs.value[idx + 1]?.focus())
}

function removeRow(idx: number): void {
  if (rows.length <= 1) {
    rows[0] = makeRow('')
    return
  }
  rows.splice(idx, 1)
  if (activeRow.value === idx) activeRow.value = -1
  else if (activeRow.value > idx) activeRow.value--
}

function onChildActive(i: number, val: boolean): void {
  if (val) activeRow.value = i
  else if (activeRow.value === i) activeRow.value = -1
}

// --- popup behavior ---
// Esc 優先級：如果有 active row（autocomplete 開著），先關 autocomplete；
// 否則 emit close。SearchTermEditor 收到 active=false 會自動 blur input。
function handleClose(): void {
  if (activeRow.value >= 0) {
    activeRow.value = -1
  } else {
    emit('close')
  }
}

usePopupBehavior({ popupEl, onClose: handleClose, onSave })

// --- DB loading（給 autofocus 看時機）---

onMounted(async () => {
  await loadTagDb()
  dbReady.value = true
  if (props.isAdd) {
    await nextTick()
    editorRefs.value[0]?.focus()
  }
})

// --- save ---

function onSave(): void {
  const parts = rows.map(r => r.rawText.trim()).filter(Boolean)
  if (!parts.length) return
  const joined = parts.join(', ')
  const disabled: TagMode[] = []
  if (!orEnabled.value) disabled.push('or')
  if (!excludeEnabled.value) disabled.push('exclude')

  emit('save', {
    tag: joined,
    label: label.value.trim() || undefined,
    color: color.value,
    disabledModes: disabled.length ? disabled : undefined,
  })
}

// --- syntax help link ---

const isCJK = computed(isCJKLocale)
const syntaxHelpUrl = computed(() =>
  isCJK.value
    ? 'https://ehwiki.org/wiki/Gallery_Searching/Chinese'
    : 'https://ehwiki.org/wiki/Gallery_Searching',
)
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup">
      <!-- name + color -->
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('tagConfig.displayName') }}</label>
        <div class="eqt-popup__field-row" :class="currentTagStyleClass">
          <span
            ref="nameInputEl"
            class="eqt-popup__name-input"
            contenteditable="plaintext-only"
            spellcheck="false"
            :data-placeholder="t('tagConfig.displayNameHint')"
            :style="effectiveColor ? { '--line-color': effectiveColor } : undefined"
            @input="onNameInput"
            @keydown.enter.prevent
            @compositionstart="onNameCompositionStart"
            @compositionend="onNameCompositionEnd"
          ></span>
          <LineColorSwatch
            v-model="color"
            :title="t('common.itemColor')"
          />
        </div>
      </div>

      <hr class="eqt-popup__divider" />

      <!-- rows -->
      <div class="eqt-popup__field">
        <div class="eqt-popup__label-row">
          <label class="eqt-popup__label">{{ t('tagConfig.tagSyntax') }}</label>
          <a class="eqt-popup__syntax-help" :href="syntaxHelpUrl" target="_blank" rel="noopener"><ExternalLink :size="12" /> Wiki</a>
          <button
            class="eqt-popup__add-btn"
            type="button"
            @click="addRowAfter(rows.length - 1)"
          >+ {{ t('tagbar.addTag') }}</button>
        </div>

        <div
          v-for="(row, i) in rows"
          :key="row.id"
          class="eqt-row"
        >
          <SearchTermEditor
            ref="editorRefs"
            :row-state="row"
            :default-exact-match="defaultExactMatch"
            :ns-format="nsFormat"
            :db-ready="dbReady"
            :use-nh-weight="useNhWeight ?? false"
            :ns-order="nsOrder ?? []"
            :active="activeRow === i"
            @update:active="(val: boolean) => onChildActive(i, val)"
            @remove="removeRow(i)"
          />
        </div>
      </div>

      <hr class="eqt-popup__divider" />

      <!-- right-click modes -->
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('tagConfig.rightClickMode') }}</label>
        <div class="eqt-popup__modes">
          <label class="eqt-popup__mode">
            <input type="checkbox" v-model="orEnabled" />
            <span>Or（~）</span>
          </label>
          <label class="eqt-popup__mode">
            <input type="checkbox" v-model="excludeEnabled" />
            <span>Exclude（-）</span>
          </label>
        </div>
      </div>

      <div class="eqt-popup__actions">
        <button v-if="!isAdd" class="eqt-popup__btn eqt-popup__btn--delete" type="button" @click="emit('delete')">
          {{ t('tagConfig.delete') }}
        </button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          {{ t('tagConfig.cancel') }} <kbd class="eqt-popup__kbd">Esc</kbd>
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--primary" type="button" @click="onSave">
          {{ t('tagConfig.save') }} <kbd class="eqt-popup__kbd">Ctrl+Enter</kbd>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.eqt-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--eqt-overlay);
}

.eqt-popup {
  text-align: left;
  background: var(--eqt-bg);
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 0.5rem;
  padding: 1.25rem;
  width: clamp(22rem, 80vw, 60rem);
  min-height: 80vh;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--eqt-shadow);
  font-size: 13px;
  color: var(--eqt-text);

  &__field {
    margin-bottom: 10px;
    position: relative;
  }

  &__field-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__name-input {
    display: inline-block;
    padding: 2px 8px;
    border: var(--eqt-border-width) solid var(--line-color, var(--eqt-border));
    border-radius: 3px;
    background: color-mix(in srgb, var(--line-color, var(--eqt-bg-btn)) 15%, var(--eqt-bg-btn));
    color: var(--eqt-text-secondary);
    font-size: 12px;
    line-height: 1.4;
    outline: none;
    cursor: text;
    min-width: 6em;
    white-space: nowrap;

    // ::after for placeholder so pushable preset's ::before (pedestal) doesn't clash.
    &:empty::after {
      content: attr(data-placeholder);
      color: var(--eqt-text-hint);
    }

    &:focus {
      border-color: var(--eqt-border-focus);
    }
  }

  &__label-row {
    display: flex;
    align-items: baseline;
    margin-bottom: 3px;
    font-weight: bold;
    font-size: 12px;
  }

  &__syntax-help {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-left: 6px;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    font-size: 12px;
    font-weight: normal;
    line-height: 1.4;
    text-decoration: none;
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  &__add-btn {
    margin-left: auto;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 12px;
    line-height: 1.4;

    &:hover {
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  &__label {
    display: block;
    margin-bottom: 3px;
    font-weight: bold;
    font-size: 12px;

    .eqt-popup__label-row > & {
      margin-bottom: 0;
    }
  }

  &__input {
    width: 100%;
    padding: 4px 6px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    font-size: 13px;
    background: var(--eqt-bg-elevated);
    color: var(--eqt-text);
    box-sizing: border-box;

    &:focus {
      outline: none;
      border-color: var(--eqt-border-focus);
    }

    &:disabled {
      background: var(--eqt-bg-disabled);
      color: var(--eqt-text-hint);
    }
  }

  &__divider {
    border: none;
    border-top: var(--eqt-border-width) solid var(--eqt-divider);
    margin: 12px 0;
  }

  &__tag-remove {
    flex-shrink: 0;
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--eqt-text-hint);
    cursor: pointer;
    font-size: 16px;
    border-radius: 3px;

    &:hover {
      background: var(--eqt-bg-hover);
      color: #8c3333;
    }
  }

  &__modes {
    display: flex;
    gap: 12px;
  }

  &__mode {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
  }

  &__spacer {
    flex: 1;
  }

  &__kbd {
    margin-left: 6px;
    font-size: 10px;
    opacity: 0.6;
    font-family: inherit;
  }

  &__btn {
    padding: 4px 12px;
    border: var(--eqt-border-width) solid var(--eqt-border);
    border-radius: 3px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    cursor: pointer;
    font-size: 12px;

    &:hover {
      background: var(--eqt-bg-btn-hover);
    }

    &--primary {
      background: #4a7c59;
      border-color: #3d6b4a;
      color: #fff;

      &:hover {
        background: #3d6b4a;
      }
    }

    &--delete {
      background: #8c3333;
      border-color: #743030;
      color: #fff;

      &:hover {
        background: #743030;
      }
    }
  }
}

.eqt-row {
  margin-bottom: 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  padding: 6px;
}

// useSearchTerm 用到的 tag-remove 在 SearchTermEditor 內部 emit('remove') 觸發；
// .eqt-popup__tag-remove 樣式留在這檔（共用 popup 內 remove 按鈕的視覺）。
</style>
