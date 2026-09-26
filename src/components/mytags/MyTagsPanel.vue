<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useElementBounding, useMediaQuery } from '@vueuse/core'
import { ArrowLeftFromLine, ArrowRightFromLine, ExternalLink, Settings } from '@lucide/vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { isZhLocale, t } from '@/composables/useI18n'
import { useEqtToast } from '@/composables/useEqtToast'
import MyTagsTagList from '@/components/mytags/MyTagsTagList.vue'
import MyTagsCatalog from '@/components/mytags/MyTagsCatalog.vue'
import MyTagsPreview from '@/components/mytags/MyTagsPreview.vue'
import MyTagsGallery from '@/components/mytags/MyTagsGallery.vue'
import MyTagsEhTopbar from '@/components/mytags/MyTagsEhTopbar.vue'
import EqtNumberField from '@/components/EqtNumberField.vue'
import AnchoredPopover from '@/components/AnchoredPopover.vue'
import { fetchGallery, type GalleryDetail } from '@/composables/useEhGalleryPreview'
import {
  useEhMyTagsHost, fetchTagSet, fetchThresholds,
  type MyTagRow, type NewTagInput, type TagSetSnapshot,
} from '@/composables/useEhMyTagsHost'
import { fetchListing } from '@/composables/useEhSearchListing'
import { useMyTagsSampleFetcher } from '@/composables/useMyTagsSampleFetcher'
import {
  outcomeOf, compareItems,
  type PreviewItem, type TagFacts, type TagImpact,
} from '@/services/mytags/mytagsScore'
import {
  listingUrl, emptyStore,
  type SampleStore, type SampleGallery, type Verdict,
} from '@/services/mytags/mytagsSamples'
import {
  loadSamples,
  saveGalleries,
  saveVerdicts,
} from '@/services/mytags/mytagsSampleStore'
import {
  stage, effective, unstage,
  type EditMap, type TagState,
} from '@/services/mytags/mytagsEdits'
import { emptyBulkDraft, planTagChanges } from '@/services/mytags/mytagsBulk'
import {
  loadEdits, saveEdits, emptyFilter,
  type TagFilter,
} from '@/services/mytags/mytagsEditStore'
import { setUserTag, canWrite } from '@/services/mytags/mytagsApi'
import { patchConfig } from '@/services/ehConfig'
import { serializeEntry } from '@/services/search/searchSyntax'
import { myTagsPanelZoom, nsFormat } from '@/services/store'
import { openSettings } from '@/services/appOverlays'
import { tagChipStyle } from '@/services/mytags/mytagsColors'
import { buildMyTagsPalette, saveMyTagsPalette } from '@/services/mytags/mytagsPalette'
import type { TagEntry } from '@/services/tags/tagDb'

const host = useEhMyTagsHost()!

const toast = useEqtToast()

/** 一次「抓取樣本」最多翻幾頁 EH */
const MAX_FETCH = 6
const SIDE_DEFAULT_SIZE = 28
const EDITOR_DEFAULT_SIZE = 45
type PreviewTarget = { kind: 'saved' | 'draft'; full: string } | null
type NewTagDraft = Omit<NewTagInput, 'full'> & { tagSet: string }
type NewTagSubmission = NewTagInput & { tagSet: string }

function emptyDraft(): NewTagDraft {
  return {
    tagSet: host.currentSet,
    weight: 10,
    color: '',
    watch: false,
    hidden: false,
  }
}

const liveRows = ref<MyTagRow[]>(host.readRows())
const otherSets = ref<TagSetSnapshot[]>([])
const edits = ref<EditMap>({})
const bulkDraft = ref(emptyBulkDraft())
const store = ref<SampleStore>(emptyStore())
const ehTopbarOpen = ref(false)
const helpOpen = ref(false)
const helpAnchor = ref<HTMLElement | null>(null)
const topbar = ref<HTMLElement | null>(null)
const { bottom: topbarBottom } = useElementBounding(topbar)
const wikiUrl = computed(() => `https://ehwiki.org/wiki/My_Tags${isZhLocale() ? '/Chinese' : ''}`)
// 說明文案的專有名詞走 placeholder，翻譯只排語序，值與樣式一律由這裡給
const helpTerms = computed<Record<string, string>>(() => ({
  threshold: t('bars.threshold'),
  preview: t('preview.title'),
  blocked: t('preview.filterLeft'),
  shown: t('preview.filterRight'),
  block: t('preview.shouldBlock'),
  keep: t('preview.shouldKeep'),
  anthology: 'other:anthology',
  webtoon: 'other:webtoon',
}))

function helpSegments(text: string): { text: string; term: boolean }[] {
  return text.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const term = helpTerms.value[part.slice(1, -1)]
    return term ? { text: term, term: true } : { text: part, term: false }
  })
}

