<script setup lang="ts">
// Gallery 詳情頁的 taglist 接管：
//   - 統一 selection Map<nsRaw, 'positive' | 'negative'>，state ∈ {1, 0, -1}（後者
//     用 undefined 代表）。對齊 vote 的心智模型：左鍵 +1、右鍵 −1，clamp 到 [-1, 1]
//   - selection 跟 action 解耦——同一份選擇可以送 search（positive=include /
//     negative=exclude）也可以送 vote (positive=+1 / negative=−1)
//   - drag select 走 cohort 模型：drag 只影響跟起點同態的 chip。起點 + drag 方向
//     決定 cohort 跟 transition：起點 0 + 左 = 把 0 推 1、起點 1 + 右 = 把 1 推 0
//     (cancel)、起點 -1 + 左 = 把 -1 推 0 (cancel)，依此類推
//   - 任何選取動作都 setPanelTag(chip.tag)：對 x tag 的任何操作都繼續顯示定義，
//     直到 selection 全空才 auto close panel
import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { GM } from '$'
import { serializeEntry } from '@/services/search/searchSyntax'
import { findEntryByNsTag, DEFAULT_NS_ORDER, tagDbVersion } from '@/services/tags/tagDb'
import { nsFormat, defaultExactMatch, galleryDragSelectEnabled, galleryMyTagsColorsEnabled, galleryMyTagsScoresEnabled, galleryMyTagsMarksEnabled, galleryDblClickLeft, galleryDblClickRight, galleryDblClickLeftNewTabActive, galleryDblClickRightNewTabActive, galleryTaglistZoom, type GalleryDblClickAction } from '@/services/store'
import { loadMyTagsPalette, type MyTagsPalette } from '@/services/mytags/mytagsPalette'
import { pickUrl, savePick } from '@/services/mytags/mytagsPicks'
import { bestTier, evidenceOf, parseGalleryUrl, withImport, type Imports } from '@/services/gallery/galleryImport'
import { fetchGallery } from '@/composables/useEhGalleryPreview'
import { openSettings } from '@/services/appOverlays'
import { useDisplayConfig } from '@/composables/useDisplayConfig'
import { t, isZhLocale, locale } from '@/composables/useI18n'
import { batchVote, type VoteState } from '@/services/gallery/galleryVote'
import { useEqtToast } from '@/composables/useEqtToast'
import { useEhGalleryHost, parseTaglistRoot, type GalleryTag } from '@/composables/useEhGalleryHost'
import { useIntroPanel } from '@/composables/useIntroPanel'
import { Settings, Search, BookOpen, Tags, TagPlus, SquareArrowRightEnter, CornerLeftUp, CircleCheck, CircleDashedCheck } from '@lucide/vue'
import { useDragSelect } from '@/composables/useDragSelect'
import type { ChipRef, TriState, Selection } from '@/services/gallery/dragSelectMachine'
import GalleryAddInline from './GalleryAddInline.vue'
import { CircleDottedCheck } from './circleDottedCheck'
import GalleryIntroPanel from './GalleryIntroPanel.vue'
import TagChip from '@/components/TagChip.vue'
import type { TagEntry } from '@/services/tags/tagDb'

type TagTier = 'gt' | 'gtl' | 'gtw'

const host = useEhGalleryHost()!

const toast = useEqtToast()

const myTagsPalette = shallowRef<MyTagsPalette | null>(null)
onMounted(async () => {
  try {
    myTagsPalette.value = await loadMyTagsPalette()
  } catch {
    toast.error(t('gallery.myTagsColorsFailed'))
  }
})

const currentTags = ref<GalleryTag[]>([...host.tags])
const userVotes = ref<Record<string, VoteState>>({})

function syncUserVotesFromTags(): void {
  const v: Record<string, VoteState> = {}
  for (const tag of currentTags.value) {
    if (/\btup\b/.test(tag.voteClass)) v[tag.nsRaw] = 'up'
    else if (/\btdn\b/.test(tag.voteClass)) v[tag.nsRaw] = 'down'
    else v[tag.nsRaw] = null
  }
  userVotes.value = v
}
syncUserVotesFromTags()

