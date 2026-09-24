<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { ArrowLeftFromLine, ArrowRightFromLine, Settings } from '@lucide/vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'
import { t } from '@/composables/useI18n'
import { useEqtToast } from '@/composables/useEqtToast'
import MyTagsTagList from '@/components/mytags/MyTagsTagList.vue'
import MyTagsCatalog from '@/components/mytags/MyTagsCatalog.vue'
import MyTagsPreview from '@/components/mytags/MyTagsPreview.vue'
import MyTagsGallery from '@/components/mytags/MyTagsGallery.vue'
import MyTagsEhTopbar from '@/components/mytags/MyTagsEhTopbar.vue'
import EqtNumberField from '@/components/EqtNumberField.vue'
import { fetchGallery, type GalleryDetail } from '@/composables/useEhGalleryPreview'
import {
  fetchTagSet, fetchThresholds,
  type EhMyTagsHost, type MyTagRow, type NewTagInput, type TagSetSnapshot,
} from '@/composables/useEhMyTagsHost'
import { fetchListing } from '@/composables/useEhSearchListing'
import {
  outcomeOf, compareItems,
  type PreviewItem, type TagFacts, type TagImpact,
} from '@/services/mytagsScore'
import {
  listingUrl, emptyStore,
  type SampleStore, type SampleGallery, type Verdict,
} from '@/services/mytagsSamples'
import {
  loadSamples,
  saveGalleries,
  saveVerdicts,
} from '@/services/mytagsSampleStore'
import {
  stage, stageMany, effective, unstage,
  type EditMap, type TagState,
} from '@/services/mytagsEdits'
import {
  loadEdits, saveEdits, emptyFilter,
  type TagFilter,
} from '@/services/mytagsEditStore'
import { setUserTag, canWrite } from '@/services/mytagsApi'
import { patchConfig } from '@/services/ehConfig'
import { serializeEntry } from '@/services/searchSyntax'
import { nsFormat, myTagsPreviewCoverScale } from '@/services/store'
import { tagChipStyle } from '@/services/mytagsColors'
import type { TagEntry } from '@/services/tagDb'

const emit = defineEmits<{ openSettings: [] }>()
const props = defineProps<{ host: EhMyTagsHost }>()

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
    tagSet: props.host.currentSet,
    weight: 10,
    color: '',
    watch: false,
    hidden: false,
  }
}

const liveRows = ref<MyTagRow[]>(props.host.readRows())
const otherSets = ref<TagSetSnapshot[]>([])
const edits = ref<EditMap>({})
const store = ref<SampleStore>(emptyStore())
const ehTopbarOpen = ref(false)
const narrowLayout = useMediaQuery('(max-width: 900px)')
const sidePanel = ref<InstanceType<typeof SplitterPanel> | null>(null)
const editorPanel = ref<InstanceType<typeof SplitterPanel> | null>(null)
const catalogTag = ref('')
const previewTarget = ref<PreviewTarget>(null)
const draft = ref<NewTagDraft>(emptyDraft())
const moveTarget = ref(props.host.currentSet)
const createBusy = ref(false)

const filterThreshold = ref<number | null>(null)
/** EH 上現在的門檻。跟 filterThreshold 不一樣就代表這格也還沒送出去 */
const savedThreshold = ref<number | null>(null)
const markedOnly = ref(false)
const writeBusy = ref('')
const sampleBusy = ref('')
const fetchedPages = ref<Record<string, { pages: number; cursor: string | null }>>({})

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
  const out: Record<string, string> = { [props.host.currentSet]: props.host.defaultColor }
  for (const s of otherSets.value) out[s.value] = s.defaultColor
  return out
})

/** API 已接受後，直接更新 rows 這份已儲存狀態。 */
function acceptWrite(id: number, state: TagState): void {
  liveRows.value = liveRows.value.map((row) => row.id === id ? { ...row, ...state } : row)
  otherSets.value = otherSets.value.map((set) => ({
    ...set,
    rows: set.rows.map((row) => row.id === id ? { ...row, ...state } : row),
  }))
}

const rowMap = computed(() => new Map(rows.value.map((r) => [r.full, r])))

function view(row: MyTagRow): TagState {
  return effective(row, edits.value)
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
  if (!r) return null
  const v = view(r)
  return { weight: v.weight, hidden: v.hidden, watch: v.watch }
}