const helpUsageLines = computed(() => t('panel.helpUsage').split('\n').map(helpSegments))
const narrowLayout = useMediaQuery('(max-width: 900px)')
const sidePanel = ref<InstanceType<typeof SplitterPanel> | null>(null)
const editorPanel = ref<InstanceType<typeof SplitterPanel> | null>(null)
const catalogTag = ref('')
const previewTarget = ref<PreviewTarget>(null)
const draft = ref<NewTagDraft>(emptyDraft())
const moveTarget = ref(host.currentSet)
const createBusy = ref(false)

const filterThreshold = ref<number | null>(null)
/** EH 上現在的門檻。跟 filterThreshold 不一樣就代表這格也還沒送出去 */
const savedThreshold = ref<number | null>(null)
const markedOnly = ref(false)
const expungedOnly = ref(false)
const writeBusy = ref('')
function acceptSamples(samples: SampleGallery[]): void {
  const galleries = { ...store.value.galleries }
  for (const gallery of samples) galleries[String(gallery.gid)] = gallery
  store.value = { ...store.value, galleries }
}
const currentFetcher = useMyTagsSampleFetcher({
  fetchPage: (tag, cursor, signal) => fetchListing(listingUrl(term(tag), location.origin, cursor), signal),
  accept: acceptSamples,
  maxPages: MAX_FETCH,
})
const expungedFetcher = useMyTagsSampleFetcher({
  fetchPage: (tag, cursor, signal) => fetchListing(listingUrl(term(tag), location.origin, cursor, true), signal),
  accept: acceptSamples,
  maxPages: MAX_FETCH,
})

/** 攤開在預覽下方的那一本。整頁抓回來，判斷才有一張封面以外的依據 */
const openedGallery = ref<GalleryDetail | null>(null)
const galleryBusy = ref(false)
/** 同一本不用抓第二次 */
const galleryCache = new Map<number, GalleryDetail>()

const filter = ref<TagFilter>(emptyFilter())


// ---- 合併所有標籤集 ----

// ⚠️ 同一個標籤可能同時存在於兩組。清單裡列兩次、計分只採一份的話，畫面會說一套、
// 算另一套——所以這裡就去重，當前組那份優先（它是頁面上活的那個）
const rows = computed<MyTagRow[]>(() => {
  const byName = new Map<string, MyTagRow>()
  for (const r of [...otherSets.value.flatMap((s) => s.rows), ...liveRows.value]) {
    byName.set(r.full, r)
  }
  return [...byName.values()]
})

const setColors = computed<Record<string, string>>(() => {
  const out: Record<string, string> = { [host.currentSet]: host.defaultColor }
  for (const s of otherSets.value) out[s.value] = s.defaultColor
  return out
})

/** API 已接受，但原生輸入框還停在舊值——重讀原生時要蓋回去，否則已存狀態會倒退 */
const accepted = new Map<number, TagState>()

/** API 已接受後，直接更新 rows 這份已儲存狀態。 */
function acceptWrite(id: number, state: TagState): void {
  accepted.set(id, state)
  liveRows.value = liveRows.value.map((row) => row.id === id ? { ...row, ...state } : row)
  otherSets.value = otherSets.value.map((set) => ({
    ...set,
    rows: set.rows.map((row) => row.id === id ? { ...row, ...state } : row),
  }))
}

const paletteSets = computed<TagSetSnapshot[]>(() => {
  const current: TagSetSnapshot = {
    value: host.currentSet,
    name: host.tagSets.find((s) => s.selected)?.name ?? host.currentSet,
    enabled: host.enabled,
    defaultColor: host.defaultColor,
    rows: liveRows.value,
  }
  const byValue = new Map<string, TagSetSnapshot>([[current.value, current]])
  for (const set of otherSets.value) byValue.set(set.value, set)
  const order = host.tagSets.length ? host.tagSets.map((entry) => entry.value) : [current.value]
  return order.flatMap((value) => byValue.get(value) ?? [])
})

/** 有一組沒讀到就不發佈：那會把畫廊那邊完整的快取換成缺一組的版本 */
const paletteComplete = ref(false)

function publishPalette(): void {
  if (!paletteComplete.value) return
  void saveMyTagsPalette(buildMyTagsPalette(paletteSets.value))
    .catch((error: unknown) => { console.error('palette save failed', error) })
}

const rowMap = computed(() => new Map(rows.value.map((r) => [r.full, r])))
const editPlan = computed(() => planTagChanges(rows.value, edits.value, bulkDraft.value))

function view(row: MyTagRow): TagState {
  return effective(row, editPlan.value.edits)
}

const catalogRow = computed(() => rowMap.value.get(catalogTag.value) ?? null)
const catalogState = computed<TagState>(() => {
  const row = catalogRow.value
  return row ? view(row) : draft.value
})
const catalogSet = computed(() => catalogRow.value?.tagSet ?? draft.value.tagSet)

const selectedSaved = computed(() => previewTarget.value?.kind === 'saved'
  ? previewTarget.value.full
  : null)