function tierOf(cls: string): TagTier {
  if (/\bgtw\b/.test(cls)) return 'gtw'
  if (/\bgtl\b/.test(cls)) return 'gtl'
  return 'gt'
}

let taglistObserver: MutationObserver | null = null
onMounted(() => {
  taglistObserver = new MutationObserver(() => {
    // batch vote 期間 skip：dispatchBatch 第一封 (ups) 回來會寫入 tagpaneHtml
    // 觸發 mutation，此時 syncUserVotesFromTags 會把第二封 (downs) 的 optimistic
    // 狀態抹掉，造成 UI 短暫閃爍。batch 結束後 finally 會手動補一次 sync
    if (votePending.value) return
    currentTags.value = parseTaglistRoot(host.taglistEl)
    syncUserVotesFromTags()
  })
  taglistObserver.observe(host.taglistEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  })
})
onBeforeUnmount(() => {
  taglistObserver?.disconnect()
})

const { zhDisplay } = useDisplayConfig()
const { setPanelTag, close: closePanel } = useIntroPanel()

const selection = ref<Map<string, Selection>>(new Map())

// 候選：還不在這本 taglist 上、使用者想投上去的標籤。來源有兩種——picker 手動新增的
// （addedTags），和從別本圖庫導入、這本還沒有的（imports）。候選照 ns 分類，各自一列
// 緊接在同 ns 的真標籤底下，列首和 chip 開頭掛來源記號跟真的標籤區分。
// off 不消失，跟 SearchPanel session terms 同行為；右鍵不能 negative（add 跟 exclude
// 在語意上無關、vote 為本位）
const addedTags = ref<GalleryTag[]>([])
const showAddPopup = ref(false)

// 導入不替使用者選任何一顆。這本已經有的標籤不重複列出，改在 chip 開頭掛佐證記號：
// 別本是實線 / 虛線，就是這個標籤在別處站得住腳的程度；這本已經是實線的就不必了
const imports = shallowRef<Imports>(new Map())
const importOpen = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const importUrl = ref('')
const importBusy = ref(false)

const currentNsRaws = computed(() => new Set(currentTags.value.map(t => t.nsRaw)))

// tagid=0 placeholder：batchVote 只用 nsRaw、native vote() 路徑不會走到候選 chip
function candidateTag(nsRaw: string, tierClass = 'gt'): GalleryTag {
  const colon = nsRaw.indexOf(':')
  return {
    tagid: 0,
    ns: colon > 0 ? nsRaw.slice(0, colon) : '',
    raw: colon > 0 ? nsRaw.slice(colon + 1) : nsRaw,
    nsRaw,
    tierClass,
    voteClass: '',
  }
}

/**
 * 不在原 taglist 上的候選，每個 nsRaw 一份。導入的照別本最穩的線型畫 chip 邊框，
 * 點線也照畫；手動新增的沒有來源可參考，用預設的實線
 */
const candidates = computed<GalleryTag[]>(() => {
  const out = new Map<string, GalleryTag>()
  for (const [nsRaw, sources] of imports.value) {
    if (currentNsRaws.value.has(nsRaw)) continue
    out.set(nsRaw, candidateTag(nsRaw, bestTier(sources)))
  }
  for (const tag of addedTags.value) {
    if (!currentNsRaws.value.has(tag.nsRaw) && !out.has(tag.nsRaw)) out.set(tag.nsRaw, tag)
  }
  return [...out.values()]
})

/** 原 taglist + 候選，每個 nsRaw 一份。送出、查詢都走這份 */
const allTags = computed(() => [...currentTags.value, ...candidates.value])

interface ChipView {
  tag: GalleryTag
  token: string
  display: string
  selected: Selection | undefined
  tier: TagTier
  iconUrl?: string
  personalTag?: MyTagsPalette[string]
  /** 候選從哪來：picker 手動新增的掛 tag-plus，別本導入的掛 square-arrow-right-enter */
  candidate: 'added' | 'imported' | null
  /** 導入給這個已有標籤的佐證；候選和本來就是實線的不掛 */
  evidence: 'solid' | 'dashed' | 'dotted' | null
  /** 開頭記號的 hover 說明：從哪幾本帶進來 */
  sources: string
}

interface ChipGroup {
  key: string
  /** 空字串代表緊接在同 ns 的真標籤列底下：ns 欄改畫 corner-left-up 指回上一列 */
  label: string
  candidate: boolean
  chips: ChipView[]
}

