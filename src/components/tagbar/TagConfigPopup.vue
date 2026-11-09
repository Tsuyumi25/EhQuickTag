<script setup lang="ts">
import { reactive, ref, watch, onMounted, nextTick, computed } from 'vue'
import { ExternalLink, MousePointerClick, Star } from '@lucide/vue'
import ContentEditable from 'vue-contenteditable'
import SearchTermEditor from '@/components/SearchTermEditor.vue'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { makeRow, type RowState } from '@/composables/useSearchTerm'
import { readEhSearchSnapshot } from '@/composables/ehSearchSnapshot'
import { TERM_RE } from '@/services/search/searchSyntax'
import { TagState, type TagButton } from '@/types'
import { t, isZhLocale } from '@/composables/useI18n'
import { loadTagDb } from '@/services/tags/tagDb'
import { getButtonShape, isStateShapeAllowed, addTag, nextTagState } from '@/services/search/tagState'
import { mouseRoles } from '@/services/store'
import type { Selection } from '@/services/tagPick'

const props = defineProps<{
  tag: TagButton
  lineColor?: string
  isAdd?: boolean
  nsFormat?: 'long' | 'short'
  defaultExactMatch?: boolean
}>()

const emit = defineEmits<{
  'save': [value: TagButton]
  'close': []
}>()

// 顏色改由 button context menu 編輯；popup 仍保留既有值，避免儲存其他欄位時清掉。

const label = ref('')
const color = ref<string | undefined>(undefined)
const effectiveColor = computed(() => color.value ?? props.lineColor)

// --- rows + active focus ---

const rows = reactive<RowState[]>([])
const activeRow = ref(-1)
const dbReady = ref(false)
const popupEl = ref<HTMLElement | null>(null)
const editorRefs = ref<Array<InstanceType<typeof SearchTermEditor> | null>>([])
const snapshotAvailable = readEhSearchSnapshot() !== null

watch(() => props.tag, (t) => {
  label.value = t.label ?? ''
  color.value = t.color
  const parts = t.tags ?? []
  rows.splice(0, rows.length, ...parts.map(makeRow))
  if (props.isAdd || !parts.length) rows.push(makeRow(''))
}, { immediate: true })

function useCurrentSearch(): void {
  const snapshot = readEhSearchSnapshot()
  if (!snapshot) return
  const terms = snapshot.keywords.match(TERM_RE) ?? []
  activeRow.value = -1
  rows.splice(0, rows.length, ...(terms.length ? terms : ['']).map(makeRow))
}

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

  emit('save', {
    kind: 'tag',
    tags: parts,
    label: label.value.trim() || undefined,
    color: color.value,
  })
}

// --- syntax help link ---

const isZh = computed(isZhLocale)
const syntaxHelpUrl = computed(() =>
  isZh.value
    ? 'https://ehwiki.org/wiki/Gallery_Searching/Chinese'
    : 'https://ehwiki.org/wiki/Gallery_Searching',
)

// --- shape rules ---
// 按鈕能停在哪些狀態由 tagState.ts 的 isStateShapeAllowed 決定（規則細節跟禁用理由詳見其 doc comment）

const currentTags = computed(() => rows.map(r => r.rawText.trim()).filter(Boolean))
const buttonShape = computed(() => getButtonShape(currentTags.value))

const orShapeAllowed = computed(() => isStateShapeAllowed(buttonShape.value, TagState.Or))
const excludeShapeAllowed = computed(() => isStateShapeAllowed(buttonShape.value, TagState.Exclude))

// shape label：positive/negative 的 single/multi 對應同一個顯示文案（label 只用
// 在 cycleSkipReason 裡引用按鈕「形狀」，不需要區分 single/multi）。
function shapeLabelFor(shape: typeof buttonShape.value): string {
  if (shape === 'positive-single' || shape === 'positive-multi') return t('tagConfig.shape.allPositive')
  if (shape === 'negative-single' || shape === 'negative-multi') return t('tagConfig.shape.allNegative')
  if (shape === 'all-or') return t('tagConfig.shape.allOr')
  if (shape === 'mixed') return t('tagConfig.shape.mixed')
  return ''
}

const missingStateReason = computed(() => {
  const shape = buttonShape.value
  if (shape === 'empty') return ''
  const skipped: string[] = []
  if (!orShapeAllowed.value) skipped.push('Or')
  if (!excludeShapeAllowed.value) skipped.push('Exclude')
  if (!skipped.length) return ''

  // 文案按缺的原因分類——對症下藥比通用 fallback 準：
  //   - mixed：兩態都沒有 → missingStateReasonMixed
  //   - all-or：Or 跟 Include 同一個 token → allOr-specific
  //   - negative-*：聯集需要 ~-X，e站不支援 → Or-specific
  //   - positive-multi：補集需要 ~-X，e站不支援 → Exclude-specific
  if (shape === 'mixed') {
    return t('tagConfig.missingStateReasonMixed', { skipped: skipped.join(', ') })
  }
  if (shape === 'all-or') {
    return t('tagConfig.missingStateReasonAllOr')
  }
  if (!orShapeAllowed.value) {
    return t('tagConfig.missingStateReasonOr', { shape: shapeLabelFor(shape) })
  }
  return t('tagConfig.missingStateReasonExclude', { shape: shapeLabelFor(shape) })
})