const selectedTagStyle = computed(() => {
  const full = selectedSaved.value
  if (!full) return null
  const row = rowMap.value.get(full)
  if (!row) return null
  const state = view(row)
  return tagChipStyle({
    color: state.color,
    setColor: setColors.value[row.tagSet] ?? '',
    weight: state.weight,
    hidden: state.hidden,
  })
})

function factsOf(tag: string): TagFacts | null {
  const r = rowMap.value.get(tag)
  if (!r || editPlan.value.deletedIds.has(r.id)) return null
  const v = view(r)
  return { weight: v.weight, hidden: v.hidden, watch: v.watch }
}

function catalogFactsOf(tag: string): TagFacts | null {
  if (catalogTag.value === tag) {
    if (catalogRow.value && editPlan.value.deletedIds.has(catalogRow.value.id)) return null
    const current = catalogState.value
    return { weight: current.weight, hidden: current.hidden, watch: current.watch }
  }
  return factsOf(tag)
}

const catalogTagStyle = computed(() => {
  const current = catalogState.value
  return tagChipStyle({
    color: current.color,
    setColor: setColors.value[catalogSet.value] ?? '',
    weight: current.weight,
    hidden: current.hidden,
  })
})


// NumberField 暫時沒有有限數字時，不讓空值經 JS coercion 混進計分。
const activeThreshold = computed<number | null>(() => {
  const raw = filterThreshold.value
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
})

// ---- 樣本 → 兩欄 ----

const allItems = computed<PreviewItem[]>(() => {
  const th = activeThreshold.value ?? 0
  return Object.values(store.value.galleries).map((gallery) => ({
    gallery,
    outcome: outcomeOf(gallery.tags, factsOf, th),
  }))
})

const previewItems = computed<PreviewItem[]>(() => {
  const target = previewTarget.value
  const threshold = activeThreshold.value ?? 0
  const factSource = target?.kind === 'draft' ? catalogFactsOf : factsOf
  return Object.values(store.value.galleries)
    .filter((gallery) => !markedOnly.value || !!store.value.verdicts[String(gallery.gid)])
    .filter((gallery) => !expungedOnly.value || gallery.expunged === true)
    .filter((gallery) => !target || gallery.tags.includes(target.full))
    .map((gallery) => ({
      gallery,
      outcome: outcomeOf(gallery.tags, factSource, threshold),
    }))
})

const previewLeftItems = computed(() =>
  previewItems.value.filter((item) => item.outcome.side === 'left').sort(compareItems))
const previewRightItems = computed(() =>
  previewItems.value.filter((item) => item.outcome.side === 'right').sort(compareItems))

const catalogItems = computed<PreviewItem[]>(() => {
  const full = catalogTag.value
  if (!full) return []
  const threshold = activeThreshold.value ?? 0
  return Object.values(store.value.galleries)
    .filter((gallery) => gallery.tags.includes(full))
    .filter((gallery) => !markedOnly.value || !!store.value.verdicts[String(gallery.gid)])
    .filter((gallery) => !expungedOnly.value || gallery.expunged === true)
    .map((gallery) => ({
      gallery,
      outcome: outcomeOf(gallery.tags, catalogFactsOf, threshold),
    }))
})

const catalogImpact = computed<TagImpact>(() => ({
  total: catalogItems.value.length,
  left: catalogItems.value.filter((item) => item.outcome.side === 'left').length,
  right: catalogItems.value.filter((item) => item.outcome.side === 'right').length,
}))

const previewSelectedStyle = computed(() => previewTarget.value?.kind === 'draft'
  ? catalogTagStyle.value
  : selectedTagStyle.value)

/** 每個標籤在目前樣本裡的去向分佈 */
const impact = computed<Map<string, TagImpact>>(() => {
  const out = new Map<string, TagImpact>()
  for (const item of allItems.value) {
    for (const tag of item.gallery.tags) {
      if (!rowMap.value.has(tag)) continue
      const at = out.get(tag) ?? { total: 0, left: 0, right: 0 }
      at.total += 1
      if (item.outcome.side === 'left') at.left += 1
      else at.right += 1
      out.set(tag, at)
    }
  }
  return out
})

// ⭐ 標籤集是主要的篩選，也是唯一會改變「清單裡有哪些標籤」的那個
const sidebarRows = computed(() => (filter.value.set === 'all'
  ? rows.value
  : rows.value.filter((r) => r.tagSet === filter.value.set)))


// ---- 編輯 ----


/** 丟掉所有還沒送出的東西，門檻那格也要跟著回到 EH 上的值 */
function discard(): void {
  edits.value = unstage(edits.value, Object.keys(edits.value).map(Number))
  bulkDraft.value = emptyBulkDraft()
  filterThreshold.value = savedThreshold.value
}

function patch(row: MyTagRow, p: Partial<TagState>): void {
  edits.value = stage(edits.value, row, p)
}

function retireBulk(ids: number[]): void {
  const removed = new Set(ids)
  const remaining = bulkDraft.value.ids.filter(id => !removed.has(id))
  bulkDraft.value = remaining.length
    ? { ...bulkDraft.value, ids: remaining }
    : emptyBulkDraft()
}