function buildChipView(tag: GalleryTag, isCandidate: boolean): ChipView {
  const token = serializeEntry(
    { ns: tag.ns, raw: tag.raw },
    { nsFormat: nsFormat.value, exactMatch: defaultExactMatch.value },
  )
  const entry = findEntryByNsTag(tag.ns, tag.raw)
  const sources = imports.value.get(tag.nsRaw) ?? []
  return {
    tag,
    token,
    display: isZhLocale() && entry ? zhDisplay(entry.name) : tag.raw,
    selected: selection.value.get(tag.nsRaw),
    tier: tierOf(tag.tierClass),
    iconUrl: entry?.iconUrl,
    personalTag: myTagsPalette.value?.[tag.nsRaw],
    candidate: !isCandidate ? null : imports.value.has(tag.nsRaw) ? 'imported' : 'added',
    // 這本已經是實線的標籤，別本再怎麼佐證也不會更穩
    evidence: isCandidate || tierOf(tag.tierClass) === 'gt' ? null : evidenceOf(sources),
    sources: sources.map(s => s.title).join('\n'),
  }
}

// 每個 ns 先一列真標籤，候選緊接一列在它底下；這本沒有的 ns 只有候選列，照預設順序
// 接在後面，未知的殿後
const groups = computed<ChipGroup[]>(() => {
  void tagDbVersion.value

  const real = new Map<string, ChipView[]>()
  for (const tag of currentTags.value) {
    if (!real.has(tag.ns)) real.set(tag.ns, [])
    real.get(tag.ns)!.push(buildChipView(tag, false))
  }
  const pending = new Map<string, ChipView[]>()
  for (const tag of candidates.value) {
    if (!pending.has(tag.ns)) pending.set(tag.ns, [])
    pending.get(tag.ns)!.push(buildChipView(tag, true))
  }
  const order = [
    ...real.keys(),
    ...[...pending.keys()].filter(ns => !real.has(ns)).sort((a, b) => nsRank(a) - nsRank(b)),
  ]

  const knownNs = new Set(DEFAULT_NS_ORDER)
  const result: ChipGroup[] = []
  for (const ns of order) {
    const label = knownNs.has(ns) ? t(`ns.${ns}`) : ns
    const chips = real.get(ns)
    if (chips) result.push({ key: ns, label, candidate: false, chips })
    const extra = pending.get(ns)
    if (extra) result.push({ key: `${ns}__candidates`, label: chips ? '' : label, candidate: true, chips: extra })
  }
  return result
})

function nsRank(ns: string): number {
  const at = DEFAULT_NS_ORDER.indexOf(ns)
  return at < 0 ? DEFAULT_NS_ORDER.length : at
}

const positiveCount = computed(() =>
  [...selection.value.values()].filter(v => v === 'positive').length)
const negativeCount = computed(() =>
  [...selection.value.values()].filter(v => v === 'negative').length)
const selectedCount = computed(() => selection.value.size)

const votePending = ref(false)

// === selection update ===
// vote-style 3-state: 1/0/-1（positive / off / negative）。
// target 是「按鍵方向」：左鍵 = +1、右鍵 = −1。當前狀態 + delta 後 clamp 到 [-1, 1]：
//   off + 左 = positive；positive + 左 = positive（已上限）；negative + 左 = off
//   off + 右 = negative；negative + 右 = negative（已下限）；positive + 右 = off
//
// 「新增」row 的 chip min 抬高到 0（不能 -1）——add 跟 exclude 在語意上無關
function setSelection(nsRaw: string, target: Selection): void {
  const cur = selection.value.get(nsRaw)
  const curN = cur === 'positive' ? 1 : cur === 'negative' ? -1 : 0
  const delta = target === 'positive' ? 1 : -1
  // 只有這本已經有的標籤能投反對；純候選 add 跟 exclude 在語意上無關
  const min = currentNsRaws.value.has(nsRaw) ? -1 : 0
  const nextN = Math.max(min, Math.min(1, curN + delta))
  if (nextN === curN) return

  const next = new Map(selection.value)
  if (nextN === 0) next.delete(nsRaw)
  else next.set(nsRaw, nextN === 1 ? 'positive' : 'negative')
  selection.value = next
}

