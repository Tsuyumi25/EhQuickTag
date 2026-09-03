<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { t } from '@/composables/useI18n'
import { useEqtToast } from '@/composables/useEqtToast'
import MyTagsTagList from '@/components/mytags/MyTagsTagList.vue'
import MyTagsPreview from '@/components/mytags/MyTagsPreview.vue'
import MyTagsGallery from '@/components/mytags/MyTagsGallery.vue'
import { fetchGallery, type GalleryDetail } from '@/composables/useEhGalleryPreview'
import {
  fetchTagSet, fetchThresholds, TAGSET_CAPACITY,
  type EhMyTagsHost, type MyTagRow, type TagSetSnapshot,
} from '@/composables/useEhMyTagsHost'
import { fetchListing } from '@/composables/useEhSearchListing'
import { tagBars, type ComboDataset } from '@/services/mytagsBars'
import {
  outcomeOf, compareItems, snapshot, summarizeEffect,
  type PreviewItem, type TagFacts, type EffectSummary, type TagImpact,
} from '@/services/mytagsScore'
import {
  accuracy, listingUrl, emptyStore,
  type SampleStore, type SampleGallery, type Verdict,
} from '@/services/mytagsSamples'
import { loadSamples, saveSamples } from '@/services/mytagsSampleStore'
import {
  stage, stageMany, effective, splitPending, unstage, rebase,
  type EditMap, type TagState,
} from '@/services/mytagsEdits'
import {
  loadEdits, saveEdits, emptyFilter,
  type TagFilter,
} from '@/services/mytagsEditStore'
import { setUserTag, canWrite } from '@/services/mytagsApi'
import { patchConfig } from '@/services/ehConfig'
import { serializeEntry } from '@/services/searchSyntax'
import { nsFormat } from '@/services/store'

const props = defineProps<{ host: EhMyTagsHost }>()

const toast = useEqtToast()

/** 一次「更新樣本」最多翻幾頁 EH */
const MAX_FETCH = 6

const liveRows = ref<MyTagRow[]>(props.host.readRows())
const otherSets = ref<TagSetSnapshot[]>([])
/** 已經成功寫回 EH 的值。原生 DOM 上的還是舊的，所以要疊在它上面當新的已存值 */
const applied = ref<Record<number, TagState>>({})
const edits = ref<EditMap>({})
const store = ref<SampleStore>(emptyStore())
const combos = shallowRef<ComboDataset | null>(null)

const filterThreshold = ref<number | null>(null)
/** EH 上現在的門檻。跟 filterThreshold 不一樣就代表這格也還沒送出去 */
const savedThreshold = ref<number | null>(null)
const selected = ref<string | null>(null)
const markedOnly = ref(false)
const busy = ref('')
const effect = ref<(EffectSummary & { label: string }) | null>(null)
const fetchedPages = ref<Record<string, { pages: number; cursor: string | null }>>({})

/** 攤開在預覽下方的那一本。整頁抓回來，判斷才有一張封面以外的依據 */
const openedGallery = ref<GalleryDetail | null>(null)
const galleryBusy = ref(false)
/** 同一本不用抓第二次 */
const galleryCache = new Map<number, GalleryDetail>()

const filter = ref<TagFilter>(emptyFilter())

const dialogOpen = ref(false)
const dialogName = ref('')
const dialogColor = ref('')
const dialogEnabled = ref(true)

// ---- 合併所有標籤集 ----

// ⚠️ 同一個標籤可能同時存在於兩組。清單裡列兩次、計分只採一份的話，畫面會說一套、
// 算另一套——所以這裡就去重，當前組那份優先（它是頁面上活的那個）
const rows = computed<MyTagRow[]>(() => {
  const byName = new Map<string, MyTagRow>()
  for (const r of [...otherSets.value.flatMap((s) => s.rows), ...liveRows.value]) {
    byName.set(r.full, applied.value[r.id] ? { ...r, ...applied.value[r.id] } : r)
  }
  return [...byName.values()]
})

const setColors = computed<Record<string, string>>(() => {
  const out: Record<string, string> = { [props.host.currentSet]: props.host.defaultColor }
  for (const s of otherSets.value) out[s.value] = s.defaultColor
  return out
})

const rowMap = computed(() => new Map(rows.value.map((r) => [r.full, r])))

function view(row: MyTagRow): TagState {
  return effective(row, edits.value)
}