/**
 * 門檻也算一筆未送出的改動。
 *
 * ⚠️ 讀不到 EH 上的原值（savedThreshold 是 null）就不能送——那時候我們不知道自己
 * 在覆蓋什麼，而 /uconfig.php 是整份覆蓋。
 */
const thresholdDirty = computed(() =>
  savedThreshold.value !== null
  && typeof filterThreshold.value === 'number'
  && filterThreshold.value !== savedThreshold.value)

const pendingTotal = computed(() =>
  editPlan.value.changes.length + (thresholdDirty.value ? 1 : 0))

async function flush(): Promise<void> { await saveEdits(edits.value) }

/**
 * 逐一送出，不分標籤集。
 *
 * ⭐ `setusertag` 的參數裡沒有 tagset，`tagid` 本身就是全域唯一的——所以「哪一組」
 * 對寫入沒有意義，一次按下去就能把所有組的改動送完。
 *
 * 逐一而不是併發：EH 那邊本來就是單線的，而且它自己的鎖在失敗後不會放掉。順序和
 * 錯誤都自己管，一筆失敗就停下來，不要把後面的也一起吞掉。
 */
async function apply(): Promise<void> {
  if (writeBusy.value || !pendingTotal.value) return
  const todo = editPlan.value.changes
  if (todo.some(change => change.write) && !canWrite()) {
    toast.error(t('panel.noCredentials')); return
  }
  const deletes = todo.filter(change => change.remove)
  if (deletes.length && !confirm(t('panel.deleteConfirmMany', { n: deletes.length }))) return

  const done = new Set<number>()
  let failed = false
  writeBusy.value = t('panel.working')
  try {
    for (const [i, change] of todo.entries()) {
      if (!change.write) continue
      writeBusy.value = t('panel.applying', { i: i + 1, n: todo.length })
      const res = await setUserTag({ id: change.row.id, ...change.state })
      if (!res.ok) {
        toast.error(t('panel.applyFailed', { tag: change.row.full, error: res.error }))
        failed = true
        break
      }
      acceptWrite(change.row.id, change.state)
      edits.value = unstage(edits.value, [change.row.id])
      if (!change.moveTo) {
        done.add(change.row.id)
        retireBulk([change.row.id])
      }
    }

    if (!failed) {
      const actions = new Map<string, MyTagRow[]>()
      for (const change of todo) {
        const target = change.remove ? '0' : change.moveTo
        if (!target) continue
        const batch = actions.get(target)
        if (batch) batch.push(change.row)
        else actions.set(target, [change.row])
      }
      for (const [target, batch] of actions) {
        const result = await executeMass(batch, target)
        result.done.forEach(id => done.add(id))
        if (!result.ok) { failed = true; break }
      }
    }

    if (!failed) {
      bulkDraft.value = emptyBulkDraft()
      if (thresholdDirty.value) await applyThreshold()
    }
  } finally {
    await flush()
    publishPalette()
    writeBusy.value = ''
  }
  if (done.size) toast.success(t('panel.applied', { n: done.size }))
}

/**
 * 門檻住在 /uconfig.php，而那個頁面是整份覆蓋的。
 *
 * ⚠️ `clobbered` 非空代表我們漏收了欄位、把使用者別的設定一起改掉了。那是我們的
 * bug，不是操作失誤，所以要把欄位名原原本本報出來而不是含糊帶過。
 */
async function applyThreshold(): Promise<void> {
  writeBusy.value = t('panel.applyingThreshold')
  const res = await patchConfig('ft', 'ft', String(filterThreshold.value))
  if (!res.ok) {
    toast.error(t('panel.thresholdFailed', { error: res.error }))
    return
  }
  savedThreshold.value = filterThreshold.value
  if (res.clobbered.length) {
    toast.warning(t('panel.thresholdClobbered', { fields: res.clobbered.join(', ') }))
  } else {
    toast.success(t('panel.thresholdApplied', { n: filterThreshold.value ?? 0 }))
  }
}


/** 送出後把那一組的標籤列換成最新的。當前組住在 liveRows，其餘住在 otherSets */
function absorb(tagSet: string, next: MyTagRow[]): void {
  if (tagSet === host.currentSet) { liveRows.value = next; return }
  otherSets.value = otherSets.value.map((s) => (s.value === tagSet ? { ...s, rows: next } : s))
}

/**
 * 批次刪除 / 搬移。
 *
 * ⭐ 表單認的是 URL 上的 `?tagset=`，不是當前頁面——所以按組拆開分別 POST 就能一次
 * 處理跨組的選取，而且不刷新。`target` 是 `0`（刪除）或目標組。
 */
