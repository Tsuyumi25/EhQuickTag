<script setup lang="ts">
import { reactive, ref, watch, onMounted, nextTick, computed } from 'vue'
import { ExternalLink, ChevronRight, Lock, MousePointerClick } from '@lucide/vue'
import ContentEditable from 'vue-contenteditable'
import LineColorSwatch from '@/components/LineColorSwatch.vue'
import SearchTermEditor from '@/components/SearchTermEditor.vue'
import { currentTagStyleClass } from '@/composables/useTagStyle'
import { usePopupBehavior } from '@/composables/usePopupBehavior'
import { makeRow, type RowState } from '@/composables/useSearchTerm'
import { TagState, type TagButton, type TagMode } from '@/types'
import { t, isCJKLocale } from '@/composables/useI18n'
import { loadTagDb } from '@/services/tagDb'
import { getButtonShape, isStateShapeAllowed, getEffectiveModifiers, addTag } from '@/services/tagState'

const props = defineProps<{
  tag: TagButton
  lineColor?: string
  isAdd?: boolean
  useNhWeight?: boolean
  nsOrder?: string[]
  nsFormat?: 'long' | 'short'
  defaultExactMatch?: boolean
}>()

const emit = defineEmits<{
  'save': [value: TagButton]
  'delete': []
  'close': []
}>()

// --- name + color ---

const label = ref('')
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
  const parts = t.tags ?? []
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

const currentDisabledModes = computed<TagMode[]>(() => {
  const d: TagMode[] = []
  if (!orEnabled.value) d.push('or')
  if (!excludeEnabled.value) d.push('exclude')
  return d
})