// === GalleryAddInline picker 對接 ===
// pickedIds：popup 用來標亮已選 entry（fullTag 比對）。包含原 taglist 跟
// 候選內已 positive 的條目，這樣 dedup 後使用者看得到「已加過了」
const pickedIds = computed<ReadonlySet<string>>(() => {
  const ids = new Set<string>()
  for (const tag of allTags.value) {
    if (selection.value.get(tag.nsRaw) === 'positive') ids.add(tag.nsRaw)
  }
  return ids
})

function onPickFromAdd(entry: TagEntry, mode: 'positive' | 'negative'): void {
  // dedup：先看是不是已在原 taglist 或候選；若是直接改原 chip，不重複加進 addedTags
  const tag = allTags.value.find(t => t.nsRaw === entry.fullTag)

  if (tag) {
    // 面板要在任何 click 都刷到當前 tag：即使 selection 沒變（已 positive 再左鍵、
    // off 上右鍵）使用者仍然是「在看這個 tag」，面板該同步過去
    setPanelTag(tag)
    // 左鍵 (+1)：cur ∈ {off, negative} → positive；cur = positive → no-op (cap=1)
    // 右鍵 (-1)：cur = positive → off；cur ∈ {off, negative} → no-op (picker min=0)
    const cur = selection.value.get(tag.nsRaw)
    if (mode === 'positive') {
      if (cur === 'positive') return
      const next = new Map(selection.value)
      next.set(tag.nsRaw, 'positive')
      selection.value = next
    } else {
      if (cur !== 'positive') return
      const next = new Map(selection.value)
      next.delete(tag.nsRaw)
      selection.value = next
    }
    return
  }

  // 全新 entry：只有左鍵 (+1) 才 push 進 addedTags；右鍵 (-1) 對 off 起點 = 0→-1 禁止
  if (mode !== 'positive') return

  const newAdded = candidateTag(entry.fullTag)
  addedTags.value = [...addedTags.value, newAdded]
  const next = new Map(selection.value)
  next.set(newAdded.nsRaw, 'positive')
  selection.value = next
  setPanelTag(newAdded)
}

async function toggleImport(): Promise<void> {
  importOpen.value = !importOpen.value
  if (!importOpen.value) return
  await nextTick()
  importInput.value?.focus()
}

async function importFrom(input: string): Promise<void> {
  const target = parseGalleryUrl(input)
  if (!target || importBusy.value) return
  importBusy.value = true
  // 網址是哪個站都只取 gid / token、抓目前這個站：跨站 fetch 會被 CORS 擋，而同一本在
  // 兩站的 gid、token 和 taglist 是同一份。只在 exhentai 上的本子從 e-hentai 抓不到，
  // 會落到下面的失敗提示
  const detail = await fetchGallery(target.gid, target.token)
  importBusy.value = false
  if (!detail) {
    toast.error(t('gallery.importFailed'))
    return
  }
  imports.value = withImport(imports.value, detail)
  importUrl.value = ''
}

// drag-select 狀態機跟 click 路徑封裝在 useDragSelect，邏輯放在
// services/gallery/dragSelectMachine.ts（pure reducer + property test）。
// 這裡只負責把 DOM hit-test 跟業務動作注入
function chipFromPoint(x: number, y: number): ChipRef | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const chipEl = el?.closest<HTMLElement>('.eqt-gallery-chip')
  if (!chipEl) return null
  const nsRaw = chipEl.dataset.nsRaw
  if (!nsRaw) return null
  const s = selection.value.get(nsRaw)
  const state: TriState = s === 'positive' ? 1 : s === 'negative' ? -1 : 0
  return { id: nsRaw, state }
}

function applySelectionById(nsRaw: string, mode: Selection): void {
  setSelection(nsRaw, mode)
}

function setPanelTagById(nsRaw: string): void {
  const tag = allTags.value.find(t => t.nsRaw === nsRaw)
  if (tag) setPanelTag(tag)
}

const { onAreaMouseDown } = useDragSelect({
  chipFromPoint,
  applySelection: applySelectionById,
  setPanelTag: setPanelTagById,
  enabled: () => galleryDragSelectEnabled.value,
})

