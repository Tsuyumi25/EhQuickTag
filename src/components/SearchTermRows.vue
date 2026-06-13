<script lang="ts">
// 共用元件：把搜尋 chip 按 namespace 分組顯示成 rows + 提供 toggle / drag-clone。
// 不含 history row、controls-row、useSessionTerms——caller 負責管 session 狀態
// 跟 history，這層只渲染給定的 sessionTerms 並 emit state 變更。
//
// 兩個 caller：
//   - SearchPanel：editing 模式下可拖出 chip → TagBar
//   - AddTagPopup：read-only（editing=false），純當「當前搜尋狀態」的視窗
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Draggable from 'vuedraggable'
import { parseTerm, serializeTerm, type Prefix } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, getNextRightClickState, setTagState, buildIdentityIndex } from '@/services/tagState'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tagDb'
import { t } from '@/composables/useI18n'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
import { useBilingualWrap } from '@/composables/useBilingualWrap'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import type { TermEntry } from '@/composables/useSessionTerms'
import { TagState, type TagButton } from '@/types'

const props = defineProps<{
  modelValue: string
  sessionTerms: TermEntry[]
  editing?: boolean
  // caller 已算好 identityIndex 時傳進來（避免同個 modelValue 在 caller 跟這層
  // 各 build 一份）。AddTagPopup 用此路徑；SearchPanel 沒算就讓我自己 build
  identityIndex?: Map<string, string | null>
  // flat=true 時 root 用 display: contents，row label / cells 攤平到 caller 的
  // outer grid——SearchPanel 用此模式讓 namespace label 跟 history label 跨 row
  // 對齊。AddTagPopup 不傳（自帶 grid，獨立的工作區視窗）
  flat?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'dismiss-terms': [positives: string[]]
  'drag-start': []
  'drag-end': []
}>()

// MISC_KEY = null：沒 namespace 的 term 落這組。typed null 比字串 sentinel 安全，
// 強迫每個 consumer 顯式 handle 而不是被「e站新增名為 __misc__ 的 namespace」偷襲
const MISC_KEY = null

const { effectiveShowCJK, cjkDisplay } = useDisplayConfig()

const identityIndex = computed(() => props.identityIndex ?? buildIdentityIndex(tokenize(props.modelValue)))

interface TermInfo {
  positive: string
  state: TagState
  displayShort: string  // namespace row 用：CJK = 翻譯名稱（無 ns）、English = 原生 token literal
  displayFull: string   // misc row 用：原生 token literal（state prefix + tag + suffix）
  literal: string       // raw search-syntax token，給 drag-clone 用
  cloneLabel: string    // chip 當前顯示文字
  measureZh: string
  measureEn: string
}

interface TermGroup {
  key: string | null
  label: string
  terms: TermInfo[]
}

// Off 給 explicit class（即使沒對應 style）：給 e2e / 外部觀察者可正面 assert，
// 避免 negate 推論在新 state 加入時靜默漏掉
const STATE_CLASS: Record<TagState, string> = {
  [TagState.Include]: 'eqt-search-panel__button--include',
  [TagState.Or]:      'eqt-search-panel__button--or',
  [TagState.Exclude]: 'eqt-search-panel__button--exclude',
  [TagState.Off]:     'eqt-search-panel__button--off',
}

const STATE_PREFIX: Record<TagState, Prefix> = {
  [TagState.Include]: null,
  [TagState.Or]:      '~',
  [TagState.Exclude]: '-',
  [TagState.Off]:     null,
}

function stateOf(positive: string): TagState {
  const id = tokenIdentity(positive)
  if (!id) return TagState.Off
  const present = identityIndex.value.get(id)
  if (!present) return TagState.Off
  const prefix = parseTerm(present).prefix
  if (prefix === '-') return TagState.Exclude
  if (prefix === '~') return TagState.Or
  return TagState.Include
}