async function executeMass(rows2: MyTagRow[], target: string): Promise<{ done: number[]; ok: boolean }> {
  await flush()
  const bySet = new Map<string, number[]>()
  for (const row of rows2) {
    const ids = bySet.get(row.tagSet)
    if (ids) ids.push(row.id)
    else bySet.set(row.tagSet, [row.id])
  }

  writeBusy.value = t('panel.working')
  const done: number[] = []
  let ok = true
  for (const [set, ids] of bySet) {
    const next = target === '0'
      ? await host.deleteTags(ids, set)
      : await host.moveTags(ids, target, set)
    if (!next) {
      paletteComplete.value = false
      toast.error(t('panel.massFailed'))
      ok = false
      break
    }
    absorb(set, next)
    done.push(...ids)
    edits.value = unstage(edits.value, ids)
    retireBulk(ids)
  }
  if (target !== '0' && done.length) {
    const got = await fetchTagSet(target)
    if (got) absorb(target, got.rows)
    else paletteComplete.value = false
  }
  return { done, ok }
}

async function moveTags(target: MyTagRow[], to: string): Promise<void> {
  if (!to || writeBusy.value || !target.length) return
  writeBusy.value = t('panel.working')
  try {
    await executeMass(target, to)
  } finally {
    await flush()
    publishPalette()
    writeBusy.value = ''
  }
}


// ---- 樣本 ----

function term(full: string): string {
  const colon = full.indexOf(':')
  return serializeEntry(
    { ns: full.slice(0, colon), raw: full.slice(colon + 1) },
    { nsFormat: nsFormat.value, exactMatch: true },
  )
}

async function grabTag(tag: string, expunged = false): Promise<void> {
  const selected = expunged ? expungedFetcher : currentFetcher
  const other = expunged ? currentFetcher : expungedFetcher
  other.stop()
  markedOnly.value = false
  await selected.start(tag)
}

async function refreshPreview(expunged = false): Promise<void> {
  const tag = previewTarget.value?.full
  if (!tag) { toast.info(t('panel.pickTagFirst')); return }
  await grabTag(tag, expunged)
}

/** 直接指定，不用一格一格輪。只認 gid——判斷本來就綁畫廊不綁設定 */
function setVerdict(gid: number, want: Verdict | null): void {
  const verdicts = { ...store.value.verdicts }
  if (want) verdicts[String(gid)] = want
  else delete verdicts[String(gid)]
  store.value = { ...store.value, verdicts }
}

async function openGallery(g: SampleGallery): Promise<void> {
  if (openedGallery.value?.gid === g.gid) { openedGallery.value = null; return }
  const cached = galleryCache.get(g.gid)
  if (cached) { openedGallery.value = cached; return }
  galleryBusy.value = true
  const got = await fetchGallery(g.gid, g.token)
  galleryBusy.value = false
  if (!got) { toast.error(t('gallery.failed')); return }
  galleryCache.set(g.gid, got)
  openedGallery.value = got
}

/** 攤開的那一本在目前預覽條件下的去向，跟格子上顯示的是同一份 */
const openedOutcome = computed(() =>
  previewItems.value.find((item) => item.gallery.gid === openedGallery.value?.gid)?.outcome ?? null)

function select(tag: string): void {
  catalogTag.value = tag
  const row = rowMap.value.get(tag)
  if (row) moveTarget.value = row.tagSet
  const current = previewTarget.value
  previewTarget.value = current?.kind === 'saved' && current.full === tag
    ? null
    : { kind: 'saved', full: tag }
  openedGallery.value = null
  if (previewTarget.value && !currentFetcher.hasFetched(tag)) void grabTag(tag)
}

function setCatalogFull(full: string): void {
  catalogTag.value = full
  const row = rowMap.value.get(full)
  if (row) moveTarget.value = row.tagSet
  previewCatalog()
}

function pickCandidate(entry: TagEntry): void {
  setCatalogFull(entry.fullTag)
  if (!currentFetcher.hasFetched(entry.fullTag)) void grabTag(entry.fullTag)
}

function previewCatalog(): void {
  const full = catalogTag.value
  previewTarget.value = full
    ? { kind: catalogRow.value ? 'saved' : 'draft', full }
    : null
  openedGallery.value = null
}

function patchCatalog(change: Partial<TagState>): void {
  const row = catalogRow.value
  if (row) {
    patch(row, change)
    return
  }
  const next = { ...draft.value, ...change }
  if (change.watch) next.hidden = false
  if (change.hidden) next.watch = false
  draft.value = next
}

function setCatalogTarget(value: string): void {
  if (catalogRow.value) moveTarget.value = value
  else draft.value = { ...draft.value, tagSet: value }
}

function moveCatalogTag(target: string): void {
  const row = catalogRow.value
  if (!row || target === row.tagSet) return
  moveTags([row], target)
}

function clearPreviewTarget(): void {
  previewTarget.value = null
  openedGallery.value = null
}

function toggleEhTopbar(): void {
  ehTopbarOpen.value = !ehTopbarOpen.value
}