// Gallery Tagging guide：中文 locale 走 /Chinese 分頁、韓文走 /Korean、其他走英文 root
// （ehwiki 沒有 /Japanese，所以日文也落英文 root）
const wikiUrl = computed(() => {
  if (isZhLocale()) return 'https://ehwiki.org/wiki/Gallery_Tagging/Chinese'
  if (locale.value === 'ko') return 'https://ehwiki.org/wiki/Gallery_Tagging/Korean'
  return 'https://ehwiki.org/wiki/Gallery_Tagging'
})

// === Taglist 背景雙擊 action ===
// 跟 TagBar / SearchPopup 同 pattern：@dblclick 走左鍵；右鍵沒有原生 dblclick
// event，靠 contextmenu 500ms threshold 手動偵測
let lastRightClickTime = 0

// 排除 chip（保留 single-click cycle）跟 ns label（純視覺元素、不該當 target）
function isInteractiveTaglist(e: MouseEvent): boolean {
  return !!(e.target as HTMLElement).closest('.eqt-gallery-chip, .eqt-gallery-taglist__label')
}

function onTaglistDblClick(e: MouseEvent): void {
  if (isInteractiveTaglist(e)) return
  e.preventDefault()
  window.getSelection()?.removeAllRanges()
  execGalleryDblClickAction(galleryDblClickLeft.value, galleryDblClickLeftNewTabActive.value)
}

function onTaglistContextMenu(e: MouseEvent): void {
  // preventDefault 一律呼叫——gallery 對 chip 右鍵已有「negative select via drag
  // machine」的設計，browser context menu 該全域擋掉才不會跟變紅的 chip 打架
  // （跟原本 @contextmenu.prevent 同語意；不採 TagBar / SearchPopup 的 guard-first
  // pattern，那兩個場景沒有 chip right-click 的既有語意）
  e.preventDefault()
  if (isInteractiveTaglist(e)) return
  const now = Date.now()
  if (now - lastRightClickTime < 500) {
    execGalleryDblClickAction(galleryDblClickRight.value, galleryDblClickRightNewTabActive.value)
    lastRightClickTime = 0
  } else {
    lastRightClickTime = now
  }
}

function execGalleryDblClickAction(action: GalleryDblClickAction, newTabActive: boolean): void {
  switch (action) {
    case 'none': return
    case 'search': onSearchCurrent(); return
    case 'searchNewTab': doSearchNewTab(newTabActive); return
    case 'vote': onSendBatchVotes(); return
    case 'clearSelection': onClearSelection(); return
    case 'openAdd': showAddPopup.value = !showAddPopup.value; return
  }
}

// 拆兩個 function（不用 mode 參數）避免 template `@click="onSearchNewTab"`
// 意外把 MouseEvent 當 mode 傳進來——沒 arg 的 caller 也不會踩到預設值不 kick in 的坑
function buildSearchUrl(): string | null {
  if (selectedCount.value === 0) return null
  const tokens: string[] = []
  for (const group of groups.value) {
    for (const chip of group.chips) {
      if (chip.selected === 'positive') tokens.push(chip.token)
      else if (chip.selected === 'negative') tokens.push(`-${chip.token}`)
    }
  }
  const url = new URL('/', window.location.href)
  url.searchParams.set('f_search', tokens.join(' '))
  return url.href
}

function doSearchNewTab(activate: boolean): void {
  const href = buildSearchUrl()
  if (!href) return
  Promise.resolve(GM.openInTab(href, { active: activate })).catch(() => {})
  onClearSelection()
}

// action bar 的 Search 按鈕沒有對應的「切換過去」設定，一律切換
function onSearchNewTab(): void {
  doSearchNewTab(true)
}

function onSearchCurrent(): void {
  const href = buildSearchUrl()
  if (!href) return
  window.location.href = href
  // navigation 觸發，component 即將卸載——不用 clearSelection
}

async function onOpenInMyTags(): Promise<void> {
  const gidMatch = /^\/g\/(\d+)\//.exec(location.pathname)
  if (!gidMatch || selectedCount.value === 0) return
  const gid = Number(gidMatch[1])
  const tags = allTags.value
    .filter(t => selection.value.has(t.nsRaw))
    .map(t => t.nsRaw)
  await savePick(gid, tags)
  Promise.resolve(GM.openInTab(pickUrl(location.origin, gid), { active: true })).catch(() => {})
  onClearSelection()
}

