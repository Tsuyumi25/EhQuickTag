<script lang="ts">
// Module-level export：給 TagBar 之類 template ref 的 caller import 用。
// 跟 defineExpose 內的 shape 必須一致——後者用 satisfies 守住一致性
export interface SearchPanelExposed {
  dismissTerms(positives: string[]): void
}
</script>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onScopeDispose, nextTick } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import Draggable from 'vuedraggable'
import { parseTerm, serializeTerm, type Prefix } from '@/services/searchSyntax'
import { tokenize, tokenIdentity, setTagState, removeTag, buildIdentityIndex, getNextRightClickState } from '@/services/tagState'
import { nsOrder, lines } from '@/services/store'
import { loadTagDb, findEntryByNsTag } from '@/services/tagDb'
import { cacheGet, cacheSet } from '@/services/gmStorage'
import { t, isCJKLocale } from '@/composables/useI18n'
import { baseDragOptions, EQT_TAGS_GROUP } from '@/utils/drag'
import { TagState, type TagButton } from '@/types'

const props = defineProps<{
  modelValue: string
  editing?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  addToSearch: []
  search: []
  // chip drag-out 期間發給 TagBar，跟 TagBar 自己拖按鈕的 tagDragging 接同一個
  // 守衛，擋 drop 後 synthesized click 命中 TagBar 既有按鈕觸發 onConfigure
  'drag-start': []
  'drag-end': []
}>()

// TermGroup.key 是 string | null（null = 「無 namespace」/ misc 列）。typed null
// 比字串 sentinel 強：TS 強制每個 consumer 明確 handle null 分支，未來不會被
// 「e站新增名為 __misc__ 的 namespace」這種 collision 偷襲
const MISC_KEY = null
const HISTORY_KEY = 'eqt-search-history'
const HISTORY_CAP = 50
const PERSIST_DEBOUNCE_MS = 100

// term 顯示語言：預設跟 locale 走，可在 controls-row 用 toggle 按鈕 override（page-scoped）
const showCJK = ref(isCJKLocale())
function toggleLang(): void { showCJK.value = !showCJK.value }

// tagDb 載入完通知 groups computed 重算（term 從 raw 翻成 entry.name）
const dbReady = ref(false)

// === 進階搜索的核心資料模型 ===
//
// sessionTerms：page-scoped term entry 列表，array 順序 = 顯示順序。
//   每個 entry = { positive, active }，active 標記在 A 還是 O：
//     active=true   ⇒ 屬於 A（term 顯示為 stateOf(positive) 推導的 Include/Or/Exclude）
//     active=false  ⇒ 屬於 O（term 固定顯示為 Off 灰色）
//   單一資料源——A 和 O 從 sessionTerms filter 而來，沒有「兩 list 要 sync」的隱性 contract。
//   term 從 A 變 O 只改 entry.active、位置不動 ⇒ 不會跳到 list 尾巴。
//
// 集合投影（derived）：
//   A = ids(sessionTerms.filter(c => c.active))
//   O = ids(sessionTerms.filter(c => !c.active))
//   H = ids(history)
//   T = ids(tokenize(modelValue))
//
// 不變量：
//   I1 (primitive):       A = T            syncFromSearch 獨家 enforce
//   I2 (primitive):       A ∩ H = ∅        syncFromSearch reclaim H 中重回 A 的 id
//   I3 (primitive):       O ⊆ H            applyTermState Off 同 push、clearHistory 保留 O
//   I4 (by-construction): A ∩ O = ∅        entry.active 互斥 ⇒ 結構上不可能違反
//
// 衍生（UI 顯示層）：
//   visibleOff     = O                     本 session Off 過的全部顯示，方便一鍵 reactivate
//   visibleHistory = H \ O \ buttonIds     重整 O 消失 ⇒ 浮回為 H \ buttonIds
//   button 牆內容可動態變更（settings），故 H 資料層保全部、UI 層動態 filter
//
// Enforcer 對照：
//   syncFromSearch  →  I1 + I2（rebuild active 跟 T 對齊、reclaim H 中回到 A 的 id）
//   applyTermState  →  Off 分支 mutate entry.active = false + push H（守 I3）
//   clearHistory    →  H ← H ∩ ids(O)（守 I3）
//
// Dev-mode 守門：assertInvariants() 在 syncFromSearch / clearHistory 末尾各跑一次
//
// 設計關鍵：
//   - Off term 位置保留——entry.active = false 不動 array index、就在原位變灰
//   - Typing morph (j → ja)：舊 'j' entry 移除、新 'ja' entry append，
//     視覺由 v-for unmount + mount 呈現（length 不變看起來像 morph）
//   - History 只在「term 明確按 Off」時 push，原生框造成的 token 消失不污染 history
interface TermEntry { positive: string; active: boolean }
const sessionTerms = ref<TermEntry[]>([])
const history = ref<string[]>([])