const groups = computed<TermGroup[]>(() => {
  // tagDbVersion 是 async loadTagDb 完成的 reactive signal——沒這條的話，URL 帶
  // ?f_search 進頁面時 findEntryByNsTag 第一輪回 undefined，DB 載完後 computed
  // 因為沒有依賴變動不會重算，CJK 名定格在英文 raw
  void tagDbVersion.value

  const buckets = new Map<string | null, TermInfo[]>()

  function pushTerm(positive: string, state: TagState): void {
    const parsed = parseTerm(positive)
    const groupKey: string | null = parsed.namespace ?? MISC_KEY
    const prefix = STATE_PREFIX[state]
    const prefixStr = prefix ?? ''
    const literal = serializeTerm({ ...parsed, prefix })

    const cjkEntry = parsed.namespace
      ? findEntryByNsTag(parsed.namespace, parsed.tag)
      : undefined
    const zhText = cjkEntry ? prefixStr + cjkDisplay(cjkEntry.name) : prefixStr + parsed.tag
    const enText = literal
    const displayShort = effectiveShowCJK.value ? zhText : enText
    const displayFull = literal

    const isMisc = groupKey === MISC_KEY
    const cloneLabel = isMisc ? displayFull : displayShort
    const term: TermInfo = {
      positive, state, displayShort, displayFull, literal, cloneLabel,
      measureZh: isMisc ? literal : zhText,
      measureEn: isMisc ? literal : enText,
    }
    if (!buckets.has(groupKey)) buckets.set(groupKey, [])
    buckets.get(groupKey)!.push(term)
  }

  // sessionTerms 順序 = 顯示順序。entry.active 決定 state 來源：true 走 stateOf 推導、
  // false 固定顯示 Off。Off entry 全部顯示（本 session 內手動 Off 過的 term 應該維持
  // 灰 chip 讓使用者一鍵 reactivate）
  for (const entry of props.sessionTerms) {
    if (entry.active) {
      pushTerm(entry.positive, stateOf(entry.positive))
    } else {
      pushTerm(entry.positive, TagState.Off)
    }
  }

  const result: TermGroup[] = []
  for (const ns of DEFAULT_NS_ORDER) {
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

const containerRef = ref<HTMLElement | null>(null)

const { chunkBilingual } = useBilingualWrap({
  containerRef,
  itemSelector: '.eqt-search-panel__button',
  rowSelector: '.eqt-search-panel__cells',
  itemsSignal: () => groups.value,
})

interface TermGroupRows {
  key: string | null
  label: string
  rows: TermInfo[][]
}

const groupRows = computed<TermGroupRows[]>(() => {
  return groups.value.map(g => ({
    key: g.key,
    label: g.label,
    rows: chunkBilingual(g.terms, c => c.measureZh, c => c.measureEn),
  }))
})

function applyTermState(positive: string, next: TagState): void {
  if (next === TagState.Off) {
    emit('dismiss-terms', [positive])
  } else {
    emit('update:modelValue', setTagState(props.modelValue, [positive], next))
  }
}

function onTermClick(term: TermInfo): void {
  // editing 時 chip 只負責被拖拽，不再切態——避免「拖之前不小心點到變 Off」
  if (props.editing) return
  const next = term.state === TagState.Include ? TagState.Off : TagState.Include
  applyTermState(term.positive, next)
}

function onTermContextMenu(e: MouseEvent, term: TermInfo): void {
  e.preventDefault()
  if (props.editing) return
  const next = getNextRightClickState([term.positive], undefined, term.state)
  if (next === null) return
  applyTermState(term.positive, next)
}

// Drag-out 視覺契約跟 ghostClass 等三 class 細節跟 SearchPanel 原版一致——
// 不對 ghostClass 用 display: none（forceFallback 模式下會讓浮動 ghost rect=0×0）
const cloneDragOptions = {
  ...baseDragOptions,
  group: { name: EQT_TAGS_GROUP, pull: 'clone' as const, put: false },
  sort: false,
  ghostClass: 'eqt-search-panel__button--ghost-drag',
  chosenClass: 'eqt-search-panel__button--chosen',
  dragClass: 'eqt-search-panel__button--drag',
}

// hoist 成常數，避免 inline arrow 每次 template render 生新 function identity
const termItemKey = (term: TermInfo): string => term.positive

function cloneToButton({ literal, cloneLabel }: { literal: string; cloneLabel: string }): TagButton {
  return { kind: 'tag', tags: [literal], label: cloneLabel }
}
</script>

<template>
  <div
    ref="containerRef"
    class="eqt-search-panel-rows"
    :class="{ 'eqt-search-panel-rows--editing': editing, 'eqt-search-panel-rows--flat': flat }"
  >
    <div
      v-for="group in groupRows"
      :key="group.key ?? '__misc__'"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ group.label }}:</div>
      <div class="eqt-search-panel__cells">
        <Draggable
          v-for="(row, rowIdx) in group.rows"
          :key="rowIdx"
          v-bind="cloneDragOptions"
          tag="div"
          class="eqt-search-panel__cells-row"
          :model-value="row"
          :item-key="termItemKey"
          :clone="cloneToButton"
          :disabled="!editing"
          @start="emit('drag-start')"
          @end="emit('drag-end')"
        >
          <template #item="{ element: term }">
            <button
              class="eqt-search-panel__button"
              :class="STATE_CLASS[(term as TermInfo).state]"
              type="button"
              @click="onTermClick(term as TermInfo)"
              @contextmenu="onTermContextMenu($event, term as TermInfo)"
            >{{ group.key === MISC_KEY ? (term as TermInfo).displayFull : (term as TermInfo).displayShort }}</button>
          </template>
        </Draggable>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// .eqt-search-panel-rows 預設自帶 grid（AddTagPopup 場景：獨立工作區視窗）。
// flat 模式（SearchPanel 場景）改 display: contents，把 row 攤到 caller 的
// outer grid，namespace label 跟 history label 跨 row 共用 column 自動對齊
//
// 視覺契約 class（__row / __label / __cells / __button）保留 eqt-search-panel__*
// 前綴：跟 SearchPanel 內 history row 共用一套 CSS、修動時兩處都看到效果
.eqt-search-panel-rows {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 8px;
  row-gap: 4px;
  align-items: start;
}

.eqt-search-panel-rows--flat {
  display: contents;
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
  flex-direction: column;
  gap: 4px;
  min-height: var(--eqt-row-h);
  // grid 1fr 預設 minmax(auto, 1fr)，auto = min-content。row 是 flex-wrap: nowrap
  // 容器、min-content = 該 row 所有 item 寬度總和。沒這條的話 chunk 還沒跑或算
  // 偏小時，1fr 欄會被某一 row 的 min-content 撐到大於可用寬度，整列從 panel
  // 右邊視覺溢出。同時也是 useBilingualWrap 量 containerWidth 的取樣對象，
  // 撐爆會讓 chunk 用錯誤寬度連環誤判
  min-width: 0;
}

// JS chunk 切出的「視覺一行」：flex nowrap 強制 term 不自動換行；
// 中英切換時換行點由 chunkByMaxWidth 決定，跟容器 flex-wrap 算法解耦
.eqt-search-panel__cells-row {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
}

// term 視覺：跟 TagBar __btn 同色系（Off 灰、Include 綠、Or 黃、Exclude 紅）。
// 左右鍵切態，沒有 × 移除按鈕——term 本身就是 button，Off 變灰留在原位
.eqt-search-panel__button {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--eqt-row-h);
  padding: 0 8px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 3px;
  background: var(--eqt-bg-btn);
  color: var(--eqt-text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
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

  // 歷史 ghost term：透明度 + hint 灰色傳達「不在搜尋裡，點一下加回」。
  // padding 維持 0 8px（base 已對稱、沒 × 不用偏心）
  &--ghost {
    opacity: 0.55;
    border-color: var(--eqt-border);
    background: transparent;
    color: var(--eqt-text-hint);

    &:hover {
      opacity: 1;
      background: var(--eqt-bg-hover);
      color: var(--eqt-text-secondary);
    }
  }

  // Drag-time 視覺反饋——sortablejs 套這三個 class 期間原 chip / 漂浮 clone
  // 各自的狀態。跟 TagBar __btn--ghost / --chosen / --drag 同套視覺契約
  // （--ghost-drag 命名避開上面歷史 chip 用的 --ghost）
  &--ghost-drag {
    opacity: 0.4;
  }

  &--chosen {
    cursor: grabbing;
  }

  &--drag {
    opacity: 0.8;
  }
}

// editing 時 chip 變 grab cursor 暗示可拖入。click handler 還在，
// 只是滑鼠提示換成拖拽。grabbing 由 sortablejs 的 --chosen class 觸發
// （= 真正進入 drag 後），不用 :active（mousedown 階段就會誤觸發）
.eqt-search-panel-rows--editing .eqt-search-panel__button {
  cursor: grab;
}
</style>