function tagsFor(target: Selection): GalleryTag[] {
  // 原 taglist + 候選都要收：vote batch / search 兩條都共用這個
  return allTags.value
    .filter(t => selection.value.get(t.nsRaw) === target)
}

async function onSendBatchVotes(): Promise<void> {
  if (votePending.value) return
  const ups = tagsFor('positive')
  const downs = tagsFor('negative')
  if (ups.length === 0 && downs.length === 0) return

  votePending.value = true
  // EH 是 delta model：對已 down 的 tag 投 +1 是「撤銷 down」而非「變 up」，
  // 對已 up 的 tag 投 -1 是「撤銷 up」。cross-direction 時 optimistic 設 null
  // 等 server tagpaneHtml 回來再 sync 真實狀態
  for (const tag of ups) {
    const cur = userVotes.value[tag.nsRaw]
    userVotes.value[tag.nsRaw] = cur === 'down' ? null : 'up'
  }
  for (const tag of downs) {
    const cur = userVotes.value[tag.nsRaw]
    userVotes.value[tag.nsRaw] = cur === 'up' ? null : 'down'
  }

  // 記下這個 batch 涵蓋了哪些「新增」placeholder：vote 成功後 EH server 會
  // 把新 tag 寫進 gallery taglist，回傳的 tagpaneHtml 一刷 currentTags 就會包含，
  // 我們可以清掉 placeholder（保留會導致同一 nsRaw 在 currentTags + 候選雙列）。
  // imports 不動：它記的是別本的 taglist，投上去之後就改當這個標籤的佐證
  const addedBefore = new Set(addedTags.value.map(t => t.nsRaw))
  const votedAddedIds = [...ups, ...downs]
    .map(t => t.nsRaw)
    .filter(id => addedBefore.has(id))

  try {
    let allOk = true
    if (ups.length) allOk = (await dispatchBatch(ups, 1)) && allOk
    if (downs.length) allOk = (await dispatchBatch(downs, -1)) && allOk
    if (allOk) {
      if (votedAddedIds.length) {
        const removed = new Set(votedAddedIds)
        addedTags.value = addedTags.value.filter(t => !removed.has(t.nsRaw))
      }
      // 成功才清 selection：失敗時保留讓使用者可以直接 retry
      onClearSelection()
    }
  } finally {
    votePending.value = false
    // batch 期間 MutationObserver 都 skip 了，補一次把 server 最終狀態收回來
    currentTags.value = parseTaglistRoot(host.taglistEl)
    syncUserVotesFromTags()
  }
}

async function dispatchBatch(tags: GalleryTag[], voteValue: 1 | -1): Promise<boolean> {
  const response = await batchVote(tags, voteValue)
  if (response.tagpaneHtml) {
    host.taglistEl.innerHTML = response.tagpaneHtml
  } else if (response.error) {
    syncUserVotesFromTags()
  }
  if (response.error) toast.error(response.error)
  if (response.needsLogin) toast.warning(t('gallery.sessionExpired'))
  if (response.redirect) toast.info(`Redirect: ${response.redirect}`)
  return !response.error && !response.needsLogin
}

function onClearSelection(): void {
  selection.value = new Map()
}

// selection 全空時 auto close panel（user 也可 panel 內 close button 手動關）
watch(selection, () => {
  if (selection.value.size === 0) closePanel()
})
</script>