async function loadHistory(): Promise<void> {
  const raw = await cacheGet(HISTORY_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) history.value = parsed.filter(x => typeof x === 'string')
  } catch { /* corrupted blob → 從空 */ }
}

// debounce 寫入 GM：連續觸發只送最後一筆，且 payload 在 flush 那刻才 stringify
// 確保寫入的是 latest snapshot 而非觸發時的 snapshot。避免快速操作導致多筆 in-flight
// 寫入順序顛倒覆蓋成舊資料
let persistTimer = 0
function schedulePersist(): void {
  clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    persistTimer = 0
    cacheSet(HISTORY_KEY, JSON.stringify(history.value))
  }, PERSIST_DEBOUNCE_MS)
}
onScopeDispose(() => {
  // unmount 前還有未 flush 的變更就 fire-and-forget 一發
  if (persistTimer) {
    clearTimeout(persistTimer)
    cacheSet(HISTORY_KEY, JSON.stringify(history.value))
  }
})

// Dev-mode invariant checker。生產環境被 bundler 整段 dead-code-elim 掉、零成本。
// I4 (A ∩ O = ∅) 由 entry.active 互斥 by-construction 保證，這裡只 check primitive 三條
function assertInvariants(): void {
  if (!import.meta.env.DEV) return
  const T = new Set(tokenize(props.modelValue).map(tokenIdentity).filter(Boolean) as string[])
  const A = new Set(
    sessionTerms.value.filter(c => c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
  )
  const H = new Set(history.value.map(tokenIdentity).filter(Boolean) as string[])

  if (A.size !== T.size || [...A].some(x => !T.has(x))) {
    console.error('[SearchPanel] I1 broken: A !== T', { A: [...A], T: [...T] })
  }
  const i2Overlap = [...A].filter(x => H.has(x))
  if (i2Overlap.length) {
    console.error('[SearchPanel] I2 broken: A ∩ H ≠ ∅', { overlap: i2Overlap })
  }
  const i3Missing: string[] = []
  for (const c of sessionTerms.value) {
    if (c.active) continue
    const id = tokenIdentity(c.positive)
    if (id && !H.has(id)) i3Missing.push(id)
  }
  if (i3Missing.length) {
    console.error('[SearchPanel] I3 broken: O ⊄ H', { missing: i3Missing })
  }
}

// 對齊 sessionTerms 跟 T：
//   - 既有 active entry 在 T 中 → 留位置、更新 positive（typing morph 自然帶過）
//   - 既有 off entry 在 T 中 → 從 off reclaim 回 active、留位置、更新 positive
//   - 既有 active entry 不在 T 中 → 移除（原生框刪掉這個 token）
//   - 既有 off entry 不在 T 中 → 保留（這正是 Off 意義）
//   - T 中沒對應 entry 的新 id → append 到尾巴（active）
//
// History push 不在這裡——原生框造成的 token 消失（typing 過渡態、backspace、
// select-delete、paste 覆寫）一律不該污染 history，否則打字每個 keystroke 都會
// push 中間態變垃圾。History 唯一觸發點是 applyTermState 的 Off 路徑。
function syncFromSearch(text: string): void {
  const newPositiveById = new Map<string, string>()
  for (const tok of tokenize(text)) {
    const id = tokenIdentity(tok)
    if (!id || newPositiveById.has(id)) continue
    newPositiveById.set(id, serializeTerm({ ...parseTerm(tok), prefix: null }))
  }

  const pendingNew = new Set(newPositiveById.keys())
  const next: TermEntry[] = []
  for (const entry of sessionTerms.value) {
    const id = tokenIdentity(entry.positive)
    if (!id) continue
    if (newPositiveById.has(id)) {
      // entry 對應的 id 還在 T → 保留位置；positive 跟 T 對齊；active=true（off 也 reclaim）
      next.push({ positive: newPositiveById.get(id)!, active: true })
      pendingNew.delete(id)
    } else if (!entry.active) {
      // off entry 不在 T → 保留（user 明確 dismiss、留位置等使用者操作）
      next.push(entry)
    }
    // 否則：active entry 不在 T → 丟（原生框移除）
  }
  // T 中剩下沒對應 entry 的 id → append 新 active entry
  for (const id of pendingNew) {
    next.push({ positive: newPositiveById.get(id)!, active: true })
  }
  sessionTerms.value = next

  // History reclaim：identity 回到 A 就從 H 移除（守 I2）。single pass：
  // O(K+H) 取代每 reclaimed id 跑一次 filter 的 O(K×H)
  const reclaimedIds = new Set(newPositiveById.keys())
  const filteredHistory = history.value.filter(p => {
    const id = tokenIdentity(p)
    return !id || !reclaimedIds.has(id)
  })
  if (filteredHistory.length !== history.value.length) {
    history.value = filteredHistory
    schedulePersist()
  }
  assertInvariants()
}

// 同步初始化要放 setup top-level：watch 只在「未來」變動觸發；不依賴任何
// async 結果，先把 sessionTerms 裝對才安全
syncFromSearch(props.modelValue)

onMounted(async () => {
  refreshContainerWidth()

  // First render 時 visible term 已經出現（containerWidth=0 走 fallback 全塞一行），
  // 從中讀 term metrics ground truth。讀完 bump 觸發 groupRows 用精準寬度重算
  refreshTermMetrics()
  measureVersion.value++

  // 字型載入完 invalidate width cache：載入前讀到的 metrics font 可能還是
  // fallback font，等 real font ready 再讀一次 + 清 cache
  if (document.fonts?.ready) {
    void document.fonts.ready.then(() => {
      refreshTermMetrics()
      widthCache.clear()
      measureVersion.value++
      void nextTick(refreshContainerWidth)
    })
  }

  // 兩個獨立的 IO 平行跑（loadHistory 讀 GM、loadTagDb 可能拉網路），冷啟動
  // dbReady 翻為 true 從 sum(兩者) 收斂到 max(兩者)
  await Promise.all([loadHistory(), loadTagDb()])
  dbReady.value = true
})

watch(() => props.modelValue, syncFromSearch)

// === term 顯示用：state、group、display 全部從 sessionTerms + identityIndex 推導 ===

const identityIndex = computed(() => buildIdentityIndex(tokenize(props.modelValue)))

interface TermInfo {
  positive: string
  state: TagState
  displayShort: string  // namespace row 用：CJK = 翻譯名稱（無 ns）、English = 原生 token literal
  displayFull: string   // misc row 用：原生 token literal（state prefix + tag + suffix）
  literal: string       // raw search-syntax token（state prefix + ns + tag + suffix），給 drag-clone 用
  cloneLabel: string    // chip 當前顯示文字（namespace row = displayShort、misc row = displayFull）
  // 量測對齊用：兩語言版本的「實際渲染文字」。
  // namespace row 取 short 對應 CJK / Latin；misc row 兩者相同（literal 不翻譯）
  measureZh: string
  measureEn: string
}

interface TermGroup {
  key: string | null    // namespace name；null = misc/無 namespace 列
  label: string
  terms: TermInfo[]
}

const STATE_CLASS: Record<TagState, string | null> = {
  [TagState.Include]: 'eqt-search-panel__button--include',
  [TagState.Or]:      'eqt-search-panel__button--or',
  [TagState.Exclude]: 'eqt-search-panel__button--exclude',
  [TagState.Off]:     null,
}

// State → prefix 的對應表。跟 STATE_CLASS 對稱；直接給 serializeTerm 用，
// 不需要 unsound cast 把 string 強塞進 Prefix union
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
  // 用 parseTerm 推 prefix，跟 codebase 其他地方一致；不依賴 normalizeNs 不動
  // prefix 位置的隱含 contract
  const prefix = parseTerm(present).prefix
  if (prefix === '-') return TagState.Exclude
  if (prefix === '~') return TagState.Or
  return TagState.Include
}