async function createNewTag(current: NewTagSubmission): Promise<void> {
  if (createBusy.value) return
  createBusy.value = true
  try {
    // 原生新增會立刻刷新；先等既有 pending edits 真正落進 gmStorage。
    await flush()
    if (host.createTag(current.tagSet, current)) return
    toast.error(t('panel.createFailed'))
  } catch (error) {
    console.error('createTag failed', error)
    toast.error(t('panel.createFailed'))
  }
  createBusy.value = false
}

// ---- 封面預載：當前和接下來的先進快取，往下捲就不用等網路 ----

const warmed = new Set<string>()
watch([previewLeftItems, previewRightItems], ([l, r]) => {
  for (const item of [...l.slice(0, 36), ...r.slice(0, 36)]) {
    const url = item.gallery.thumb
    if (!url || warmed.has(url)) continue
    warmed.add(url)
    new Image().src = url
  }
}, { immediate: true })

// ---- 生命週期 ----

function reread(): void {
  liveRows.value = host.readRows().map((row) => {
    const state = accepted.get(row.id)
    return state ? { ...row, ...state } : row
  })
  publishPalette()
}

/**
 * 面板接管原生表單；MyTagsEhTopbar 自己管理 #nb / #lb 的借位與歸還。
 *
 * ⚠️ `overflow: hidden` 動的是宿主頁面的全域狀態，一定要還原乾淨。
 */
function setAppMode(on: boolean): void {
  if (!on) host.restoreEhTopbar()
  host.coverNative(on)
  for (const el of [document.documentElement, document.body]) el.style.overflow = on ? 'hidden' : ''
}

let unbind: (() => void) | null = null

onMounted(async () => {
  unbind = host.onChange(reread)
  setAppMode(true)
  store.value = await loadSamples()
  edits.value = await loadEdits()
  filterThreshold.value = (await fetchThresholds()).filter
  savedThreshold.value = filterThreshold.value

  const got = await Promise.all(
    host.tagSets.filter((s) => s.value !== host.currentSet)
      .map((s) => fetchTagSet(s.value)))
  // 沒啟用的組不進計分，所以連讀都不讀進來
  otherSets.value = got.filter((s): s is TagSetSnapshot => !!s && s.enabled)
  paletteComplete.value = got.every((s) => !!s)
  publishPalette()
})

onUnmounted(() => { currentFetcher.stop(); expungedFetcher.stop(); unbind?.(); setAppMode(false) })
watch(() => store.value.galleries, (galleries) => { void saveGalleries(galleries) })
watch(() => store.value.verdicts, (verdicts) => { void saveVerdicts(verdicts) })
watch(edits, () => { void flush() }, { deep: true })
</script>