function onSave(): void {
  const parts = rows.map(r => r.rawText.trim()).filter(Boolean)
  if (!parts.length) return
  const disabled = currentDisabledModes.value

  emit('save', {
    kind: 'tag',
    tags: parts,
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

// --- right-click cycle shape rules ---
// shape 允許判斷由 tagState.ts 的 isStateShapeAllowed 提供（規則細節跟禁用理由
// 詳見其 doc comment）。user 還能透過 orEnabled / excludeEnabled 額外手動禁用
// 一個 shape 允許的態。

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

const cycleSkipReason = computed(() => {
  const shape = buttonShape.value
  if (shape === 'empty') return ''
  const skipped: string[] = []
  if (!orShapeAllowed.value) skipped.push('Or')
  if (!excludeShapeAllowed.value) skipped.push('Exclude')
  if (!skipped.length) return ''

  // 文案按死因分類——對症下藥比通用 fallback 準：
  //   - mixed：兩態都禁用 → cycleSkipReasonMixed
  //   - all-or：Or 是 no-op token（cycle 卡死 fix）→ allOr-specific
  //   - negative-*：聯集需要 ~-X，e站不支援 → Or-specific
  //   - positive-multi：補集需要 ~-X，e站不支援 → Exclude-specific
  if (shape === 'mixed') {
    return t('tagConfig.cycleSkipReasonMixed', { skipped: skipped.join(', ') })
  }
  if (shape === 'all-or') {
    return t('tagConfig.cycleSkipReasonAllOr')
  }
  if (!orShapeAllowed.value) {
    return t('tagConfig.cycleSkipReasonOr', { shape: shapeLabelFor(shape) })
  }
  return t('tagConfig.cycleSkipReasonExclude', { shape: shapeLabelFor(shape) })
})

// --- simulator: 點擊 cycle 經過 shape 允許的所有 state，預覽 output token ---

// Include 永遠是 cycle 起點 + 使用者實際 effective 的 modifier。直接讀
// getEffectiveModifiers + 當前 user disabled 設定，做到所見即所得——使用者把
// Or chip 關掉後 simulator 也立刻跳過 Or。
const simSequence = computed<TagState[]>(() => [
  TagState.Include,
  ...getEffectiveModifiers(currentTags.value, currentDisabledModes.value),
])

const simState = ref<TagState>(TagState.Include)

// sequence 因 tags 改變後若不再包含當前 state，自動 reset 到第一個
watch(simSequence, (seq) => {
  if (!seq.includes(simState.value)) simState.value = seq[0]
})

function simulateNext(): void {
  const seq = simSequence.value
  const idx = seq.indexOf(simState.value)
  simState.value = seq[(idx + 1) % seq.length]
}

const SIM_STATE_NAME: Record<number, string> = {
  [TagState.Include]: 'Include',
  [TagState.Or]: 'Or',
  [TagState.Exclude]: 'Exclude',
}

const simStateName = computed(() => SIM_STATE_NAME[simState.value])

const simOutput = computed(() => {
  if (!currentTags.value.length) return ''
  return addTag('', currentTags.value, simState.value)
})
</script>

<template>
  <div class="eqt-popup-overlay">
    <div ref="popupEl" class="eqt-popup">
      <!-- name + color -->
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

      <!-- click modes: 左鍵永遠 Include (不可關)，右鍵 Or → Exclude cycle -->
      <!-- 順序：sim → modes → reason（reason 緊跟 modes 解釋 chip 為何禁用） -->
      <!-- 空 shape：沒 tag 時整區隱藏（cycle / 模擬都還沒能力評估） -->
      <div v-if="buttonShape !== 'empty'" class="eqt-popup__field">
        <div class="eqt-cycle-sim">
          <div class="eqt-cycle-sim__row">
            <button type="button" class="eqt-cycle-sim__btn" @click="simulateNext">
              <MousePointerClick :size="13" />
              <span>{{ t('tagConfig.simulateOutput') }}</span>
            </button>
            <span class="eqt-cycle-sim__label">
              {{ t('tagConfig.simulateCurrent', { state: simStateName }) }}
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

        <div class="eqt-cycle-modes">
          <div class="eqt-cycle-group">
            <span class="eqt-popup__label eqt-cycle-group__label">{{ t('tagConfig.leftClickMode') }}</span>
            <span class="eqt-cycle-chip eqt-cycle-chip--include">Include</span>
          </div>
          <div class="eqt-cycle-group">
            <span class="eqt-popup__label eqt-cycle-group__label">{{ t('tagConfig.rightClickMode') }}</span>
            <button
              type="button"
              class="eqt-cycle-chip eqt-cycle-chip--or"
              :class="{
                'eqt-cycle-chip--shape-disabled': !orShapeAllowed,
                'eqt-cycle-chip--user-disabled': orShapeAllowed && !orEnabled,
              }"
              :disabled="!orShapeAllowed"
              :title="orShapeAllowed
                ? (orEnabled ? t('tagConfig.cycleChipClickToDisable') : t('tagConfig.cycleChipClickToEnable'))
                : t('tagConfig.cycleChipShapeDisabled')"
              @click="orShapeAllowed && (orEnabled = !orEnabled)"
            >
              <Lock v-if="!orShapeAllowed" :size="11" />
              <input
                v-else
                type="checkbox"
                :checked="orEnabled"
                tabindex="-1"
                class="eqt-cycle-chip__check"
              />
              <span>Or</span>
            </button>
            <ChevronRight :size="14" class="eqt-cycle-arrow" />
            <button
              type="button"
              class="eqt-cycle-chip eqt-cycle-chip--exclude"
              :class="{
                'eqt-cycle-chip--shape-disabled': !excludeShapeAllowed,
                'eqt-cycle-chip--user-disabled': excludeShapeAllowed && !excludeEnabled,
              }"
              :disabled="!excludeShapeAllowed"
              :title="excludeShapeAllowed
                ? (excludeEnabled ? t('tagConfig.cycleChipClickToDisable') : t('tagConfig.cycleChipClickToEnable'))
                : t('tagConfig.cycleChipShapeDisabled')"
              @click="excludeShapeAllowed && (excludeEnabled = !excludeEnabled)"
            >
              <Lock v-if="!excludeShapeAllowed" :size="11" />
              <input
                v-else
                type="checkbox"
                :checked="excludeEnabled"
                tabindex="-1"
                class="eqt-cycle-chip__check"
              />
              <span>Exclude</span>
            </button>
          </div>
        </div>
        <p v-if="cycleSkipReason" class="eqt-cycle-reason">{{ cycleSkipReason }}</p>
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
  z-index: var(--eqt-z-overlay);
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
    // :has(> br:only-child) covers contenteditable 全選刪光後的 <br> 幽靈情況。
    &:empty::after,
    &:has(> br:only-child)::after {
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
      color: var(--eqt-danger);
    }
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
      background: var(--eqt-primary);
      border-color: var(--eqt-primary-hover);
      color: var(--eqt-on-primary);

      &:hover {
        background: var(--eqt-primary-hover);
      }
    }

    &--delete {
      background: var(--eqt-danger);
      border-color: var(--eqt-danger-hover);
      color: var(--eqt-on-primary);

      &:hover {
        background: var(--eqt-danger-hover);
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

// 點擊模式視覺：左鍵 [Include] / 右鍵 [Or] → [Exclude]
// chip 三狀態：shape 允許+啟用（實色）、shape 允許+user 關掉（半透明）、
// shape 禁用（鎖頭+灰色 disabled）
.eqt-cycle-modes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  margin-top: 10px;
}

.eqt-cycle-group {
  display: flex;
  align-items: center;
  gap: 8px;

  &__label {
    margin: 0;
  }
}

.eqt-cycle-arrow {
  color: var(--eqt-text-hint);
  flex-shrink: 0;
}

.eqt-cycle-chip {
  --chip-color: var(--eqt-text);

  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--eqt-border);
  border-radius: 6px;
  background: var(--eqt-bg-btn);
  color: var(--eqt-text);
  font-size: 13px;
  font-family: inherit;
  line-height: 1.2;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;

  &:disabled {
    cursor: not-allowed;
  }

  // 每 chip type 設自己的 --chip-color；background/border/text 用 color-mix 派生
  // 對齊 SearchTermEditor explain--tag 的「柔和色 + 透明背景」風格，不刺眼
  &--include {
    --chip-color: #059669;
    background: color-mix(in srgb, var(--chip-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 40%, transparent);
    color: var(--chip-color);
    cursor: default;

    .eqt-dark & {
      --chip-color: #34d399;
      background: color-mix(in srgb, var(--chip-color) 15%, transparent);
    }
  }

  &--or:not(:disabled):not(.eqt-cycle-chip--user-disabled) {
    --chip-color: #ca8a04;
    background: color-mix(in srgb, var(--chip-color) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 40%, transparent);
    color: var(--chip-color);

    .eqt-dark & {
      --chip-color: #facc15;
      background: color-mix(in srgb, var(--chip-color) 15%, transparent);
    }
  }

  &--exclude:not(:disabled):not(.eqt-cycle-chip--user-disabled) {
    --chip-color: var(--eqt-status-exclude);
    background: color-mix(in srgb, var(--chip-color) 14%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
    color: var(--chip-color);
  }

  &--or:not(:disabled):hover,
  &--exclude:not(:disabled):hover {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
  }

  // shape 規則禁用：鎖頭 + 灰色背景 + 不可 click
  &--shape-disabled {
    opacity: 0.55;
    color: var(--eqt-text-hint);
    background: var(--eqt-bg-disabled);
  }

  // shape 允許但 user 手動關掉：半透明顯示「能用但被你關了」
  &--user-disabled {
    opacity: 0.5;
  }

  // chip 內嵌 checkbox，視覺暗示「可開關」；實際 toggle 走 outer button click。
  // EH 全域對 checkbox 加 `position: relative; top: 2px` 的偏移已經由 theme.scss
  // 的 `#eqt-app input[type="checkbox"]` reset 處理。
  &__check {
    margin: 0;
    width: 13px;
    height: 13px;
    pointer-events: none;
    accent-color: var(--chip-color);
  }
}

.eqt-cycle-reason {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--eqt-text-hint);
}

// 模擬輸出：點 button cycle 經過 shape 允許的所有 state，預覽 token output
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
    color: var(--eqt-text-secondary);
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
      outline: 1px solid var(--eqt-border-focus);
      outline-offset: -1px;
    }
  }
}

// useSearchTerm 用到的 tag-remove 在 SearchTermEditor 內部 emit('remove') 觸發；
// .eqt-popup__tag-remove 樣式留在這檔（共用 popup 內 remove 按鈕的視覺）。
</style>