<template>
  <div
    class="eqt-gallery-taglist"
    :style="{ zoom: galleryTaglistZoom / 100 }"
    @mousedown="onAreaMouseDown"
    @dblclick="onTaglistDblClick"
    @contextmenu="onTaglistContextMenu"
  >
    <div
      v-for="group in groups"
      :key="group.key"
      class="eqt-gallery-taglist__row"
    >
      <div class="eqt-gallery-taglist__label">
        <template v-if="group.label">{{ group.label }}:</template>
        <CornerLeftUp v-else-if="group.candidate" class="eqt-gallery-taglist__label-icon" />
      </div>
      <div class="eqt-gallery-taglist__cells" :class="{ 'eqt-gallery-taglist__cells--candidate': group.candidate }">
        <TagChip
          v-for="chip in group.chips"
          :key="chip.tag.nsRaw"
          :full="chip.tag.nsRaw"
          :display="chip.display"
          :icon-url="chip.iconUrl"
          :tier="chip.tier"
          :colors="galleryMyTagsColorsEnabled ? chip.personalTag : undefined"
          :weight="chip.personalTag?.weight"
          :hidden="chip.personalTag?.hidden"
          :watch="chip.personalTag?.watch"
          :show-score="galleryMyTagsScoresEnabled"
          :show-marks="galleryMyTagsMarksEnabled"
          :selection="chip.selected"
          :vote="userVotes[chip.tag.nsRaw]"
        >
          <template v-if="chip.candidate || chip.evidence" #lead>
            <TagPlus v-if="chip.candidate === 'added'" />
            <SquareArrowRightEnter v-else-if="chip.candidate === 'imported'" :title="chip.sources" />
            <CircleCheck v-else-if="chip.evidence === 'solid'" :title="chip.sources" />
            <CircleDashedCheck v-else-if="chip.evidence === 'dashed'" :title="chip.sources" />
            <CircleDottedCheck v-else :title="chip.sources" />
          </template>
        </TagChip>
      </div>
    </div>
  </div>

  <!-- Action 區：search 左跨 2 列、vote 右跨 2 列（兩個大方塊，物理距離把誤觸代價較高的
       vote 跟 search 隔開），中間夾 add / 導入 / wiki 與 clear / My Tags / settings。
       導入打開時網址欄插在最上面、橫跨全寬 -->
  <div class="eqt-gallery-actions" :class="{ 'eqt-gallery-actions--import': importOpen }">
    <input
      v-if="importOpen"
      ref="importInput"
      v-model="importUrl"
      class="eqt-gallery-actions__import"
      type="text"
      placeholder="https://e-hentai.org/g/123456/0123456789/"
      :aria-label="t('gallery.importToggle')"
      :readonly="importBusy"
      spellcheck="false"
      autocomplete="off"
      @input="importFrom(importUrl)"
    >
    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--search"
      :disabled="selectedCount === 0"
      @click="onSearchNewTab"
    >
      <Search :size="20" />
      <span>{{ t('gallery.searchN', { n: String(selectedCount) }) }}</span>
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--add"
      :title="t('gallery.addTags')"
      @click="showAddPopup = !showAddPopup"
    >
      <TagPlus :size="14" />
      <span>{{ t('gallery.addTags') }}</span>
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--import"
      :aria-pressed="importOpen"
      @click="toggleImport"
    >
      <SquareArrowRightEnter :size="14" />
      <span>{{ t('gallery.importToggle') }}</span>
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--clear"
      :disabled="selectedCount === 0"
      @click="onClearSelection"
    >
      {{ t('gallery.clearSelection') }}
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--mytags"
      :disabled="selectedCount === 0"
      :title="t('gallery.openInMyTags')"
      @click="onOpenInMyTags"
    >
      <Tags :size="14" />
      <span>{{ t('gallery.openInMyTags') }}</span>
    </button>

    <a
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--wiki"
      :href="wikiUrl"
      target="_blank"
      rel="noopener noreferrer"
      :title="t('gallery.wiki')"
    >
      <BookOpen :size="14" />
      <span>{{ t('gallery.wiki') }}</span>
    </a>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--settings"
      :title="t('settings.title')"
      @click="openSettings('gallery')"
    >
      <Settings :size="14" />
      <span>{{ t('settings.title') }}</span>
    </button>

    <button
      type="button"
      class="eqt-gallery-actions__btn eqt-gallery-actions__btn--vote"
      :disabled="selectedCount === 0 || votePending"
      @click="onSendBatchVotes"
    >
      <span class="eqt-gallery-actions__vote-counts">↑{{ positiveCount }} ↓{{ negativeCount }}</span>
      <span>{{ t('gallery.vote') }}</span>
    </button>
  </div>

  <GalleryAddInline
    v-if="showAddPopup"
    :picked-ids="pickedIds"
    @pick="onPickFromAdd"
    @close="showAddPopup = false"
  />
  <GalleryIntroPanel />
</template>