<template>
  <section class="eqt-panel" :style="{ zoom: myTagsPanelZoom / 100 }">
    <SplitterGroup :direction="narrowLayout ? 'vertical' : 'horizontal'" class="eqt-panel__workspace">
      <SplitterPanel
        ref="sidePanel"
        v-slot="{ isCollapsed }"
        class="eqt-panel__side-panel"
        collapsible
        :collapsed-size="0"
        :min-size="0"
        :default-size="SIDE_DEFAULT_SIZE"
      >
    <header ref="topbar" class="eqt-panel__topbar" :aria-label="t('panel.navLabel')" :inert="isCollapsed" :aria-hidden="isCollapsed || undefined">
      <div class="eqt-panel__tools">
        <button
          type="button" class="eqt-panel__btn eqt-panel__btn--settings"
          @click="openSettings('mytags')"
        >
          <Settings :size="14" aria-hidden="true" />
          {{ t('settings.title') }}
        </button>
        <button
          type="button"
          class="eqt-panel__btn eqt-panel__eh-toggle"
          :aria-expanded="ehTopbarOpen"
          aria-controls="eqt-eh-topbar"
          @click="toggleEhTopbar"
        >{{ t('panel.ehTopbar') }}</button>
        <button
          ref="helpAnchor"
          type="button"
          class="eqt-panel__btn"
          :aria-expanded="helpOpen"
          aria-controls="eqt-mytags-help"
          @click="helpOpen = !helpOpen"
          @keydown.esc="helpOpen = false"
        >{{ t('panel.help') }}</button>
        <AnchoredPopover v-model:open="helpOpen" :anchor="helpAnchor">
          <section
            id="eqt-mytags-help"
            class="eqt-panel__help"
            aria-labelledby="eqt-mytags-help-title"
            @keydown.esc="helpOpen = false"
          >
            <header class="eqt-panel__help-head">
              <h2 id="eqt-mytags-help-title">{{ t('panel.help') }}</h2>
              <button type="button" class="eqt-panel__btn" @click="helpOpen = false">
                {{ t('settings.close') }}
              </button>
            </header>
            <ol>
              <li>
                {{ t('panel.helpFeedback') }}
                <ul>
                  <li v-for="(segs, i) in helpUsageLines" :key="i">
                    <template v-for="(seg, j) in segs" :key="j">
                      <code v-if="seg.term" class="eqt-panel__help-term">{{ seg.text }}</code>
                      <template v-else>{{ seg.text }}</template>
                    </template>
                  </li>
                </ul>
              </li>
              <li>{{ t('panel.helpTagSets') }}</li>
              <li>
                <template v-for="(part, i) in t('panel.helpLanguageFiltering').split(/(\{settings\})/)" :key="i">
                  <a v-if="part === '{settings}'" href="/uconfig.php" target="_blank" rel="noopener noreferrer">
                    {{ t('panel.helpSettingsPage') }}
                  </a>
                  <template v-else>{{ part }}</template>
                </template>
              </li>
              <li>
                <template v-for="(seg, i) in helpSegments(t('panel.helpQueryExemption'))" :key="i">
                  <code v-if="seg.term" class="eqt-panel__help-term">{{ seg.text }}</code>
                  <template v-else>{{ seg.text }}</template>
                </template>
                <p>
                  <template v-for="(seg, i) in helpSegments(t('panel.helpQueryExample'))" :key="i">
                    <code v-if="seg.term" class="eqt-panel__help-term">{{ seg.text }}</code>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </p>
              </li>
            </ol>
        <a
          class="eqt-panel__btn eqt-panel__btn--wiki"
          :href="wikiUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink :size="12" aria-hidden="true" />
          {{ t('panel.wiki') }}
        </a>
          </section>
        </AnchoredPopover>
      </div>


      <label class="eqt-panel__field">
        {{ t('preview.panelZoom') }}
        <EqtNumberField
          v-model="myTagsPanelZoom"
          :min="50"
          :max="150"
          :step="5"
          :label="t('preview.panelZoom')"
        />
        <span>%</span>
      </label>
    </header>

      <aside class="eqt-panel__side" :inert="isCollapsed" :aria-hidden="isCollapsed || undefined">
        <!-- 清單吃掉側欄剩下的高度，自己捲。側欄本身貼著視窗，所以底下那條永遠在 -->
        <MyTagsTagList
          v-model:filter="filter"
          v-model:bulk-draft="bulkDraft"
          :rows="sidebarRows" :total-count="rows.length" :edits="editPlan.edits" :selected="selectedSaved"
          :sets="host.tagSets" :current-set="host.currentSet"
          :impact="impact" :set-colors="setColors"
          :busy="!!writeBusy"
          @patch="patch" @select="select"
        />

        <!-- 底部只留下 pending edits 的取消與套用 -->
        <footer class="eqt-panel__dock">
          <!-- 兩顆都常駐。沒有未送出的改動時灰掉，位置固定才不用每次找 -->
          <div class="eqt-panel__commitbar">
            <button
              type="button" class="eqt-panel__btn"
              :disabled="!pendingTotal || !!writeBusy"
              @click="discard"
            >{{ t('panel.discard') }}</button>
            <button
              type="button" class="eqt-panel__btn eqt-panel__btn--primary"
              :disabled="!pendingTotal || !!writeBusy" @click="apply"
            >{{ writeBusy || t('panel.applyN', { n: pendingTotal }) }}</button>
          </div>
        </footer>
      </aside>
      </SplitterPanel>
      <div class="eqt-panel__divider" :data-orientation="narrowLayout ? 'vertical' : 'horizontal'">
        <button
          type="button"
          class="eqt-panel__panel-toggle eqt-panel__panel-toggle--side"
          :aria-expanded="!sidePanel?.isCollapsed"
          :aria-label="t(sidePanel?.isCollapsed ? 'panel.expandTagList' : 'panel.collapseTagList')"
          :title="t(sidePanel?.isCollapsed ? 'panel.expandTagList' : 'panel.collapseTagList')"
          @mousedown.stop
          @touchstart.stop
          @click="sidePanel?.isCollapsed ? sidePanel.resize(SIDE_DEFAULT_SIZE) : sidePanel?.collapse()"
        >
          <ArrowRightFromLine v-if="sidePanel?.isCollapsed" :size="14" aria-hidden="true" />
          <ArrowLeftFromLine v-else :size="14" aria-hidden="true" />
        </button>
        <SplitterResizeHandle
          class="eqt-panel__resize-handle eqt-panel__resize-handle--side"
          :aria-label="t('panel.resizeTagList')"
          :title="t('panel.resizeTagList')"
        >
          <span class="eqt-panel__resize-grip" aria-hidden="true" />
        </SplitterResizeHandle>
      </div>

      <SplitterPanel :min-size="30" :default-size="100 - SIDE_DEFAULT_SIZE" class="eqt-panel__main-panel">
      <SplitterGroup direction="horizontal" class="eqt-panel__splitter">
        <SplitterPanel :min-size="30" :default-size="100 - EDITOR_DEFAULT_SIZE" class="eqt-panel__preview-stack">
          <SplitterGroup direction="vertical" class="eqt-panel__preview-splitter">
          <SplitterPanel
            v-slot="{ isCollapsed }"
            collapsible
            :collapsed-size="0"
            :min-size="0"
            :default-size="55"
            class="eqt-panel__preview-panel"
          >
          <MyTagsPreview
            :inert="isCollapsed"
            :aria-hidden="isCollapsed || undefined"
            v-model:marked-only="markedOnly"
            v-model:expunged-only="expungedOnly"
            :expunged-busy="expungedFetcher.busy.value"
            :left="previewLeftItems" :right="previewRightItems"
            :verdicts="store.verdicts"
            :selected="previewTarget?.full ?? null" :selected-style="previewSelectedStyle"
            :refresh-busy="currentFetcher.busy.value" :threshold="activeThreshold"
            :opened-gid="openedGallery?.gid ?? null"
            @clear-tag="clearPreviewTarget" @refresh="refreshPreview" @set-verdict="setVerdict"
            @refresh-expunged="refreshPreview(true)"
            @open="openGallery"
          />
          </SplitterPanel>
          <SplitterResizeHandle
            v-if="openedGallery"
            class="eqt-panel__resize-handle eqt-panel__resize-handle--gallery"
            :aria-label="t('panel.resizeGallery')"
            :title="t('panel.resizeGallery')"
          >
            <span class="eqt-panel__resize-grip" aria-hidden="true" />
          </SplitterResizeHandle>
          <SplitterPanel
            v-if="openedGallery"
            v-slot="{ isCollapsed }"
            collapsible
            :collapsed-size="0"
            :min-size="0"
            :default-size="45"
            class="eqt-panel__gallery-panel"
          >

          <MyTagsGallery
            :inert="isCollapsed"
            :aria-hidden="isCollapsed || undefined"
            :detail="openedGallery" :outcome="openedOutcome"
            :verdict="store.verdicts[String(openedGallery.gid)]" :loading="galleryBusy"
            :threshold="activeThreshold"
            @close="openedGallery = null"
            @pick-tag="select"
            @set-verdict="(v) => openedGallery && setVerdict(openedGallery.gid, v)"
          />
          </SplitterPanel>
          </SplitterGroup>
        </SplitterPanel>
        <div class="eqt-panel__divider">
          <button
            type="button"
            class="eqt-panel__panel-toggle eqt-panel__panel-toggle--editor"
            :aria-expanded="!editorPanel?.isCollapsed"
            :aria-label="t(editorPanel?.isCollapsed ? 'panel.expandEditor' : 'panel.collapseEditor')"
            :title="t(editorPanel?.isCollapsed ? 'panel.expandEditor' : 'panel.collapseEditor')"
            @mousedown.stop
            @touchstart.stop
            @click="editorPanel?.isCollapsed ? editorPanel.resize(EDITOR_DEFAULT_SIZE) : editorPanel?.collapse()"
          >
            <ArrowLeftFromLine v-if="editorPanel?.isCollapsed" :size="14" aria-hidden="true" />
            <ArrowRightFromLine v-else :size="14" aria-hidden="true" />
          </button>
          <SplitterResizeHandle
            class="eqt-panel__resize-handle eqt-panel__resize-handle--editor"
            :aria-label="t('panel.resizeEditor')"
            :title="t('panel.resizeEditor')"
          >
            <span class="eqt-panel__resize-grip" aria-hidden="true" />
          </SplitterResizeHandle>
        </div>
        <SplitterPanel
          ref="editorPanel"
          v-slot="{ isCollapsed }"
          class="eqt-panel__editor-panel"
          collapsible
          :collapsed-size="0"
          :min-size="0"
          :default-size="EDITOR_DEFAULT_SIZE"
        >
      <label class="eqt-panel__field" :class="{ 'eqt-panel__field--dirty': thresholdDirty }" :inert="isCollapsed" :aria-hidden="isCollapsed || undefined">
        {{ t('bars.threshold') }}
        <EqtNumberField
          v-model="filterThreshold"
          :max="0"
          :label="t('bars.threshold')"
        />
      </label>
          <MyTagsCatalog
            id="eqt-tag-catalog"
            :inert="isCollapsed"
            :aria-hidden="isCollapsed || undefined"
            :full="catalogTag"
            :state="catalogState"
            :target-set="catalogRow ? moveTarget : draft.tagSet"
            :source-set="catalogRow?.tagSet ?? null"
            :sets="host.tagSets"
            :impact="catalogImpact"
            :set-colors="setColors"
            :busy="createBusy || !!writeBusy"
            :previewed="!!catalogTag && previewTarget?.full === catalogTag"
            @update:target-set="setCatalogTarget"
            @update:full="setCatalogFull"
            @patch="patchCatalog"
            @pick="pickCandidate"
            @preview="previewCatalog"
            @confirm="refreshPreview"
            @move="moveCatalogTag"
            @create="createNewTag"
          />
        </SplitterPanel>
      </SplitterGroup>
      </SplitterPanel>
    </SplitterGroup>
    <MyTagsEhTopbar
      v-if="ehTopbarOpen"
      :host="host"
      :style="{ '--eqt-eh-topbar-top': `${topbarBottom / (myTagsPanelZoom / 100)}px` }"
    />
  </section>
</template>