// button 牆已涵蓋的 identity 集合——visibleHistory 用它扣除重複
const buttonIdentities = computed(() => {
  const set = new Set<string>()
  for (const line of lines) {
    if (line.kind !== 'buttons') continue
    for (const btn of line.buttons) {
      if (btn.kind !== 'tag') continue
      for (const tag of btn.tags) {
        const id = tokenIdentity(tag)
        if (id) set.add(id)
      }
    }
  }
  return set
})

const groups = computed<TermGroup[]>(() => {
  void dbReady.value

  const buckets = new Map<string | null, TermInfo[]>()

  function pushTerm(positive: string, state: TagState): void {
    const parsed = parseTerm(positive)
    const groupKey: string | null = parsed.namespace ?? MISC_KEY
    const prefix = STATE_PREFIX[state]
    const prefixStr = prefix ?? ''

    // literal = 原生 search token 字面：state prefix + ns + tag + suffix。
    // 不再剝 suffix——使用者搜 'tag$' 拖出來要徹底復現「精確匹配」這個事實，
    // 不是默默 normalize 成 loose match
    const literal = serializeTerm({ ...parsed, prefix })

    // 兩語言文字無條件算出來。
    // CJK 模式 = state prefix + 翻譯名稱（無 ns 前綴、無 suffix）。
    // English 模式 = literal（原生 token 字面，包含 ns + suffix）——徹底復現原生搜尋欄
    const cjkEntry = parsed.namespace
      ? findEntryByNsTag(parsed.namespace, parsed.tag)
      : undefined
    const zhText = cjkEntry ? prefixStr + cjkEntry.name : prefixStr + parsed.tag
    const enText = literal
    const displayShort = showCJK.value ? zhText : enText
    const displayFull = literal

    // misc row 用 displayFull = literal，兩語言相等
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

  // 按 sessionTerms 順序 iterate——entry.active 決定 state 來源，位置由 array 自然維護。
  // Off entry 全部顯示（即使 button 牆已有同 identity）——本 session 內手動 Off
  // 過的 term 應該維持灰 chip 讓使用者一鍵 reactivate，不該被 button 牆「吃掉」
  for (const entry of sessionTerms.value) {
    if (entry.active) {
      pushTerm(entry.positive, stateOf(entry.positive))
    } else {
      pushTerm(entry.positive, TagState.Off)
    }
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

// === 中英 wrap 對齊：量測 + JS chunk ===
//
// 設計：每個 term 量「兩語言版本」的 offsetWidth cache 起來，分組時用
// max(w_zh, w_en) 累加模擬 flex-wrap，JS 切出 row 分組，visible layer 按該
// 分組 render（每 row flex-nowrap）。同 term 在中英切換時必定落在同一相對位置。
//
// Cache key 只用 text：canvas measureText 不受 state class 影響，padding/border
// 從 termMetrics 加上去（state class 變體目前不改 width-affecting 屬性）
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const measureVersion = ref(0)  // 字型載入完 invalidate cache 用

// 量測策略：Canvas measureText。字型字串由我們從 visible term 一次性 compose
// 出來，不依賴 DOM 繼承——徹底繞掉 sandbox 元素的 CSS 變數 / font 繼承坑
// （sandbox 路線在 body 拿不到 SearchPanel 內 CSS var、在 container 內又會
// 量得偏小 3px 導致 row 邊界 overflow，canvas 直接從 ground truth 算 0 誤差）
const canvasCtx: CanvasRenderingContext2D | null = (() => {
  if (typeof document === 'undefined') return null
  return document.createElement('canvas').getContext('2d')
})()

interface TermMetrics { font: string; padding: number; border: number }
const termMetrics = ref<TermMetrics | null>(null)

const widthCache = new Map<string, number>()
const CELLS_GAP = 4  // 跟 .eqt-search-panel__cells-row 的 gap 同步

// 從一個 visible term 讀 ground truth：font 字串（含 size/family）、horizontal
// padding、horizontal border。state class 變體不改 padding/border-width，這些
// 值對所有 term 通用（main + ghost）。讀不到時 metrics 留 null、量測返回 0、
// groupRows fallback 到「全塞一行」直到 metrics ready
function refreshTermMetrics(): void {
  if (!containerRef.value) return
  const term = containerRef.value.querySelector('.eqt-search-panel__button') as HTMLElement | null
  if (!term) return
  const cs = getComputedStyle(term)
  termMetrics.value = {
    font: cs.font,
    padding: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
    border: parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth),
  }
}

function measureTermWidth(text: string): number {
  const m = termMetrics.value
  if (!canvasCtx || !m) return 0
  canvasCtx.font = m.font
  const textW = canvasCtx.measureText(text).width
  // Math.ceil：subpixel 寬度 round up 避免累加誤差讓最後一個 term 推出容器
  return Math.ceil(textW + m.padding + m.border)
}

function getTermWidth(text: string): number {
  const cached = widthCache.get(text)
  if (cached !== undefined && cached > 0) return cached
  const w = measureTermWidth(text)
  if (w > 0) widthCache.set(text, w)
  return w
}

function chunkByMaxWidth<T>(
  items: T[],
  getMaxWidth: (item: T) => number,
  width: number,
  gap: number,
): T[][] {
  if (items.length === 0) return []
  // 容器寬度未知時不分組（單行 fallback，CSS 會處理 overflow 為 1 幀過渡態）
  if (width <= 0) return [items]
  const rows: T[][] = [[]]
  let rowWidth = 0
  for (const item of items) {
    const w = getMaxWidth(item)
    const next = rowWidth === 0 ? w : rowWidth + gap + w
    if (next > width && rowWidth > 0) {
      rows.push([item])
      rowWidth = w
    } else {
      rows[rows.length - 1].push(item)
      rowWidth = next
    }
  }
  return rows
}

// 量測 reactive trigger 集中在這個 helper：所有 chunkByMaxWidth callback
// 走這條路，metrics / fonts.ready 重設後自動讓上游 computed 重算。
// 新 callsite 漏掉 `void measureVersion.value` 不會默默 stale
function bilingualMaxWidth(zh: string, en: string): number {
  void measureVersion.value
  return Math.max(getTermWidth(zh), getTermWidth(en))
}

interface TermGroupRows {
  key: string | null
  label: string
  rows: TermInfo[][]
}

const groupRows = computed<TermGroupRows[]>(() => {
  return groups.value.map(g => ({
    key: g.key,
    label: g.label,
    rows: chunkByMaxWidth(
      g.terms,
      c => bilingualMaxWidth(c.measureZh, c.measureEn),
      containerWidth.value,
      CELLS_GAP,
    ),
  }))
})

function refreshContainerWidth(): void {
  if (!containerRef.value) return
  const firstCells = containerRef.value.querySelector('.eqt-search-panel__cells') as HTMLElement | null
  if (firstCells) containerWidth.value = firstCells.clientWidth
}

useResizeObserver(containerRef, refreshContainerWidth)

// term 從無到有時 onMounted 跑的 refreshTermMetrics 找不到 term 元素，termMetrics
// 留 null 鎖死。watch groups 在 term 列表變動後重抓——flush:'post' 確保 DOM
// commit 後跑、有 term 元素可讀。讀到就 bump 觸發 groupRows 重算
watch(groups, () => {
  if (termMetrics.value) return
  refreshTermMetrics()
  if (termMetrics.value) measureVersion.value++
}, { flush: 'post' })

// === 按鈕語意：跟 TagBar button 同套 ===
//
// term → Off：history 的唯一 push 點。Vue watch 是 deferred microtask，整個
// sync stack 跑完才觸發 syncFromSearch ⇒ 同步區內 mutation / emit 的先後順序
// 不影響 syncFromSearch 觀察結果（不需要 ordering guards）
// dismissTerms 同時是 TagBar button click toggle Off 時的 explicit dismiss
// 入口（透過 defineExpose），讓 TagBar 也走「殘留 off + push history」路徑而非
// syncFromSearch 推導路徑（後者會把 active 不在 T 的 entry 直接丟）。
// Batch 過 positives：一次 mutate + 一次 emit removeTag(所有 positives)
function dismissTerms(positives: string[]): void {
  let mutated = false
  for (const positive of positives) {
    const id = tokenIdentity(positive)
    if (!id) continue
    const entry = sessionTerms.value.find(c => tokenIdentity(c.positive) === id)
    if (!entry) continue  // 無對應 sessionTerm → no-op，不 push ghost history
    entry.active = false
    // history 跟 sessionTerms 都以 canonical positive form 存（strip prefix，
    // 保 suffix，保 namespace 原形）。entry.positive 已是 syncFromSearch normalize
    // 過的 canonical，直接借用——caller 傳入的 raw form（含 prefix / alias / suffix）
    // 不該洩漏進 history。dedup 跨 form 用 tokenIdentity 比對
    const dupIdx = history.value.findIndex(p => tokenIdentity(p) === id)
    if (dupIdx >= 0) history.value.splice(dupIdx, 1)
    history.value.unshift(entry.positive)
    mutated = true
  }
  if (mutated) {
    trimHistory()
    schedulePersist()
  }
  // 不在這守 assertInvariants：emit 後 props.modelValue 還沒同步更新
  // （Vue prop 更新是 microtask），當下 T 是舊值、A 是新值 ⇒ I1 假陽性。
  // emit → watch → syncFromSearch 結尾的 assertInvariants 會處理整個 cycle
  emit('update:modelValue', removeTag(props.modelValue, positives))
}

// HISTORY_CAP 守門帶 I3 保護：sessionTerms 內 Off entry 對應的 H 條目永遠保留。
// 純 `history.length = HISTORY_CAP` 會把舊條目擠掉，若擠掉的是 Off entry 對應
// 的 H 條目，I3 (O ⊆ H) 破裂——使用者會看到「孤兒灰按鈕」（sessionTerms 內仍有
// Off entry 但 H 沒對應條目，clearHistory 也救不回來）。
//
// 邊界情況：Off entry 數量 > HISTORY_CAP 時，protected 全保留會超過 cap。
// 此時 invariant 優先於 cap（cap 只是 UI hint，invariant 是核心契約）。
function trimHistory(): void {
  if (history.value.length <= HISTORY_CAP) return
  const offIds = new Set(
    sessionTerms.value.filter(c => !c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
  )
  if (offIds.size === 0) {
    history.value.length = HISTORY_CAP
    return
  }
  const result: string[] = []
  let unprotectedSlots = Math.max(0, HISTORY_CAP - offIds.size)
  for (const p of history.value) {
    const id = tokenIdentity(p)
    if (id && offIds.has(id)) {
      result.push(p)  // protected, 一律保留
    } else if (unprotectedSlots > 0) {
      result.push(p)
      unprotectedSlots--
    }
  }
  history.value = result
}

function applyTermState(positive: string, next: TagState): void {
  if (next === TagState.Off) {
    dismissTerms([positive])
  } else {
    emit('update:modelValue', setTagState(props.modelValue, [positive], next))
  }
}

defineExpose({ dismissTerms } satisfies SearchPanelExposed)

function onTermClick(term: TermInfo): void {
  // editing 時 chip 只負責被拖拽，不再切態——避免「拖之前不小心點到變 Off」
  // 的 UX 雷區。click handler 還掛著是要讓 sortablejs 的 mousedown/mouseup
  // 鏈走完，cursor 也維持 grab（暗示拖拽是唯一可用互動）
  if (props.editing) return
  // 跟 TagBar.onLeftClick 同邏輯：Include → Off，其他態 → Include
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

// history chip click = 把 term 加回搜尋，editing 時同樣鎖住，只剩拖拽路徑
function onHistoryClick(positive: string): void {
  if (props.editing) return
  onRestoreHistory(positive)
}

// history Draggable @change：拖拽完成 (drop 成功) 時 sortablejs 已經把 source
// DOM 搬走、emit removed 事件帶 source item (HistoryTerm)。同步把 entry 從
// history.value 剔掉並 persist，讓資料層跟視覺對齊。drop 取消（拖到空白處放
// 開）sortablejs 自動 revert source、不會發 removed，這條路徑天然不會誤刪
function onHistoryChange(evt: { removed?: { element: HistoryTerm } }): void {
  if (!evt.removed) return
  const positive = evt.removed.element.positive
  const id = tokenIdentity(positive)
  if (!id) return
  const idx = history.value.findIndex(p => tokenIdentity(p) === id)
  if (idx >= 0) {
    history.value.splice(idx, 1)
    schedulePersist()
  }
}

function onAddClick(): void { emit('addToSearch') }
function onSearchClick(): void { emit('search') }

// === Drag-out to TagBar：chip clone 成 TagButton ===
//
// 規則（cc80078 那串 commit 後對齊的 UX 契約）：
//   - TagBar editing 時 chip 才可拖（disabled prop 自 TagBar 下傳）
//   - 拖出 = clone，原 chip 不動（sortablejs pull: 'clone'）
//   - TagBar → SearchPanel 拒收（put: false），SearchPanel 純當 source
//   - 拖出物 = TagButton {tags: [chip 對應的 raw search token literal], label: 當前 chip 顯示文字}
//     - 「徹底復現原生搜索欄」契約：原生搜索欄寫什麼 token，拖出來的 button
//       tags 就存什麼。state prefix (~/-) + syntax suffix ($/*) + ns 一律保留
//     - label = chip 當下視覺文字（CJK / English 跟著 showCJK 拍快照）
//
// sort: false：source 端 chunked row 順序由我們的 JS chunk 算，不讓
// sortablejs 重排內部位置（會破 cells-row layout）
//
// ghostClass / chosenClass / dragClass：sortablejs 預設套 sortable-ghost
// 等三個 class，codebase 沒對應 style ⇒ 拖拽時原位 chip 完全沒視覺反饋。
// 用 SearchPanel 自家 namespace 的 modifier 跟 TagBar __btn--ghost 同視覺契約
const cloneDragOptions = {
  ...baseDragOptions,
  group: { name: EQT_TAGS_GROUP, pull: 'clone' as const, put: false },
  sort: false,
  ghostClass: 'eqt-search-panel__button--ghost-drag',
  chosenClass: 'eqt-search-panel__button--chosen',
  dragClass: 'eqt-search-panel__button--drag',
}

// History chip 走 move 語意（跟 TagBar 內部按鈕重排同一條路徑）——sortablejs
// 把 source DOM 整顆搬走、原位真的不見，跟 namespace chip 的 clone 視覺自然
// 區分。drop 成功時 @change 接 removed 事件、同步把 entry 從 history.value 剔掉、
// schedulePersist。drop 取消（拖到空白處放開）sortablejs 自動 revert source、
// 也不會發 removed，history.value 不動
//
// 視覺三 class 沿用同一套——跟 TagBar 內部 drag 對齊「正常拖拽」觀感。
// 不要對 ghostClass 用 display: none：sortablejs forceFallback 模式下浮動
// ghostEl 是 dragEl.cloneNode 出來的，在 cloneNode 之前 ghostClass 已套到
// dragEl，display:none 讓 dragEl rect=0×0 → ghostEl 跟著拿到 width:0 → 連
// 跟著游標的浮動 ghost 都看不見
const moveDragOptions = {
  ...baseDragOptions,
  group: { name: EQT_TAGS_GROUP, pull: true, put: false },
  sort: false,
  ghostClass: 'eqt-search-panel__button--ghost-drag',
  chosenClass: 'eqt-search-panel__button--chosen',
  dragClass: 'eqt-search-panel__button--drag',
}

// 跟 :item-key 綁的 callback：hoist 成 module-scope 常數，避免 inline arrow
// 每次 template render 生新 function identity ⇒ vuedraggable 的 getKey computed
// 看 itemKey 變 ⇒ 每 render 重跑 computeNodes
const termItemKey = (t: TermInfo): string => t.positive
const historyItemKey = (t: HistoryTerm): string => t.positive

// 兩種 chip source 共用 clone fn——source 已經把 literal + cloneLabel 算好
// （pushTerm / historyEntryTexts 階段），這裡只負責包成 TagButton
function cloneToButton({ literal, cloneLabel }: { literal: string; cloneLabel: string }): TagButton {
  return { kind: 'tag', tags: [literal], label: cloneLabel }
}

// 清空搜尋框：跟 dismissTerms 同一條路徑（mutate active entry 為 off + push
// history + emit），差別只在 emit 內容——dismissTerms 走 removeTag 保留非
// token 內容、這裡直接 emit '' 連無法 parse 的垃圾文字一併清掉。
//
// 不能只 emit ''：syncFromSearch 看 T=∅ 會走 I1 (A=T) 把所有 active entry
// 從推導路徑丟掉，term 直接消失不進 history。先 in-place 把 entry.active 標
// false ⇒ syncFromSearch 走「!entry.active 保留」分支殘留成灰 chip。
// 順序保證：Vue prop 更新是 microtask、整個 sync stack 跑完才觸發 watch
function onClearSearchClick(): void {
  let mutated = false
  for (const entry of sessionTerms.value) {
    if (!entry.active) continue
    const id = tokenIdentity(entry.positive)
    if (!id) continue
    entry.active = false
    const dupIdx = history.value.findIndex(p => tokenIdentity(p) === id)
    if (dupIdx >= 0) history.value.splice(dupIdx, 1)
    history.value.unshift(entry.positive)
    mutated = true
  }
  if (mutated) {
    trimHistory()
    schedulePersist()
  }
  emit('update:modelValue', '')
}

// sessionTerms 的 identity 集合——抽 computed 後 history 變動不會 rebuild 這個 set
// （只在 sessionTerms 變動時重算），visibleHistory 純走 cached lookup
const sessionIdentitySet = computed(() => {
  const s = new Set<string>()
  for (const entry of sessionTerms.value) {
    const id = tokenIdentity(entry.positive)
    if (id) s.add(id)
  }
  return s
})

// 歷史 row 顯示用：去掉 sessionTerms 內身份（不論 active 或 off）跟 button 牆身份
const visibleHistory = computed(() => {
  return history.value.filter(p => {
    const id = tokenIdentity(p)
    if (!id) return false
    if (sessionIdentitySet.value.has(id)) return false
    if (buttonIdentities.value.has(id)) return false
    return true
  })
})

function onRestoreHistory(positive: string): void {
  // history 存的就是 positive，直接 setTagState Include
  emit('update:modelValue', setTagState(props.modelValue, [positive], TagState.Include))
}

// 只清 H \ O（visible history row 顯示的部分），保留 O 對應的條目。
// 不變量 O ⊆ H 在 clearHistory 後仍成立——「清歷史」語意 = 清掉沒被 O 標記的
// 歷史條目，被使用者明確點 Off 的灰 term 對應的 history 條目留著（重整後 O
// 自然消失、那些條目就會浮上 visible history）。
function clearHistory(): void {
  const offIds = new Set(
    sessionTerms.value.filter(c => !c.active).map(c => tokenIdentity(c.positive)).filter(Boolean) as string[]
  )
  history.value = history.value.filter(p => {
    const id = tokenIdentity(p)
    return !!id && offIds.has(id)
  })
  schedulePersist()
  assertInvariants()
}

// 解析 history positive → 兩語言版本（display 跟著 showCJK 切換）。
// 無條件算兩種文字：display 給 v-render，zh/en 給 chunkByMaxWidth 量測對齊
//
// English 模式 = literal（保 suffix）徹底復現原生搜索欄字面。
// CJK 模式 = `ns_label:cjk_name`（無 suffix）給 CJK 使用者讀的友善形式。
// literal 額外存著給 drag-clone 用
function historyEntryTexts(positive: string): { display: string; zh: string; en: string; literal: string } {
  const parsed = parseTerm(positive)
  if (parsed.parseError) return { display: positive, zh: positive, en: positive, literal: positive }
  // history positive 是 canonical 形（dismissTerms 推進來時 prefix 已剝）。
  // Off state 沒 prefix，literal 直接 = positive
  const literal = positive
  if (!parsed.namespace) {
    return { display: literal, zh: literal, en: literal, literal }
  }
  const cjkEntry = findEntryByNsTag(parsed.namespace, parsed.tag)
  const enText = literal
  const zhText = cjkEntry
    ? `${t(`ns.${parsed.namespace}`)}:${cjkEntry.name}`
    : enText
  const display = showCJK.value ? zhText : enText
  return {
    display,
    zh: zhText,
    en: enText,
    literal,
  }
}

interface HistoryTerm { positive: string; display: string; zh: string; en: string; literal: string; cloneLabel: string }

// computed memoize history display——visibleHistory / showCJK 不變就直接拿快取，
// 不在 v-for 內逐項重跑 parseTerm + findEntryByNsTag。
// 跟 da4ae79（identityIndex 從 N 顆按鈕收成 1 張共用 Map）同形式
//
// dbReady 依賴：tagDb 未載入時 findEntryByNsTag 回 undefined → historyEntryTexts
// fallback 到英文。dbReady 翻 true 後要重算才能切到 CJK 翻譯，不然要使用者點
// 兩次 toggle 才會變中文（第一次切走、第二次切回時 tagDb 已載入）
const historyDisplays = computed<HistoryTerm[]>(() => {
  void dbReady.value
  return visibleHistory.value.map(positive => {
    const texts = historyEntryTexts(positive)
    // history chip 沒有 misc / namespace 之分，cloneLabel 跟 display 同源
    return { positive, ...texts, cloneLabel: texts.display }
  })
})

const historyRows = computed<HistoryTerm[][]>(() => {
  return chunkByMaxWidth(
    historyDisplays.value,
    c => bilingualMaxWidth(c.zh, c.en),
    containerWidth.value,
    CELLS_GAP,
  )
})
</script>

<template>
  <div
    ref="containerRef"
    class="eqt-search-panel"
    :class="{ 'eqt-search-panel--editing': editing }"
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

    <div
      v-if="historyDisplays.length"
      class="eqt-search-panel__row"
    >
      <div class="eqt-search-panel__label">{{ t('tagbar.history') }}:</div>
      <div class="eqt-search-panel__cells">
        <Draggable
          v-for="(row, rowIdx) in historyRows"
          :key="rowIdx"
          v-bind="moveDragOptions"
          tag="div"
          class="eqt-search-panel__cells-row"
          :model-value="row"
          :item-key="historyItemKey"
          :clone="cloneToButton"
          :disabled="!editing"
          @start="emit('drag-start')"
          @end="emit('drag-end')"
          @change="onHistoryChange"
        >
          <template #item="{ element: item }">
            <button
              class="eqt-search-panel__button eqt-search-panel__button--ghost"
              type="button"
              @click="onHistoryClick((item as HistoryTerm).positive)"
            >{{ (item as HistoryTerm).display }}</button>
          </template>
        </Draggable>
      </div>
    </div>

    <div class="eqt-search-panel__controls-row">
      <div class="eqt-search-panel__controls-group">
        <button
          class="eqt-search-panel__lang-toggle"
          type="button"
          :title="t('tagbar.toggleLang')"
          @click="toggleLang"
        ><span :class="{ 'eqt-search-panel__lang-hidden': !showCJK }">中文</span><span :class="{ 'eqt-search-panel__lang-hidden': showCJK }">EN</span></button>
        <button
          class="eqt-search-panel__text-btn"
          type="button"
          @click="clearHistory"
        >{{ t('tagbar.clearHistory') }}</button>
      </div>
      <div class="eqt-search-panel__controls-group">
        <button
          class="eqt-search-panel__text-btn"
          type="button"
          @click="onClearSearchClick"
        >{{ t('tagbar.clearSearch') }}</button>
        <button
          class="eqt-search-panel__text-btn"
          type="button"
          @click="onSearchClick"
        >{{ t('tagbar.search') }}</button>
        <button
          class="eqt-search-panel__add"
          type="button"
          :title="t('tagbar.addTag')"
          @click="onAddClick"
        >+</button>
      </div>
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
  flex-direction: column;
  gap: 4px;
  min-height: var(--eqt-row-h);
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

// TagBar editing 時 chip 變 grab cursor 暗示可拖入。click handler 還在，
// 只是滑鼠提示換成拖拽。grabbing 由 sortablejs 的 --chosen class 觸發
// （= 真正進入 drag 後），不用 :active（mousedown 階段就會誤觸發）
.eqt-search-panel--editing .eqt-search-panel__button {
  cursor: grab;
}

// 工具列：左群組（lang toggle + clear history）／右群組（clear search + search + 新增）
.eqt-search-panel__controls-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.eqt-search-panel__controls-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.eqt-search-panel__lang-toggle {
  display: inline-grid;
  align-items: center;
  justify-items: center;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: var(--eqt-transition-base);

  > span {
    grid-area: 1 / 1;
  }

  &:hover {
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}

.eqt-search-panel__lang-hidden {
  visibility: hidden;
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
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}

// 文字按鈕：跟 __add / __lang-toggle 同高，寬度跟著文字 + 水平 padding。
// 跟 __lang-toggle 統一 font-size 12px，視覺上是同一組控制項
.eqt-search-panel__text-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 10px;
  border: var(--eqt-border-width) solid var(--eqt-border);
  border-radius: 4px;
  background: transparent;
  color: var(--eqt-text-hint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  transition: var(--eqt-transition-base);

  &:hover {
    color: var(--eqt-text-secondary);
    background: var(--eqt-bg-hover);
  }
}
</style>