function factsOf(tag: string): TagFacts | null {
  const r = rowMap.value.get(tag)
  if (!r) return null
  const v = view(r)
  return { weight: v.weight, hidden: v.hidden, watch: v.watch }
}

function weightOf(tag: string): number | null {
  const f = factsOf(tag)
  if (!f) return 0            // 不在清單裡的標籤不進加總
  return f.hidden ? null : f.weight
}

// 清空輸入框時 v-model.number 給的是空字串，不是 null。直接拿去比大小的話 JS 會把它
// 當成 0，面板就在沒有閾值的情況下照算不誤
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

const visibleItems = computed(() => allItems.value.filter((i) => {
  if (markedOnly.value && !store.value.verdicts[String(i.gallery.gid)]) return false
  if (selected.value && !i.gallery.tags.includes(selected.value)) return false
  return true
}))

const leftItems = computed(() =>
  visibleItems.value.filter((i) => i.outcome.side === 'left').sort(compareItems))
const rightItems = computed(() =>
  visibleItems.value.filter((i) => i.outcome.side === 'right').sort(compareItems))

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

/** 有 fixture 的時候的全庫分佈，只放進 tooltip */
const wholeDb = computed<Map<string, TagImpact> | null>(() => {
  if (!combos.value || activeThreshold.value === null) return null
  const declared = rows.value.filter((r) => {
    const v = view(r)
    return v.hidden || v.weight < 0
  }).map((r) => r.full)
  return new Map(tagBars(combos.value, declared, weightOf, activeThreshold.value)
    .map((b) => [b.tag, { total: b.total, left: b.blocked, right: b.shown }]))
})

const score = computed(() =>
  filterThreshold.value === null ? null : accuracy(store.value, weightOf, filterThreshold.value))

// ---- 編輯 ----

/** 每次改動都量一次「做了什麼」 */
function withEffect(label: string, run: () => void): void {
  const before = snapshot(allItems.value, store.value.verdicts)
  run()
  const sum = summarizeEffect(before, snapshot(allItems.value, store.value.verdicts))
  effect.value = sum.moved.length ? { ...sum, label } : null
}

/** 丟掉所有還沒送出的東西，門檻那格也要跟著回到 EH 上的值 */
function discard(): void {
  edits.value = unstage(edits.value, Object.keys(edits.value).map(Number))
  filterThreshold.value = savedThreshold.value
}

function patch(row: MyTagRow, p: Partial<TagState>): void {
  withEffect(t('panel.effectOne', { tag: row.full }), () => {
    edits.value = stage(edits.value, row, p)
  })
}

function bulk(rows2: MyTagRow[], p: Partial<TagState>): void {
  withEffect(t('panel.effectMany', { n: rows2.length }), () => {
    edits.value = stageMany(edits.value, rows2, p)
  })
}

const pending = computed(() => splitPending(rows.value, edits.value))

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
  pending.value.ready.length + pending.value.conflicted.length
  + (thresholdDirty.value ? 1 : 0))

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
  if (busy.value || !pendingTotal.value) return
  if (pending.value.ready.length && !canWrite()) {
    toast.error(t('panel.noCredentials')); return
  }
  const todo = [...pending.value.ready]
  const done: number[] = []
  let failure = ''
  for (const [i, row] of todo.entries()) {
    busy.value = t('panel.applying', { i: i + 1, n: todo.length })
    const want = edits.value[row.id].want
    const res = await setUserTag({ id: row.id, ...want })
    if (!res.ok) {
      failure = t('panel.applyFailed', { tag: row.full, error: res.error })
      break
    }
    applied.value = { ...applied.value, [row.id]: want }
    done.push(row.id)
  }
  edits.value = unstage(edits.value, done)
  await flush()

  // 標籤沒送完就不要動門檻——那是兩個不同的頁面，讓失敗停在一個地方比較好收拾
  if (!failure && thresholdDirty.value) await applyThreshold()
  busy.value = ''

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
  busy.value = t('panel.applyingThreshold')
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

// ---- 會刷新的動作：pending 必須先落地 ----

async function guarded(run: () => void): Promise<void> {
  await flush()
  await saveSamples(store.value)
  run()
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
  if (busy.value || !rows2.length) return
  await flush()
  const bySet = new Map<string, number[]>()
  for (const r of rows2) bySet.set(r.tagSet, [...(bySet.get(r.tagSet) ?? []), r.id])

  busy.value = t('panel.working')
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
  busy.value = ''
}