// --- simulator：照設定裡每顆滑鼠鍵的動作按，跟在 tagbar 上按這顆按鈕一樣 ---

const simState = ref<TagState>(TagState.Off)

function simulate(press: Selection): void {
  simState.value = nextTagState(currentTags.value, simState.value, press)
}

// 改了 tags 之後按鈕可能停不了原本的狀態（例如加了負向 tag 就沒有 Or），退回 Off
watch(buttonShape, () => {
  if (simState.value === TagState.Or && !orShapeAllowed.value) simState.value = TagState.Off
  if (simState.value === TagState.Exclude && !excludeShapeAllowed.value) simState.value = TagState.Off
})

const SIM_STATE_NAME: Record<TagState, string> = {
  [TagState.Off]: 'Off',
  [TagState.Include]: 'Include',
  [TagState.Or]: 'Or',
  [TagState.Exclude]: 'Exclude',
}

const simOutput = computed(() => {
  if (!currentTags.value.length || simState.value === TagState.Off) return ''
  return addTag('', currentTags.value, simState.value)
})
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup">
      <div class="eqt-popup__body">
      <!-- name -->
      <div class="eqt-popup__field">
        <label class="eqt-popup__label">{{ t('tagConfig.displayName') }}</label>
        <div class="eqt-popup__field-row" :class="currentTagStyleClass">
          <ContentEditable
            tag="span"
            :model-value="label"
            @update:model-value="(v: string) => label = v === '\n' ? '' : v"
            :contenteditable="'plaintext-only'"
            class="eqt-popup__name-input"
            spellcheck="false"
            :data-placeholder="t('tagConfig.displayNameHint')"
            :style="effectiveColor ? { '--line-color': effectiveColor } : undefined"
            no-nl
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
            :active="activeRow === i"
            @update:active="(val: boolean) => onChildActive(i, val)"
            @remove="removeRow(i)"
          />
        </div>
      </div>

      <hr class="eqt-popup__divider" />

      <!-- 空 shape：沒 tag 時整區隱藏（模擬還沒有東西可按） -->
      <div v-if="buttonShape !== 'empty'" class="eqt-popup__field">
        <div class="eqt-cycle-sim">
          <div class="eqt-cycle-sim__row">
            <button
              type="button" class="eqt-cycle-sim__btn"
              @click="simulate($event.detail === 0 ? 'positive' : mouseRoles.left)"
              @contextmenu.prevent="simulate(mouseRoles.right)"
              @mousedown.middle.prevent
              @auxclick.middle="simulate(mouseRoles.middle)"
            >
              <MousePointerClick :size="13" />
              <span>{{ t('tagConfig.simulateOutput') }}</span>
            </button>
            <span class="eqt-cycle-sim__label">
              {{ t('tagConfig.simulateCurrent', { state: SIM_STATE_NAME[simState] }) }}
            </span>
          </div>
          <input
            type="text"
            class="eqt-cycle-sim__output"
            :value="simOutput"
            readonly
            spellcheck="false"
          />
        </div>

        <p v-if="missingStateReason" class="eqt-cycle-reason">{{ missingStateReason }}</p>
      </div>

      <div class="eqt-popup__actions">
        <button
          v-if="snapshotAvailable"
          class="eqt-popup__btn"
          type="button"
          @click="useCurrentSearch"
        ><Star :size="12" /> {{ t('tagConfig.useCurrentSearch') }}</button>
        <div class="eqt-popup__spacer" />
        <button class="eqt-popup__btn" type="button" @click="emit('close')">
          {{ t('tagConfig.cancel') }} <kbd class="eqt-popup__kbd">Esc</kbd>
        </button>
        <button class="eqt-popup__btn eqt-popup__btn--green" type="button" @click="onSave">
          {{ t('tagConfig.save') }} <kbd class="eqt-popup__kbd">Ctrl+Enter</kbd>
        </button>
      </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// popup 共用結構（.eqt-popup-overlay、.eqt-popup、__field、__btn 等）在
// src/styles/popup.scss 全域 import。這檔只留 TagConfigPopup 專用的樣式。

.eqt-row {
  margin-bottom: 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  padding: 6px;
}

.eqt-cycle-reason {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--eqt-text-hint);
}

// 模擬輸出：照設定裡的滑鼠鍵動作按這顆按鈕，預覽 token output
// 兩行排版：第一行 button + 當前態 label；第二行輸出 token（可能很長）
.eqt-cycle-sim {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;

  &__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border: 1px solid var(--eqt-border);
    border-radius: 6px;
    background: var(--eqt-bg-btn);
    color: var(--eqt-text);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;

    &:hover {
      background: var(--eqt-bg-btn-hover);
    }
  }

  &__label {
    font-size: 12px;
    color: var(--eqt-text);
  }

  // readonly input：cursor 可移動、文字可選 / 複製，但無法編輯。
  // 比 <code> 更友好——userscript 場景用戶可能會想複製預覽 token 出去測試。
  &__output {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--eqt-bg-elevated);
    border: 1px solid var(--eqt-border);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--eqt-text);

    &:focus {
      outline: none;
    }
  }
}
</style>