function catalogFactsOf(tag: string): TagFacts | null {
  if (catalogTag.value === tag) {
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
  filterThreshold.value = savedThreshold.value
}

function patch(row: MyTagRow, p: Partial<TagState>): void {
  edits.value = stage(edits.value, row, p)
}

function bulk(rows2: MyTagRow[], p: Partial<TagState>): void {
  edits.value = stageMany(edits.value, rows2, p)
}

const pending = computed(() => rows.value.filter((row) => edits.value[row.id] !== undefined))

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
  pending.value.length + (thresholdDirty.value ? 1 : 0))

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
  if (pending.value.length && !canWrite()) {
    toast.error(t('panel.noCredentials')); return
  }
  const todo = [...pending.value]
  const done: number[] = []
  let failure = ''
  for (const [i, row] of todo.entries()) {
    writeBusy.value = t('panel.applying', { i: i + 1, n: todo.length })
    const want = effective(row, edits.value)
    const res = await setUserTag({ id: row.id, ...want })
    if (!res.ok) {
      failure = t('panel.applyFailed', { tag: row.full, error: res.error })
      break
    }
    acceptWrite(row.id, want)
    done.push(row.id)
  }
  edits.value = unstage(edits.value, done)
  await flush()

  // 標籤沒送完就不要動門檻——那是兩個不同的頁面，讓失敗停在一個地方比較好收拾
  if (!failure && thresholdDirty.value) await applyThreshold()
  writeBusy.value = ''

  // 成功的先報，失敗的後報。停在最上面的應該是還沒解決的那件事
  if (done.length) toast.success(t('panel.applied', { n: done.length }))
  if (failure) toast.error(failure)
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
  if (tagSet === props.host.currentSet) { liveRows.value = next; return }
  otherSets.value = otherSets.value.map((s) => (s.value === tagSet ? { ...s, rows: next } : s))
}

/**
 * 批次刪除 / 搬移。
 *
 * ⭐ 表單認的是 URL 上的 `?tagset=`，不是當前頁面——所以按組拆開分別 POST 就能一次
 * 處理跨組的選取，而且不刷新。`target` 是 `0`（刪除）或目標組。
 */
async function runMass(rows2: MyTagRow[], target: string): Promise<void> {
  if (writeBusy.value || !rows2.length) return
  await flush()
  const bySet = new Map<string, number[]>()
  for (const r of rows2) bySet.set(r.tagSet, [...(bySet.get(r.tagSet) ?? []), r.id])

  writeBusy.value = t('panel.working')
  const touched: number[] = []
  for (const [set, ids] of bySet) {
    const next = target === '0'
      ? await props.host.deleteTags(ids, set)
      : await props.host.moveTags(ids, target, set)
    if (!next) { toast.error(t('panel.massFailed')); break }
    absorb(set, next)
    touched.push(...ids)
  }
  // 搬走的標籤換了 tagid 所屬的組，目標組要重讀才看得到它們
  if (target !== '0') {
    const got = await fetchTagSet(target)
    if (got) absorb(target, got.rows)
  }
  // 編輯的對象已經不在了，留著只會一直算進「還沒送出」
  edits.value = unstage(edits.value, touched)
  writeBusy.value = ''
}

function removeTags(target: MyTagRow[]): void {
  if (!confirm(t('panel.deleteConfirmMany', { n: target.length }))) return
  void runMass(target, '0')
}

function moveTags(target: MyTagRow[], to: string): void {
  if (!to) return
  void runMass(target, to)
}


// ---- 樣本 ----

function term(full: string): string {
  const colon = full.indexOf(':')
  return serializeEntry(
    { ns: full.slice(0, colon), raw: full.slice(colon + 1) },
    { nsFormat: nsFormat.value, exactMatch: true },
  )
}

async function grabTag(tag: string): Promise<void> {
  const at = fetchedPages.value[tag]
  if (sampleBusy.value || (at && at.cursor === null)) return
  // 抓回來的都還沒判過，「只看已標記」開著的話它們一本都不會出現，就沒得標記了
  markedOnly.value = false
  sampleBusy.value = t('bars.grabbing')
  let { pages, cursor } = at ?? { pages: 0, cursor: null }
  for (let i = 0; i < MAX_FETCH; i += 1) {
    const got = await fetchListing(listingUrl(term(tag), location.origin, cursor))
    pages += 1
    cursor = got.next
    if (got.galleries.length) {
      const galleries = { ...store.value.galleries }
      for (const g of got.galleries) galleries[String(g.gid)] = g
      store.value = { ...store.value, galleries }
    }
    fetchedPages.value = { ...fetchedPages.value, [tag]: { pages, cursor } }
    if (!cursor) break
  }
  sampleBusy.value = ''
}

async function refreshPreview(): Promise<void> {
  const tag = previewTarget.value?.full
  if (!tag) { toast.info(t('panel.pickTagFirst')); return }
  await grabTag(tag)
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
  if (previewTarget.value && !fetchedPages.value[tag]) void grabTag(tag)
}

function setCatalogFull(full: string): void {
  catalogTag.value = full
  const row = rowMap.value.get(full)
  if (row) moveTarget.value = row.tagSet
  previewCatalog()
}