function removeTags(target: MyTagRow[]): void {
  if (!confirm(t('panel.deleteConfirmMany', { n: target.length }))) return
  void runMass(target, '0')
}

function moveTags(target: MyTagRow[], to: string): void {
  if (!to) return
  void runMass(target, to)
}

// ---- 標籤集設定 ----

function openSetDialog(): void {
  dialogName.value = props.host.tagSets.find((s) => s.value === props.host.currentSet)?.name ?? ''
  dialogColor.value = props.host.defaultColor
  dialogEnabled.value = props.host.enabled
  dialogOpen.value = true
}

function newSet(): void {
  const name = prompt(t('panel.newSetPrompt'), t('panel.newSetDefault'))
  if (name === null || !name.trim()) return
  void guarded(() => props.host.createTagSet(name.trim()))
}

// ---- 樣本 ----

function term(full: string): string {
  const colon = full.indexOf(':')
  return serializeEntry(
    { ns: full.slice(0, colon), raw: full.slice(colon + 1) },
    { nsFormat: nsFormat.value, exactMatch: true },
  )
}

async function grab(): Promise<void> {
  const tag = selected.value
  if (!tag) { toast.info(t('panel.pickTagFirst')); return }
  const at = fetchedPages.value[tag]
  if (busy.value || (at && at.cursor === null)) return
  // 抓回來的都還沒判過，「只看已標記」開著的話它們一本都不會出現，就沒得標記了
  markedOnly.value = false
  busy.value = t('bars.grabbing')
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
  busy.value = ''
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

/** 攤開的那一本在目前模式下的去向，跟格子上顯示的是同一份 */
const openedOutcome = computed(() =>
  allItems.value.find((i) => i.gallery.gid === openedGallery.value?.gid)?.outcome ?? null)

function select(tag: string): void {
  selected.value = selected.value === tag ? null : tag
  effect.value = null
  if (selected.value && !fetchedPages.value[tag]) void grab()
}

// ---- 封面預載：當前和接下來的先進快取，往下捲就不用等網路 ----

const warmed = new Set<string>()
watch([leftItems, rightItems], ([l, r]) => {
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
 * 面板一掛上就接管整個視窗，卸載時還原。
 *
 * ⚠️ `overflow: hidden` 動的是宿主頁面的全域狀態，一定要還原乾淨。
 */
function setAppMode(on: boolean): void {
  props.host.coverNative(on)
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = on ? 'hidden' : ''
  }
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

  if (import.meta.env.DEV) {
    try {
      // 經 unknown 中轉：TS 把 JSON 陣列一律推成 (string | number)[]，推不回 tuple
      const mod = await import('@/dev/combos.json')
      combos.value = mod.default as unknown as ComboDataset
    } catch { /* fixture 沒產就沒有全庫數字，其他照常 */ }
  }
})

onUnmounted(() => { unbind?.(); setAppMode(false) })
watch(store, (s) => { void saveSamples(s) }, { deep: true })
watch(edits, () => { void flush() }, { deep: true })
</script>

<template>
  <section class="eqt-panel">
    <div class="eqt-panel__workspace">
      <aside class="eqt-panel__side">
        <!-- 清單吃掉側欄剩下的高度，自己捲。側欄本身貼著視窗，所以底下那條永遠在 -->
        <MyTagsTagList
          v-model:filter="filter"
          :rows="sidebarRows" :edits="edits" :selected="selected"
          :sets="host.tagSets" :current-set="host.currentSet"
          :impact="impact" :whole-db="wholeDb" :set-colors="setColors"
          @patch="patch" @bulk="bulk" @select="select"
          @remove="removeTags" @move="moveTags"
        />

        <!-- ⭐ 全部收在底部：換組、調門檻、送出都是「看完清單之後才做的事」，
             而且捲到哪裡都摸得到 -->
        <footer class="eqt-panel__dock">
          <div class="eqt-panel__setbar">
            <select
              class="eqt-panel__setpick"
              :value="filter.set"
              @change="filter = { ...filter, set: ($event.target as HTMLSelectElement).value }"
            >
              <option value="all">{{ t('taglist.allSets') }}（{{ rows.length }}）</option>
              <option v-for="s in host.tagSets" :key="s.value" :value="s.value">
                {{ s.name }}{{ s.used !== null ? `（${s.used}/${TAGSET_CAPACITY}）` : '' }}
              </option>
            </select>
            <button type="button" class="eqt-panel__btn" @click="newSet">
              {{ t('taglist.newSet') }}
            </button>
            <button type="button" class="eqt-panel__btn" @click="openSetDialog">
              {{ t('taglist.setSettings') }}
            </button>
          </div>

          <div class="eqt-panel__dockmeta">
            <label class="eqt-panel__field" :class="{ 'eqt-panel__field--dirty': thresholdDirty }">
              {{ t('bars.threshold') }}
              <input v-model.number="filterThreshold" type="number" step="1" max="0">
            </label>
            <span v-if="filterThreshold === null" class="eqt-panel__warn">
              {{ t('bars.noThreshold') }}
            </span>
            <span v-else-if="score && score.judged" class="eqt-panel__meta">
              {{ t('bars.accuracy', {
                correct: score.correct, judged: score.judged,
                over: score.overBlocked, leak: score.leaked,
              }) }}
            </span>
          </div>

          <p v-if="pending.conflicted.length" class="eqt-panel__warn">
            {{ t('panel.conflicted', { n: pending.conflicted.length }) }}
            <button
              type="button" class="eqt-panel__btn"
              @click="edits = rebase(edits, pending.conflicted)"
            >{{ t('panel.rebase') }}</button>
          </p>

          <!-- 兩顆都常駐。沒有未送出的改動時灰掉，而不是消失——位置固定才不用每次找 -->
          <div class="eqt-panel__commitbar">
            <button
              type="button" class="eqt-panel__btn"
              :disabled="!pendingTotal || !!busy"
              @click="discard"
            >{{ t('panel.discard') }}</button>
            <button
              type="button" class="eqt-panel__btn eqt-panel__btn--primary"
              :disabled="!pendingTotal || !!busy" @click="apply"
            >{{ busy || t('panel.applyN', { n: pendingTotal }) }}</button>
          </div>
        </footer>
      </aside>

      <div class="eqt-panel__right">
      <MyTagsPreview
        v-model:marked-only="markedOnly"
        :left="leftItems" :right="rightItems"
        :verdicts="store.verdicts" :selected="selected" :effect="effect"
        :busy="busy" :threshold="activeThreshold"
        :opened-gid="openedGallery?.gid ?? null"
        @clear-tag="selected = null" @refresh="grab" @set-verdict="setVerdict"
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
      </div>
    </div>

    <!-- 標籤集設定。⚠️ 三個按鈕各自是一次表單送出，也就是各自一次整頁刷新 -->
    <div v-if="dialogOpen" class="eqt-panel__dialog">
      <header>
        <strong>{{ t('panel.setDialogTitle') }}</strong>
        <button type="button" class="eqt-panel__btn" @click="dialogOpen = false">✕</button>
      </header>
      <label class="eqt-panel__field">
        {{ t('panel.setName') }}
        <input v-model="dialogName" type="text">
        <button
          type="button" class="eqt-panel__btn eqt-panel__btn--reload"
          @click="guarded(() => host.renameTagSet(dialogName))"
        >{{ t('panel.rename') }}</button>
      </label>
      <label class="eqt-panel__field">
        {{ t('panel.setColor') }}
        <input v-model="dialogColor" type="color">
        <input v-model="dialogColor" type="text" maxlength="7" size="7">
      </label>
      <label class="eqt-panel__field">
        <input v-model="dialogEnabled" type="checkbox">
        {{ t('panel.setEnabled') }}
      </label>
      <p class="eqt-panel__hint">{{ t('panel.setColorNote') }}</p>
      <footer>
        <button
          type="button" class="eqt-panel__btn eqt-panel__btn--reload"
          @click="guarded(() => host.deleteTagSet())"
        >{{ t('panel.deleteSet') }}</button>
        <span class="eqt-panel__spacer" />
        <button
          type="button" class="eqt-panel__btn eqt-panel__btn--primary eqt-panel__btn--reload"
          @click="guarded(() => host.saveTagSet({ defaultColor: dialogColor, enabled: dialogEnabled }))"
        >{{ t('panel.saveSet') }}</button>
      </footer>
    </div>
  </section>
</template>