function pickCandidate(entry: TagEntry): void {
  setCatalogFull(entry.fullTag)
  if (!fetchedPages.value[entry.fullTag]) void grabTag(entry.fullTag)
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
    if (props.host.createTag(current.tagSet, current)) return
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

function reread(): void { liveRows.value = props.host.readRows() }

/**
 * 面板接管原生表單；MyTagsEhTopbar 自己管理 #nb / #lb 的借位與歸還。
 *
 * ⚠️ `overflow: hidden` 動的是宿主頁面的全域狀態，一定要還原乾淨。
 */
function setAppMode(on: boolean): void {
  if (!on) props.host.restoreEhTopbar()
  props.host.coverNative(on)
  for (const el of [document.documentElement, document.body]) el.style.overflow = on ? 'hidden' : ''
}

let unbind: (() => void) | null = null

onMounted(async () => {
  unbind = props.host.onChange(reread)
  setAppMode(true)
  store.value = await loadSamples()
  edits.value = await loadEdits()
  filterThreshold.value = (await fetchThresholds()).filter
  savedThreshold.value = filterThreshold.value

  const got = await Promise.all(
    props.host.tagSets.filter((s) => s.value !== props.host.currentSet)
      .map((s) => fetchTagSet(s.value)))
  // 沒啟用的組不進計分，所以連讀都不讀進來
  otherSets.value = got.filter((s): s is TagSetSnapshot => !!s && s.enabled)

})

onUnmounted(() => { unbind?.(); setAppMode(false) })
watch(() => store.value.galleries, (galleries) => { void saveGalleries(galleries) })
watch(() => store.value.verdicts, (verdicts) => { void saveVerdicts(verdicts) })
watch(edits, () => { void flush() }, { deep: true })
</script>

<template>
  <section class="eqt-panel">
    <header class="eqt-panel__topbar" :aria-label="t('panel.navLabel')">
      <div class="eqt-panel__tools">
        <button
          type="button" class="eqt-panel__btn eqt-panel__btn--settings"
          @click="emit('openSettings')"
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
        <label class="eqt-panel__field eqt-panel__cover-size">
          {{ t('preview.coverSize') }}
          <input
            v-model.number="myTagsPreviewCoverScale"
            class="eqt-panel__cover-slider"
            type="range"
            min="60"
            max="130"
            step="5"
            :aria-label="t('preview.coverSize')"
          >
          <output class="eqt-panel__cover-value">{{ myTagsPreviewCoverScale }}%</output>
        </label>
      </div>

      <MyTagsEhTopbar v-if="ehTopbarOpen" :host="host" />

      <label class="eqt-panel__field" :class="{ 'eqt-panel__field--dirty': thresholdDirty }">
        {{ t('bars.threshold') }}
        <EqtNumberField
          v-model="filterThreshold"
          :max="0"
          :label="t('bars.threshold')"
        />
      </label>
    </header>

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
      <aside class="eqt-panel__side" :inert="isCollapsed" :aria-hidden="isCollapsed || undefined">
        <!-- 清單吃掉側欄剩下的高度，自己捲。側欄本身貼著視窗，所以底下那條永遠在 -->
        <MyTagsTagList
          v-model:filter="filter"
          :rows="sidebarRows" :total-count="rows.length" :edits="edits" :selected="selectedSaved"
          :sets="host.tagSets" :current-set="host.currentSet"
          :impact="impact" :set-colors="setColors"
          @patch="patch" @bulk="bulk" @select="select"
          @remove="removeTags" @move="moveTags"
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
        <SplitterPanel
          ref="editorPanel"
          v-slot="{ isCollapsed }"
          class="eqt-panel__editor-panel"
          collapsible
          :collapsed-size="0"
          :min-size="0"
          :default-size="EDITOR_DEFAULT_SIZE"
        >
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
            <ArrowRightFromLine v-if="editorPanel?.isCollapsed" :size="14" aria-hidden="true" />
            <ArrowLeftFromLine v-else :size="14" aria-hidden="true" />
          </button>
          <SplitterResizeHandle
            class="eqt-panel__resize-handle eqt-panel__resize-handle--editor"
            :aria-label="t('panel.resizeEditor')"
            :title="t('panel.resizeEditor')"
          >
            <span class="eqt-panel__resize-grip" aria-hidden="true" />
          </SplitterResizeHandle>
        </div>
        <SplitterPanel :min-size="30" :default-size="100 - EDITOR_DEFAULT_SIZE" class="eqt-panel__preview-stack">
          <MyTagsPreview
            v-model:marked-only="markedOnly"
            :left="previewLeftItems" :right="previewRightItems"
            :verdicts="store.verdicts"
            :selected="previewTarget?.full ?? null" :selected-style="previewSelectedStyle"
            :refresh-busy="sampleBusy" :threshold="activeThreshold"
            :opened-gid="openedGallery?.gid ?? null"
            @clear-tag="clearPreviewTarget" @refresh="refreshPreview" @set-verdict="setVerdict"
            @open="openGallery"
          />

          <MyTagsGallery
            v-if="openedGallery"
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
    </SplitterGroup>
  </section>
</template>
